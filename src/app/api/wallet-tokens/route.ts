import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Self-service keys for the iPhone shortcuts (Wallet card purchases and
// receipts). A key ties the phone to the signed-in user: /api/wallet/* and
// /api/receipts/ingest look the user up from it. Only the SHA-256 hash is
// stored; the key itself is shown once, right after it is created.
//
// GET    → this user's active keys
// POST   { label } → new key (returned once)
// DELETE ?id=… → revoke a key

const MAX_ACTIVE_TOKENS = 5

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const sub = data?.claims?.sub
  return error || typeof sub !== 'string' ? null : sub
}

// wallet_ingest_tokens is service-role only and not in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tokens = () => (createServiceClient() as any).from('wallet_ingest_tokens')

export async function GET() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await tokens()
    .select('id, cardholder, created_at, last_used_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Kunde inte läsa nycklarna' }, { status: 500 })

  return NextResponse.json({ tokens: data ?? [] })
}

export async function POST(request: NextRequest) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { label?: unknown }
  const label = typeof body.label === 'string' ? body.label.replace(/\s+/g, ' ').trim().slice(0, 40) : ''
  if (!label) return NextResponse.json({ error: 'Ange ett namn' }, { status: 400 })

  const { count, error: countError } = await tokens()
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('revoked_at', null)
  if (countError) return NextResponse.json({ error: 'Kunde inte skapa nyckeln' }, { status: 500 })
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS) {
    return NextResponse.json(
      { error: `Du kan ha högst ${MAX_ACTIVE_TOKENS} nycklar. Ta bort en du inte använder.` },
      { status: 400 }
    )
  }

  const token = `hb_${randomBytes(32).toString('base64url')}`
  const { data, error } = await tokens()
    .insert({ user_id: userId, token_hash: sha256(token), cardholder: label })
    .select('id, cardholder, created_at, last_used_at')
    .single()
  if (error) return NextResponse.json({ error: 'Kunde inte skapa nyckeln' }, { status: 500 })

  return NextResponse.json({ token, entry: data })
}

export async function DELETE(request: NextRequest) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id saknas' }, { status: 400 })

  const { error } = await tokens()
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .is('revoked_at', null)
  if (error) return NextResponse.json({ error: 'Kunde inte ta bort nyckeln' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
