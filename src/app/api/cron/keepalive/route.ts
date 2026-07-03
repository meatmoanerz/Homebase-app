import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Keepalive cron — prevents the Supabase free-tier project from being
 * paused due to inactivity (pauses after ~7 days without API/DB activity).
 *
 * Writes a timestamp to the single-row `keepalive` table (write activity,
 * no data growth, nothing to clean up).
 *
 * Called daily by Vercel Cron (see vercel.json). Can also be triggered
 * manually by visiting /api/cron/keepalive.
 *
 * Intentionally uses the anon key so it works even if
 * SUPABASE_SERVICE_ROLE_KEY is missing from the environment —
 * the keepalive table has a permissive RLS policy for this purpose.
 */
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
      return NextResponse.json(
        { ok: false, error: 'Supabase env vars missing' },
        { status: 500 }
      )
    }

    const supabase = createSupabaseClient(url, key)
    const pingedAt = new Date().toISOString()

    const { error } = await supabase
      .from('keepalive')
      .upsert({ id: 1, pinged_at: pingedAt }, { onConflict: 'id' })

    if (error) {
      console.error('[Keepalive] Upsert failed:', error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    console.log(`[Keepalive] Pinged Supabase at ${pingedAt}`)
    return NextResponse.json({ ok: true, pinged_at: pingedAt })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Keepalive] Error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
