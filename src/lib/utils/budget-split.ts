import type { BudgetItem, BudgetItemAssignment } from '@/types'
import { defaultSplit, type SplitRule } from '@/lib/household/economy'

/**
 * Budget item with optional explicit per-person assignments.
 * `budget_item_assignments` stores the *user's own* amount when the split
 * deviates from 50/50. The partner's share is derived as (total - user amount).
 */
export type SplittableBudgetItem = Pick<BudgetItem, 'amount'> & {
  category_id?: string | null
  budget_item_assignments?: BudgetItemAssignment[] | null
}

export interface BudgetItemSplit {
  user: number
  partner: number
  /** True when the split comes from an explicit assignment, false when it is the default */
  explicit: boolean
}

/**
 * Split a budget item between user and partner.
 * Uses explicit budget_item_assignments when present, otherwise the default:
 * the period's income share for categories split by income (see SplitRule),
 * else 50/50.
 * This is the single source of truth for per-person budget amounts —
 * never divide item.amount by 2 directly in UI code.
 */
export function splitBudgetItem(
  item: SplittableBudgetItem,
  userId: string | undefined | null,
  partnerId: string | undefined | null,
  rule?: SplitRule
): BudgetItemSplit {
  const assignments = item.budget_item_assignments || []
  const userAssign = userId ? assignments.find(a => a.user_id === userId) : undefined
  const partnerAssign = partnerId ? assignments.find(a => a.user_id === partnerId) : undefined

  if (userAssign || partnerAssign) {
    const user = userAssign?.amount ?? (item.amount - (partnerAssign?.amount ?? 0))
    const partner = partnerAssign?.amount ?? (item.amount - (userAssign?.amount ?? 0))
    return { user, partner, explicit: true }
  }

  const split = defaultSplit(item.amount, item.category_id, rule)
  return { user: split.user, partner: split.partner, explicit: false }
}

export type BudgetViewMode = 'total' | 'mine' | 'partner'

/**
 * Get the budgeted amount for a single item given the current view mode.
 */
export function budgetAmountForView(
  item: SplittableBudgetItem,
  viewMode: BudgetViewMode,
  userId: string | undefined | null,
  partnerId: string | undefined | null,
  rule?: SplitRule
): number {
  if (viewMode === 'total') return item.amount
  const split = splitBudgetItem(item, userId, partnerId, rule)
  return viewMode === 'mine' ? split.user : split.partner
}

/**
 * Sum per-person budget totals over a list of items.
 */
export function sumBudgetSplit(
  items: SplittableBudgetItem[],
  userId: string | undefined | null,
  partnerId: string | undefined | null,
  rule?: SplitRule
): { total: number; user: number; partner: number } {
  let total = 0
  let user = 0
  let partner = 0
  for (const item of items) {
    total += item.amount
    const split = splitBudgetItem(item, userId, partnerId, rule)
    user += split.user
    partner += split.partner
  }
  return { total, user, partner }
}
