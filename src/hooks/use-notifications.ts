'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useUser } from '@/hooks/use-user'
import { useImportBatches, type StagingBatch } from '@/hooks/use-import-staging'
import { useHasIncomeForCurrentPeriod } from '@/hooks/use-monthly-incomes'
import { useBudgetByPeriod } from '@/hooks/use-budgets'
import { getCurrentBudgetPeriod, formatPeriodDisplay } from '@/lib/utils/budget-period'

export type NotificationKind = 'import' | 'income' | 'budget'

export interface AppNotification {
  /** Stable while the underlying state is unchanged; a new id re-notifies. */
  id: string
  kind: NotificationKind
  title: string
  body: string
  href: string
  /** For ordering, newest first. */
  at: string
  urgent?: boolean
}

interface SeenStore {
  seen: string[]
  markSeen: (ids: string[]) => void
}

/** Which notifications the user has already looked at (per device). */
export const useSeenNotifications = create<SeenStore>()(
  persist(
    (set) => ({
      seen: [],
      markSeen: (ids) =>
        set((state) => ({ seen: Array.from(new Set([...state.seen, ...ids])).slice(-200) })),
    }),
    { name: 'homebase-notifications-seen' }
  )
)

const SOURCE_LABELS: Record<string, string> = {
  amex_auto: 'Amex',
  norwegian_auto: 'Norwegian',
  bank_auto: 'Bankimport',
}

function importNotification(batch: StagingBatch): AppNotification {
  const source = batch.source ? SOURCE_LABELS[batch.source] ?? 'Import' : 'AI-import'
  const hoursLeft = (new Date(batch.expires_at).getTime() - Date.now()) / 3_600_000
  const expiresSoon = !batch.pinned && hoursLeft > 0 && hoursLeft < 12
  return {
    // Row count in the id: new rows appended to a rolling batch re-notify.
    id: `import:${batch.batch_id}:${batch.row_count}`,
    kind: 'import',
    title: `${batch.row_count} ${batch.row_count === 1 ? 'transaktion' : 'transaktioner'} att granska`,
    body: expiresSoon
      ? `${source} · försvinner om ${Math.max(1, Math.round(hoursLeft))} h`
      : `${source}${batch.bank && !batch.source ? ` · ${batch.bank}` : ''}`,
    href: '/import',
    at: batch.uploaded_at,
    urgent: expiresSoon,
  }
}

/**
 * In-app notifications, derived from live state rather than stored: they
 * disappear by themselves once the thing they point at is handled.
 */
export function useNotifications() {
  const { data: user } = useUser()
  const salaryDay = user?.salary_day || 25
  const current = getCurrentBudgetPeriod(salaryDay)
  const { data: batches = [] } = useImportBatches()
  const { data: hasIncome } = useHasIncomeForCurrentPeriod()
  const { data: budget, isSuccess: budgetLoaded } = useBudgetByPeriod(current.period)
  const seen = useSeenNotifications((s) => s.seen)

  const notifications: AppNotification[] = batches
    .filter((b) => b.row_count > 0)
    .map(importNotification)

  const periodName = formatPeriodDisplay(current.period)
  const periodStart = current.startDate.toISOString()

  if (user && hasIncome === false) {
    notifications.push({
      id: `income:${current.period}`,
      kind: 'income',
      title: 'Lägg in månadsinkomst',
      body: `Ingen inkomst registrerad för ${periodName} — behövs för kassaflöde och sparkvot.`,
      href: '/budget/income',
      at: periodStart,
    })
  }

  if (user && budgetLoaded && !budget) {
    notifications.push({
      id: `budget:${current.period}`,
      kind: 'budget',
      title: `Ingen budget för ${periodName}`,
      body: 'Skapa en budget för att följa perioden mot plan.',
      href: `/budget/new?period=${current.period}`,
      at: periodStart,
    })
  }

  notifications.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || b.at.localeCompare(a.at))
  const seenSet = new Set(seen)
  const unread = notifications.filter((n) => !seenSet.has(n.id))

  return { notifications, unreadCount: unread.length, isUnread: (id: string) => !seenSet.has(id) }
}
