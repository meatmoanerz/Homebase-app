/**
 * Budget consumption status shared by every progress bar that compares
 * actual spending against a budget.
 *
 * Spending within ±5 % of the budget counts as "complete" (green): a fixed
 * cost that landed on, or a few kronor around, its budget is done — not a
 * warning. Only spending beyond +5 % is "over".
 */
export const BUDGET_TOLERANCE = 0.05

export type BudgetStatus = 'under' | 'near' | 'complete' | 'over'

export function getBudgetStatus(actual: number, budget: number): BudgetStatus {
  if (budget <= 0) return actual > 0 ? 'over' : 'under'
  const ratio = actual / budget
  if (ratio > 1 + BUDGET_TOLERANCE) return 'over'
  if (ratio >= 1 - BUDGET_TOLERANCE) return 'complete'
  if (ratio >= 0.8) return 'near'
  return 'under'
}

/** Tailwind background class for a progress bar fill. */
export function budgetStatusBarClass(status: BudgetStatus, underClass = 'bg-hb-olive'): string {
  switch (status) {
    case 'over': return 'bg-destructive'
    case 'complete': return 'bg-hb-green'
    case 'near': return 'bg-hb-amber'
    default: return underClass
  }
}

/** Tailwind text class for the amount label, empty when no emphasis is needed. */
export function budgetStatusTextClass(status: BudgetStatus): string {
  if (status === 'over') return 'text-destructive'
  if (status === 'complete') return 'text-hb-green'
  return ''
}
