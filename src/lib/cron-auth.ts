import type { NextRequest } from 'next/server'

export function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`
}

