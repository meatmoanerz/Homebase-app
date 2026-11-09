import { budgetAccountShare, budgetCardPart, splitBudgetItem, type SplittableBudgetItem } from '@/lib/utils/budget-split'
import type { SplitRule } from '@/lib/household/economy'

export interface SharedAccountRow {
  categoryId: string
  name: string
  /** Deposited for the row: the part drawn from the account */
  amount: number
  /** The part paid by card — reaches the account with the card invoice instead */
  cardAmount: number
  user: number
  partner: number
  /** Split by the period's income share */
  byIncome: boolean
  /** Split set by hand in the budget */
  explicit: boolean
}

export interface SharedAccountSummary {
  rows: SharedAccountRow[]
  total: number
  user: number
  partner: number
}

type SummaryItem = SplittableBudgetItem & { category_id: string | null; name: string; is_ccm?: boolean | null; ccm_amount?: number | null }

/**
 * What each of you deposits to the shared account: the budget rows of the
 * shared categories, split per row (explicit split, else income share / 50/50).
 * Whole kronor; an odd krona on a 50/50 row alternates between you so the
 * rows add up exactly to the per-person totals.
 * `extraCategories` are shared categories without a budget row this period;
 * they are listed at 0 kr so a missing budget line is visible.
 * Only the part drawn from the account is deposited. The card part (all of an
 * is_ccm row, or ccm_amount of a row paid both ways) leaves the account with
 * the card invoice, which is the Kreditkort row — counting both would make you
 * deposit it twice. A row paid only by card is listed at 0 with its card part.
 * Each person's share of a row is scaled to the account part.
 */
export function computeSharedAccountSummary(
  items: SummaryItem[],
  categoryIds: ReadonlySet<string>,
  userId: string | null | undefined,
  partnerId: string | null | undefined,
  rule?: SplitRule,
  extraCategories: { id: string; name: string }[] = []
): SharedAccountSummary {
  let userGetsOddKrona = true
  const rows: SharedAccountRow[] = items
    .filter((item) => item.category_id && categoryIds.has(item.category_id))
    .map((item) => {
      const split = splitBudgetItem(item, userId, partnerId, rule)
      const cardAmount = Math.round(budgetCardPart(item))
      const amount = Math.round(item.amount) - cardAmount
      let user = amount === 0 ? 0 : split.user * budgetAccountShare(item)
      if (!Number.isInteger(user)) {
        user = userGetsOddKrona ? Math.ceil(user) : Math.floor(user)
        userGetsOddKrona = !userGetsOddKrona
      }
      const byIncome = !split.explicit && !!rule && rule.incomeCategoryIds.has(item.category_id!)
      return {
        categoryId: item.category_id!,
        name: item.name,
        amount,
        cardAmount,
        user,
        partner: amount - user,
        byIncome,
        explicit: split.explicit,
      }
    })
    .sort((a, b) => b.amount - a.amount || b.cardAmount - a.cardAmount)

  const budgeted = new Set(rows.map((r) => r.categoryId))
  for (const extra of extraCategories) {
    if (categoryIds.has(extra.id) && !budgeted.has(extra.id)) {
      rows.push({ categoryId: extra.id, name: extra.name, amount: 0, cardAmount: 0, user: 0, partner: 0, byIncome: false, explicit: false })
    }
  }

  return {
    rows,
    total: rows.reduce((s, r) => s + r.amount, 0),
    user: rows.reduce((s, r) => s + r.user, 0),
    partner: rows.reduce((s, r) => s + r.partner, 0),
  }
}
