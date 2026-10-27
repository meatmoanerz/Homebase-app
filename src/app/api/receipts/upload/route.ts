import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseReceipt, ReceiptParseError } from '@/lib/receipts/parse-receipt'
import { saveParsedReceipt } from '@/lib/receipts/save-receipt'
import { readReceiptUpload } from '@/lib/receipts/read-upload'

export const runtime = 'nodejs'
// Reading a receipt with Claude can take a while.
export const maxDuration = 120

// POST /api/receipts/upload — photo or PDF from the Kvitton page (logged-in user).
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Inte inloggad' }, { status: 401 })

  const file = await readReceiptUpload(request)
  if ('error' in file) return NextResponse.json({ ok: false, error: file.error }, { status: 400 })

  try {
    const parsed = await parseReceipt(file)
    const result = await saveParsedReceipt(supabase, user.id, parsed)
    return NextResponse.json({ ok: true, ...result, store: parsed.store_name, total: parsed.total_amount, date: parsed.purchase_date })
  } catch (error) {
    if (error instanceof ReceiptParseError) return NextResponse.json({ ok: false, error: error.message }, { status: 422 })
    console.error('Receipt upload failed:', error)
    return NextResponse.json({ ok: false, error: 'Kvittot kunde inte sparas' }, { status: 500 })
  }
}
