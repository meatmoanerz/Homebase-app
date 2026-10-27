import { getBudgetPeriod, shiftPeriod } from '@/lib/utils/budget-period'
import { splitBudgetItem, type SplittableBudgetItem } from '@/lib/utils/budget-split'
import type { ExpenseWithCategory } from '@/types'
import type { Perspective } from '@/hooks/use-perspective'

/**
 * Pure aggregation helpers for the Analys page. Everything works on budget
 * periods (salary day → salary day), never calendar months.
 */

export type Timeframe = 'month' | 'ytd' | '12m' | 'all'

export type CategoryGroup = 'Variable' | 'Fixed' | 'Savings' | 'all'

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  month: 'Månad',
  ytd: 'I år',
  '12m': '12 mån',
  all: 'Allt',
}

/** Periods from start to end inclusive, oldest first (YYYY-MM strings). */
export function periodsBetween(start: string, end: string): string[] {
  if (start > end) return []
  const out: string[] = []
  let p = start
  while (p <= end && out.length < 600) {
    out.push(p)
    p = shiftPeriod(p, 1)
  }
  return out
}

/**
 * Periods covered by a timeframe, oldest first.
 * `anchor` is the selected period in month view and the current period otherwise.
 */
export function timeframePeriods(
  timeframe: Timeframe,
  anchor: string,
  currentPeriod: string,
  earliestPeriod: string | null
): string[] {
  switch (timeframe) {
    case 'month':
      return [anchor]
    case 'ytd':
      return periodsBetween(`${currentPeriod.slice(0, 4)}-01`, currentPeriod)
    case '12m':
      return periodsBetween(shiftPeriod(currentPeriod, -11), currentPeriod)
    case 'all':
      return periodsBetween(earliestPeriod && earliestPeriod < currentPeriod ? earliestPeriod : currentPeriod, currentPeriod)
  }
}

/**
 * The equally long range to compare against: previous month, the same
 * months last year (I år), or the 12 months before. 'all' has none.
 */
export function comparisonPeriods(timeframe: Timeframe, periods: string[]): string[] {
  if (periods.length === 0 || timeframe === 'all') return []
  if (timeframe === 'ytd') return periods.map((p) => shiftPeriod(p, -12))
  return periods.map((p) => shiftPeriod(p, -periods.length))
}

export function comparisonLabel(timeframe: Timeframe, runningMonth = false): string {
  switch (timeframe) {
    case 'month': return runningMonth ? 'samma tid förra månaden' : 'förra månaden'
    case 'ytd': return 'samma period i fjol'
    case '12m': return 'föregående 12 mån'
    case 'all': return ''
  }
}

/**
 * Share of an expense that belongs to the chosen person.
 * cost_assignment is relative to the row's owner (user_id): 'personal' is the
 * owner's, 'partner' is the owner's partner's, 'shared' is split 50/50.
 */
export function personShare(
  expense: Pick<ExpenseWithCategory, 'user_id' | 'cost_assignment'>,
  person: Perspective,
  viewerId: string | undefined
): number {
  if (person === 'all') return 1
  const assignment = expense.cost_assignment || 'personal'
  if (assignment === 'shared') return 0.5
  const ownerIsViewer = expense.user_id === viewerId
  const belongsToViewer = assignment === 'personal' ? ownerIsViewer : !ownerIsViewer
  return (person === 'me') === belongsToViewer ? 1 : 0
}

/** The credit-card invoice line (Kreditkort) — not a purchase in itself. */
export function isInvoiceLine(expense: Pick<ExpenseWithCategory, 'category'>): boolean {
  return expense.category?.excludes_from_expense_total === true
}

export interface AnalyticsRow {
  expense: ExpenseWithCategory
  period: string
  /** Amount attributed to the selected person (full amount for 'all'). */
  value: number
}

/** Map every expense to its budget period and the selected person's share. */
export function toRows(
  expenses: ExpenseWithCategory[],
  salaryDay: number,
  person: Perspective,
  viewerId: string | undefined
): AnalyticsRow[] {
  const periodByDate = new Map<string, string>()
  const rows: AnalyticsRow[] = []
  for (const expense of expenses) {
    const share = personShare(expense, person, viewerId)
    if (share === 0) continue
    let period = periodByDate.get(expense.date)
    if (!period) {
      period = getBudgetPeriod(new Date(`${expense.date}T00:00:00`), salaryDay).period
      periodByDate.set(expense.date, period)
    }
    rows.push({ expense, period, value: expense.amount * share })
  }
  return rows
}

export function filterRows(
  rows: AnalyticsRow[],
  periods: Set<string>,
  categoryIds: Set<string> | null
): AnalyticsRow[] {
  return rows.filter(
    (r) => periods.has(r.period) && (!categoryIds || categoryIds.has(r.expense.category_id || ''))
  )
}

export function sumRows(rows: AnalyticsRow[]): number {
  return rows.reduce((s, r) => s + r.value, 0)
}

export function totalsByPeriod(rows: AnalyticsRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rows) map.set(r.period, (map.get(r.period) || 0) + r.value)
  return map
}

export interface CategoryTotal {
  id: string
  name: string
  costType: string | null
  total: number
  count: number
  previous: number
}

/**
 * Totals per category for the current range, with the comparison range's
 * total alongside. The Kreditkort invoice line is always left out: its
 * purchases are already counted in their own categories.
 */
export function categoryTotals(rows: AnalyticsRow[], previousRows: AnalyticsRow[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>()
  const entry = (r: AnalyticsRow) => {
    const id = r.expense.category_id || 'none'
    let item = map.get(id)
    if (!item) {
      item = {
        id,
        name: r.expense.category?.name || 'Okategoriserat',
        costType: r.expense.category?.cost_type ?? null,
        total: 0,
        count: 0,
        previous: 0,
      }
      map.set(id, item)
    }
    return item
  }
  for (const r of rows) {
    if (isInvoiceLine(r.expense)) continue
    const item = entry(r)
    item.total += r.value
    item.count++
  }
  for (const r of previousRows) {
    if (isInvoiceLine(r.expense)) continue
    entry(r).previous += r.value
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

/** Normalise a bank description to a merchant key ("ICA NARA 1234 STHLM" → "ica nara"). */
export function merchantKey(description: string): string {
  const cleaned = description
    .toLowerCase()
    .replace(/^(k\*|zettle_\*|izettle\*|sumup\s*\*|paypal\s*\*|klarna\s*\*)/, '')
    .replace(/[0-9*#/\\.,:;_()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.split(' ').slice(0, 2).join(' ') || description.toLowerCase()
}

export interface MerchantTotal {
  key: string
  name: string
  total: number
  count: number
}

/** Most frequent merchants among purchases (fixed costs and the invoice line excluded). */
export function merchantTotals(rows: AnalyticsRow[]): MerchantTotal[] {
  const map = new Map<string, MerchantTotal & { names: Map<string, number> }>()
  for (const r of rows) {
    if (isInvoiceLine(r.expense) || r.expense.category?.cost_type !== 'Variable') continue
    const key = merchantKey(r.expense.description)
    let item = map.get(key)
    if (!item) {
      item = { key, name: r.expense.description, total: 0, count: 0, names: new Map() }
      map.set(key, item)
    }
    item.total += r.value
    item.count++
    item.names.set(r.expense.description, (item.names.get(r.expense.description) || 0) + 1)
  }
  return [...map.values()].map(({ names, ...m }) => {
    const best = [...names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? m.name
    return { ...m, name: tidyMerchantName(best) }
  })
}

function tidyMerchantName(description: string): string {
  const base = description.replace(/^(K\*|ZETTLE_\*|IZETTLE\*)/i, '').replace(/\s+\d[\d\s/.-]*$/, '').trim()
  const name = base || description
  // Bank exports are often SHOUTING — make them readable.
  if (name === name.toUpperCase()) {
    // Short words are usually acronyms (SL, H&M, SJ) — keep those as they are.
    return name
      .split(' ')
      .map((w) => (w.length <= 3 ? w : w.charAt(0) + w.slice(1).toLowerCase()))
      .join(' ')
  }
  return name
}

export interface BudgetLike {
  period: string
  budget_items?: Array<SplittableBudgetItem & { category_id: string | null }>
}

/** Budgeted amount for the periods, optional categories and person. */
export function budgetTotal(
  budgets: BudgetLike[],
  periods: Set<string>,
  categoryIds: Set<string> | null,
  person: Perspective,
  userId: string | undefined,
  partnerId: string | undefined | null
): { total: number; budgetedPeriods: Set<string> } {
  let total = 0
  const budgetedPeriods = new Set<string>()
  for (const b of budgets) {
    if (!periods.has(b.period)) continue
    const items = (b.budget_items || []).filter((i) => !categoryIds || categoryIds.has(i.category_id || ''))
    if ((b.budget_items || []).length > 0) budgetedPeriods.add(b.period)
    for (const item of items) {
      if (person === 'all') total += item.amount
      else {
        const split = splitBudgetItem(item, userId, partnerId)
        total += person === 'me' ? split.user : split.partner
      }
    }
  }
  return { total, budgetedPeriods }
}

/** Relative change, null when there is nothing to compare against. */
export function relativeChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return (current - previous) / previous
}
