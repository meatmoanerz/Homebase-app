/**
 * Two parallel KPIs in Homebase — kept strictly separate.
 *
 * 1. SPEND TRACKING ("vad har vi köpt") — the MAIN KPI
 *    Sum of all expenses, EXCLUDING those whose category is flagged
 *    excludes_from_expense_total (the "Kreditkort" category, which is just
 *    the Amex invoice payment — counting it would double-count the
 *    underlying purchases). Measured against budget.
 *
 * 2. CASH FLOW ("vad dras från kontot just nu") — secondary
 *    Income minus *direct* withdrawals. Credit-card purchases are
 *    excluded because they hit a future invoice, not the account today.
 *
 *    A purchase counts as a direct withdrawal unless it's on credit:
 *      - is_ccm = true            → on credit, excluded
 *      - bank = 'Amex'            → on credit, excluded
 *      - bank IN (SEB, Swedbank)  → direct, counted
 *      - bank = null & !is_ccm    → assume direct, counted
 */

export interface ExpenseForCalc {
  amount: number
  is_ccm?: boolean | null
  bank?: string | null
  category?: {
    cost_type?: string | null
    excludes_from_expense_total?: boolean | null
  } | null
}

/**
 * Returns true if an expense should be counted as a direct withdrawal
 * from the bank account this period (i.e. affects cash flow now).
 */
export function isDirectWithdrawal(expense: ExpenseForCalc): boolean {
  // On credit → not a direct withdrawal
  if (expense.is_ccm === true) return false
  if (expense.bank && expense.bank.toLowerCase() === 'amex') return false

  // Everything else (SEB, Swedbank, or unknown non-credit) → direct
  return true
}

/**
 * Returns true if an expense should be excluded from spend-tracking totals.
 * (The Kreditkort category — the invoice payment line.)
 */
export function isExcludedFromSpend(expense: ExpenseForCalc): boolean {
  return expense.category?.excludes_from_expense_total === true
}

/**
 * SPEND TRACKING total — all expenses except the credit-card invoice category.
 */
export function calcTotalSpend(expenses: ExpenseForCalc[]): number {
  return expenses.reduce((sum, e) => {
    if (isExcludedFromSpend(e)) return sum
    return sum + e.amount
  }, 0)
}

/**
 * CASH FLOW out — only direct withdrawals (excludes credit-card purchases
 * AND the invoice-payment category to avoid double counting).
 */
export function calcCashOut(expenses: ExpenseForCalc[]): number {
  return expenses.reduce((sum, e) => {
    if (isExcludedFromSpend(e)) return sum
    if (!isDirectWithdrawal(e)) return sum
    return sum + e.amount
  }, 0)
}

/**
 * Net cash flow this period = income that landed on the account minus
 * direct withdrawals.
 */
export function calcCashFlow(income: number, expenses: ExpenseForCalc[]): number {
  return income - calcCashOut(expenses)
}
