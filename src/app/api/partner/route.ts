import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Service role client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Verify the session (local JWT check when the project uses asymmetric keys)
    const supabase = await createServerClient()
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
    const userId = claimsData?.claims?.sub

    if (claimsError || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only this user's active connection (filtered in the database, not in JS)
    const { data: connection, error: connError } = await supabaseAdmin
      .from('partner_connections')
      .select('*')
      .eq('status', 'active')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .limit(1)
      .maybeSingle()

    if (connError) {
      return NextResponse.json({ error: connError.message }, { status: 500 })
    }

    if (!connection) {
      return NextResponse.json({ partner: null, connection: null })
    }

    const partnerId = connection.user1_id === userId
      ? connection.user2_id
      : connection.user1_id

    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', partnerId)
      .single()

    if (partnerError) {
      return NextResponse.json({ error: partnerError.message }, { status: 500 })
    }

    return NextResponse.json({ partner, connection })
  } catch (error) {
    console.error('API /partner error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
