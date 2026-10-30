import { personShare } from '@/lib/analytics/analytics'
import type { CostAssignment } from '@/types'

/**
 * Two parallel KPIs in Homebase — kept strictly separate.
 *
 * 1. CONSUMPTION / FÖRBRUKNING ("vad lever vi för denna period") — the MAIN KPI
 *    Every purchase counted ONCE, on its purchase date, in its own category —
 *    bank purchases and credit-card purchases alike. The credit-card invoice
 *    line (Kreditkort category, flagged excludes_from_expense_total) is NOT
 *    consumption: it pays off card debt for purchases already counted.
 *    You budget against consumption.
 *
 * 2. CASH FLOW / KASSAFLÖDE ("vad lämnar kontot just nu") — secondary
 *    Income minus money that actually leaves the account this period.
 *    This period's card purchases are excluded (they hit a future invoice),
 *    but the credit-card invoice paid this period IS counted (it's drawn now),
 *    as are all bank purchases.
 *
 * The difference between them is the card debt: purchases made but not yet
 * paid. Over a year the two add up to roughly the same — they only differ in
 * when a cost shows.
 */

export interface ExpenseForCalc {
  amount: number
  is_ccm?: boolean | null
  bank?: string | null
  category?: {
    cost_type?: string | null
    excludes_from_expense_total?: boolean | null
    name?: string | null
  } | null
}

/** The Kreditkort invoice line (expense or budget row): paying card debt, not consumption. */
export function isCardInvoice(row: { category?: { excludes_from_expense_total?: boolean | null } | null }): boolean {
  return row.category?.excludes_from_expense_total === true
}

/**
 * Is this expense an Amex/credit-card PURCHASE made this period?
 * (Not the invoice payment — an actual purchase that will hit a future invoice.)
 */
export function isCreditPurchaseThisPeriod(expense: ExpenseForCalc): boolean {
  // The invoice-payment line is not a credit purchase
  if (isCardInvoice(expense)) return false

  if (expense.is_ccm === true) return true
  if (expense.bank && ['amex', 'norwegian'].includes(expense.bank.toLowerCase())) return true
  return false
}

/**
 * CONSUMPTION total — every purchase once; the credit-card invoice line excluded.
 */
export function calcConsumption(expenses: ExpenseForCalc[]): number {
  return expenses.reduce((sum, e) => (isCardInvoice(e) ? sum : sum + e.amount), 0)
}

/**
 * CASH OUT — money that actually leaves the account this period.
 * Everything counts EXCEPT this period's credit-card purchases
 * (they hit a future invoice). The invoice paid this month is included.
 */
export function calcCashOut(expenses: ExpenseForCalc[]): number {
  return expenses.reduce((sum, e) => {
    if (isCreditPurchaseThisPeriod(e)) return sum
    return sum + e.amount
  }, 0)
}

/**
 * Net cash flow = income minus money leaving the account this period.
 */
export function calcCashFlow(income: number, expenses: ExpenseForCalc[]): number {
  return income - calcCashOut(expenses)
}

/**
 * A person's share of consumption (credit-card invoice line excluded).
 *   - personal → 100% to the row's owner (user_id)
 *   - partner  → 100% to the owner's partner
 *   - shared   → 50/50
 * cost_assignment is relative to the row owner, so the viewer's id is needed
 * to tell whose "personal" a row is.
 */
export function calcPersonSpend(
  expenses: Array<ExpenseForCalc & { cost_assignment?: string | null; user_id?: string | null }>,
  perspective: 'user' | 'partner',
  viewerId: string | undefined
): number {
  const who = perspective === 'user' ? 'me' : 'partner'
  return expenses.reduce(
    (sum, e) => isCardInvoice(e)
      ? sum
      : sum + e.amount * personShare({ user_id: e.user_id ?? '', cost_assignment: (e.cost_assignment ?? 'personal') as CostAssignment }, who, viewerId),
    0
  )
}
