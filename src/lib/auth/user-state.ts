'use client'

import type { QueryClient } from '@tanstack/react-query'
import { usePerspective } from '@/hooks/use-perspective'
import { useSeenNotifications } from '@/hooks/use-notifications'
import { useFilterStore } from '@/stores/filter-store'
import { useUIStore } from '@/stores/ui-store'

/**
 * Browser storage keys that hold one account's data or choices. They are
 * removed when the account signs out, so the next account on the same
 * device starts clean. Device settings (e.g. the theme) are kept.
 */
const USER_STORAGE_PREFIXES = [
  'budget-draft-',
  'import-freshness-dismissed-',
  'shopping-draft:',
  'meals-archive-dismissed-for',
  'homebase-perspective',
  'homebase-notifications-seen',
]

function clearUserStorage() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && USER_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // Storage can be blocked (private mode); nothing to clear then.
  }
  try {
    // Only per-session UI flags live here (reminders, reveal animations).
    sessionStorage.clear()
  } catch {
    // Same as above.
  }
}

/** Put the in-memory stores back to their defaults. */
function resetStores() {
  usePerspective.setState({ perspective: 'all' })
  useSeenNotifications.setState({ seen: [] })
  useFilterStore.getState().clearExpenseFilters()
  useFilterStore.getState().setBudgetPeriodFilter(null)
  useUIStore.setState({ isSidebarOpen: false, isAddExpenseOpen: false, selectedPeriod: null })
}

/**
 * Forget everything cached for the account that just signed out.
 *
 * Query keys do not carry the user id, so without this the next account
 * signed in on the same tab is shown the previous account's cached data.
 */
export function clearUserState(queryClient: QueryClient) {
  queryClient.cancelQueries()
  queryClient.clear()
  resetStores()
  clearUserStorage()
}

/**
 * Another account became active without a sign-out in this tab (e.g. a
 * sign-in in another tab). Drop the old account's data and refetch what is
 * on screen for the new one.
 */
export function switchUserState(queryClient: QueryClient) {
  queryClient.cancelQueries()
  queryClient.removeQueries({ type: 'inactive' })
  resetStores()
  clearUserStorage()
  // Active queries are reset to no data and fetched again for the new account.
  queryClient.resetQueries({ type: 'active' })
}
