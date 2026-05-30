/**
 * Two parallel KPIs in Homebase — kept strictly separate.
 *
 * 1. SPEND ("vad konsumerar vi denna period") — the MAIN KPI
 *    Sum of ALL expenses in the period, regardless of payment source.
 *    Bank purchases, Amex purchases, AND the credit-card invoice line
 *    (Kreditkort category — last month's Amex purchases being paid now)
 *    all count. Nothing is excluded. You budget against spend.
 *
 *    No double counting: this month's Amex purchases land on NEXT month's
 *    invoice, while the invoice paid this month is LAST month's purchases.
 *    They never overlap.
 *
 * 2. CASH FLOW ("vad lämnar kontot just nu") — secondary
 *    Income minus money that actually leaves the account this period.
 *    This month's Amex purchases are excluded (they hit a future invoice),
 *    but the credit-card invoice paid this month IS counted (it's drawn now),
 *    as are all bank purchases.
 *
 *    The whole point of tracking both: you set a budget against spend, but
 *    cash flow warns you if that budget is unaffordable in terms of money
 *    actually leaving the account this period.
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

/**
 * Is this expense an Amex/credit-card PURCHASE made this period?
 * (Not the invoice payment — an actual purchase that will hit a future invoice.)
 *
 * The Kreditkort invoice category is flagged excludes_from_expense_total;
 * it is NOT a purchase, it's the invoice being paid now, so it does NOT
 * count as a future-invoice item.
 */
function isCreditPurchaseThisPeriod(expense: ExpenseForCalc): boolean {
  // The invoice-payment line is not a credit purchase
  if (expense.category?.excludes_from_expense_total === true) return false

  if (expense.is_ccm === true) return true
  if (expense.bank && expense.bank.toLowerCase() === 'amex') return true
  return false
}

/**
 * SPEND total — sum of everything. Nothing excluded.
 */
export function calcTotalSpend(expenses: ExpenseForCalc[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0)
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
 * A person's share of total spend.
 *   - personal → 100% to that person
 *   - partner  → 100% to the partner
 *   - shared   → split (default 50/50)
 *
 * @param perspective 'user' sums personal + half of shared
 *                     'partner' sums partner + half of shared
 */
export function calcPersonSpend(
  expenses: Array<ExpenseForCalc & { cost_assignment?: string | null }>,
  perspective: 'user' | 'partner'
): number {
  return expenses.reduce((sum, e) => {
    const assignment = e.cost_assignment || 'personal'
    if (assignment === 'shared') return sum + e.amount / 2
    if (perspective === 'user' && assignment === 'personal') return sum + e.amount
    if (perspective === 'partner' && assignment === 'partner') return sum + e.amount
    return sum
  }, 0)
}
