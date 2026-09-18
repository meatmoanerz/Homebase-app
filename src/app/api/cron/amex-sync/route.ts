import { NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import { AmexBrowserError } from '@/lib/amex/browserbase'
import { runAmexSync } from '@/lib/amex/sync'

export const runtime = 'nodejs'
export const maxDuration = 300

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await runAmexSync())
  } catch (error) {
    const browserError = error instanceof AmexBrowserError ? error : null
    console.error('[Amex sync] Failed:', error)
    return NextResponse.json(
      {
        ok: false,
        code: browserError?.code ?? 'SYNC_FAILED',
        error: error instanceof Error ? error.message : 'Okänt fel',
        sessionId: browserError?.sessionId,
        sessionUrl: browserError?.sessionId
          ? `https://www.browserbase.com/sessions/${browserError.sessionId}`
          : undefined,
      },
      { status: 500 }
    )
  }
}

export const GET = handle
export const POST = handle

