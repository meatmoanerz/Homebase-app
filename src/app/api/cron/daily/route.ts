import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { VAPID_PUBLIC_KEY } from '@/lib/push/client'
import { isCronAuthorized } from '@/lib/cron-auth'
import { runAmexSync } from '@/lib/amex/sync'

/**
 * Daily cron (see vercel.json):
 * 1. Keepalive-ping so the Supabase free-tier project is never paused.
 * 2. Send import-reminder push notifications to users whose chosen
 *    weekday (Europe/Stockholm) is today and have reminders enabled.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (to read all users' settings/subscriptions)
 * and VAPID_PRIVATE_KEY for sending pushes. The keepalive part works with the
 * anon key alone, so the route degrades gracefully if secrets are missing.
 */

const WEEKDAY_NAMES = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag']

function stockholmWeekday(): number {
  // JS getDay() convention: 0 = Sunday
  const name = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Stockholm' })
    .format(new Date())
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name)
}

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY

  if (process.env.CRON_SECRET && !isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, error: 'Supabase env vars missing' }, { status: 500 })
  }

  // 1) Keepalive — always, with whatever key is available
  const keepaliveClient = createSupabaseClient(url, serviceKey || anonKey)
  const { error: kaError } = await keepaliveClient
    .from('keepalive')
    .upsert({ id: 1, pinged_at: new Date().toISOString() }, { onConflict: 'id' })
  if (kaError) console.error('[Daily] Keepalive failed:', kaError.message)

  // 2) Reminders — need service key + VAPID private key
  let reminderResult: Record<string, unknown> = { reminders: 'skipped' }
  if (serviceKey && vapidPrivate) {
    webpush.setVapidDetails('mailto:noreply@homebase.app', VAPID_PUBLIC_KEY, vapidPrivate)
    const admin = createSupabaseClient(url, serviceKey)
    const today = stockholmWeekday()

    const { data: settings, error: settingsError } = await admin
      .from('notification_settings')
      .select('user_id, import_reminder_day')
      .eq('import_reminder_enabled', true)
      .eq('import_reminder_day', today)

    if (settingsError) {
      reminderResult = { reminders: 'failed', reminder_error: settingsError.message }
    } else {
      const userIds = (settings || []).map((setting: { user_id: string }) => setting.user_id)
      let sent = 0
      let removed = 0

      if (userIds.length > 0) {
        const { data: subscriptions, error: subsError } = await admin
          .from('push_subscriptions')
          .select('id, user_id, endpoint, p256dh, auth')
          .in('user_id', userIds)

        if (subsError) {
          reminderResult = { reminders: 'failed', reminder_error: subsError.message }
        } else {
          const payload = JSON.stringify({
            title: 'Dags att importera transaktioner 💳',
            body: 'Ladda upp veckans banktransaktioner så håller du budgeten uppdaterad.',
            url: '/import',
          })

          for (const sub of subscriptions || []) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
              )
              sent++
            } catch (err) {
              const statusCode = (err as { statusCode?: number })?.statusCode
              if (statusCode === 404 || statusCode === 410) {
                await admin.from('push_subscriptions').delete().eq('id', sub.id)
                removed++
              } else {
                console.error('[Daily] Push send failed:', err)
              }
            }
          }
        }
      }

      if (reminderResult.reminders !== 'failed') {
        reminderResult = {
          weekday: WEEKDAY_NAMES[today],
          reminders: sent,
          expired_removed: removed,
        }
      }
    }
  } else {
    reminderResult = {
      reminders: 'skipped',
      reminder_reason: !serviceKey
        ? 'SUPABASE_SERVICE_ROLE_KEY missing'
        : 'VAPID_PRIVATE_KEY missing',
    }
  }

  // 3) Amex — only run when the route is protected and fully configured.
  let amex: Record<string, unknown> = { status: 'skipped' }
  if (
    process.env.CRON_SECRET
    && process.env.BROWSERBASE_API_KEY
    && process.env.BROWSERBASE_CONTEXT_ID
    && serviceKey
  ) {
    try {
      amex = { ...(await runAmexSync()) }
    } catch (error) {
      console.error('[Daily] Amex sync failed:', error)
      amex = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Okänt fel',
      }
    }
  } else {
    amex = {
      status: 'skipped',
      reason: 'CRON_SECRET, Browserbase or Supabase service configuration missing',
    }
  }

  return NextResponse.json({
    ok: amex.status !== 'failed',
    keepalive: !kaError,
    ...reminderResult,
    amex,
  }, { status: amex.status === 'failed' ? 500 : 200 })
}
