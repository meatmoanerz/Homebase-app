import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { VAPID_PUBLIC_KEY } from '@/lib/push/client'

/** Send a test push to the logged-in user's devices. */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    if (!vapidPrivate) {
      return NextResponse.json(
        { error: 'VAPID_PRIVATE_KEY saknas i servermiljön — lägg till den i Vercel' },
        { status: 500 }
      )
    }

    webpush.setVapidDetails('mailto:noreply@homebase.app', VAPID_PUBLIC_KEY, vapidPrivate)

    // Own subscriptions are readable via RLS; use service client if available for robustness
    let subsClient
    try {
      subsClient = process.env.SUPABASE_SERVICE_ROLE_KEY ? createServiceClient() : supabase
    } catch {
      subsClient = supabase
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subscriptions, error } = await (subsClient as any)
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ error: 'Inga enheter registrerade — aktivera notiser på enheten först' }, { status: 400 })
    }

    const payload = JSON.stringify({
      title: 'Testnotis från Homebase 🏠',
      body: 'Pushnotiser fungerar! Du kommer få importpåminnelser på vald dag.',
      url: '/import',
    })

    let sent = 0
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch (err) {
        console.error('[Push test] send failed:', err)
      }
    }

    return NextResponse.json({ ok: true, sent })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
