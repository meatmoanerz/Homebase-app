import { isCreditPurchaseThisPeriod, type ExpenseForCalc } from '@/lib/utils/spend-calc'

export interface CategoryActual {
  /** Everything spent in the category in the period, both of you */
  total: number
  /** Of which bought by card (reaches the account with a later invoice) */
  card: number
}

/**
 * A period's actuals per category, keyed by category NAME: the partner's
 * expenses carry the partner's category ids, budgets match on name.
 * Household totals, like the budget rows: every expense at its full amount.
 */
export function actualsByCategoryName(expenses: ExpenseForCalc[]): Record<string, CategoryActual> {
  const map: Record<string, CategoryActual> = {}
  for (const expense of expenses) {
    const name = expense.category?.name
    if (!name) continue
    const entry = (map[name] ??= { total: 0, card: 0 })
    entry.total += expense.amount
    if (isCreditPurchaseThisPeriod(expense)) entry.card += expense.amount
  }
  return map
}
