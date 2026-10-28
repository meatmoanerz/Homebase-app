'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * false while prerendering and during hydration, true right after. Use it for
 * UI that depends on "now" (today's date) — the static HTML is built ahead of
 * time, so rendering the date there would mismatch on the device.
 */
export function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
