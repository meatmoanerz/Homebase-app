import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseReceipt, ReceiptParseError } from '@/lib/receipts/parse-receipt'
import { saveParsedReceipt } from '@/lib/receipts/save-receipt'
import { readReceiptUpload } from '@/lib/receipts/read-upload'

export const runtime = 'nodejs'
export const maxDuration = 120

// Receives a receipt shared from Kivra / the ICA app via an iPhone Shortcut
// ("Dela → Kvitto till Homebase"). Same per-device token as the Wallet
// shortcut. Answers with a short Swedish line the Shortcut can show.
//
// POST /api/receipts/ingest
// Authorization: Bearer <device token>
// Body: the file (raw), or multipart field "file"

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function reply(status: number, ok: boolean, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok, message, ...extra }, { status })
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return reply(401, false, 'Token saknas')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceClient() as any
  const { data: device, error: tokenError } = await admin
    .from('wallet_ingest_tokens')
    .select('id, user_id')
    .eq('token_hash', sha256(token))
    .is('revoked_at', null)
    .maybeSingle()
  if (tokenError) return reply(500, false, 'Kunde inte verifiera token')
  if (!device) return reply(401, false, 'Ogiltig token')
  await admin.from('wallet_ingest_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', device.id)

  const file = await readReceiptUpload(request)
  if ('error' in file) return reply(400, false, file.error)

  try {
    const parsed = await parseReceipt(file)
    const result = await saveParsedReceipt(admin, device.user_id, parsed)
    const store = parsed.store_name || parsed.store_chain || 'Kvitto'
    const message = result.duplicate
      ? `${store} ${parsed.total_amount ?? ''} kr fanns redan`
      : `✓ ${store} · ${result.itemCount} varor · ${parsed.total_amount ?? ''} kr${result.expenseId ? ' · kopplat till köpet' : ''}`
    return reply(200, true, message, result as unknown as Record<string, unknown>)
  } catch (error) {
    if (error instanceof ReceiptParseError) return reply(422, false, error.message)
    console.error('Receipt ingest failed:', error)
    return reply(500, false, 'Kvittot kunde inte sparas')
  }
}
