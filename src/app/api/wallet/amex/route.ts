import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeMerchant, parseWalletAmount, stockholmToday } from '@/lib/amex/wallet'

export const runtime = 'nodejs'

// Receives one Apple Pay purchase from the iPhone Shortcuts "Transaktion"
// automation and puts it in the Amex autoimport inbox for review.
//
// POST /api/wallet/amex
// Authorization: Bearer <device token>
// Body (JSON or form): { merchant: string, amount: string | number }

const DOUBLE_FIRE_WINDOW_MS = 2 * 60 * 1000

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await request.json().catch(() => ({}))) as Record<string, unknown>
  }
  if (contentType.includes('form')) {
    const form = await request.formData()
    return Object.fromEntries(form.entries())
  }
  const text = await request.text()
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status })
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return fail(401, 'Token saknas')

  // The generated database types lag new tables; keep this route locally typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceClient() as any

  const { data: device, error: tokenError } = await admin
    .from('wallet_ingest_tokens')
    .select('id, user_id, cardholder')
    .eq('token_hash', sha256(token))
    .is('revoked_at', null)
    .maybeSingle()
  if (tokenError) return fail(500, 'Kunde inte verifiera token')
  if (!device) return fail(401, 'Ogiltig token')

  const body = await readBody(request)
  const merchant = normalizeMerchant(body.merchant ?? body.handlare)
  const parsed = parseWalletAmount(body.amount ?? body.belopp)
  if (!merchant) return fail(400, 'Handlare saknas')
  if (!parsed || parsed.amount === 0) return fail(400, 'Ogiltigt belopp')

  // Foreign currency: keep the original amount but flag it clearly for review.
  const description = parsed.currency === 'SEK'
    ? merchant
    : `${merchant} [${parsed.currency} – kontrollera SEK]`

  const now = new Date()
  const date = stockholmToday(now)
  const fingerprint = sha256(
    ['wallet', date, description.toLocaleUpperCase('sv-SE'), parsed.amount.toFixed(2), device.cardholder].join('|')
  )

  const { data: existing, error: existingError } = await admin
    .from('amex_sync_transactions')
    .select('occurrence_index, first_seen_at')
    .eq('user_id', device.user_id)
    .eq('fingerprint', fingerprint)
    .order('occurrence_index', { ascending: false })
  if (existingError) return fail(500, 'Kunde inte läsa inkorgen')

  const latest = existing?.[0]
  if (latest && now.getTime() - new Date(latest.first_seen_at).getTime() < DOUBLE_FIRE_WINDOW_MS) {
    return NextResponse.json({ ok: true, duplicate: true, message: `Redan sparat: ${merchant}` })
  }

  const { error: insertError } = await admin.from('amex_sync_transactions').insert({
    user_id: device.user_id,
    fingerprint,
    occurrence_index: (latest?.occurrence_index ?? 0) + 1,
    transaction_date: date,
    description,
    amount: parsed.amount,
    cardholder: device.cardholder,
    status: 'unreviewed',
    first_seen_at: now.toISOString(),
    last_seen_at: now.toISOString(),
  })
  if (insertError) return fail(500, 'Kunde inte spara transaktionen')

  await admin.from('wallet_ingest_tokens').update({ last_used_at: now.toISOString() }).eq('id', device.id)

  const { data: batch, error: batchError } = await admin.rpc('rebuild_amex_review_batch', {
    p_user_id: device.user_id,
  })
  if (batchError) {
    // The row is safely in the inbox; it will be staged on the next rebuild.
    console.error('[Wallet Amex] rebuild failed:', batchError)
  }

  return NextResponse.json({
    ok: true,
    staged: batch?.staged ?? null,
    batchLocked: batch?.batchLocked ?? null,
    message: `Sparat: ${merchant} ${parsed.amount.toFixed(2).replace('.', ',')} ${parsed.currency === 'SEK' ? 'kr' : parsed.currency}`,
  })
}
