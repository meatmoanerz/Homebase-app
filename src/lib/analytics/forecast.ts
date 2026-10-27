import { shiftPeriod } from '@/lib/utils/budget-period'
import { isInvoiceLine, periodsBetween, type AnalyticsRow } from '@/lib/analytics/analytics'

/**
 * Spending forecast per budget period.
 *
 * Per category:
 *  - Fixed / savings / credit-card invoice: median of the last 3 complete
 *    months (robust against one-off double payments).
 *  - Mortgage interest and amortisation: computed from the loans themselves
 *    (balance × rate / 12, shrinking with each amortisation).
 *  - Variable: mean of the last 6 complete months with a spread from how much
 *    those months varied. With ≥ 6 months of history a linear trend is fitted;
 *    a clear trend moves the forecast, damped so it never runs away.
 *  - No history but an active recurring expense: the recurring amount.
 * The running period = what is already spent + the expected remainder.
 */

export const MIN_TREND_MONTHS = 6
const TREND_WINDOW = 12
const VARIABLE_WINDOW = 6
const FIXED_WINDOW = 3
/** Each further month only carries this share of the previous month's trend step. */
const TREND_DAMPING = 0.8

export interface LoanInput {
  current_balance: number
  interest_rate: number
  monthly_amortization: number
  include_in_budget?: boolean | null
}

export interface RecurringInput {
  category_id: string
  amount: number
  is_active: boolean
}

export interface Trend {
  /** kr per month (positive = increasing). */
  slope: number
  /** Slope relative to the category's average, per month. */
  pctPerMonth: number
  r2: number
  months: number
  direction: 'up' | 'down'
}

export type ForecastMethod = 'median' | 'mean' | 'trend' | 'loan' | 'recurring'

export interface CategoryForecast {
  id: string
  name: string
  costType: string | null
  isInvoice: boolean
  method: ForecastMethod
  /** Complete-month history, oldest first. */
  history: Array<{ period: string; value: number }>
  average: number
  trend: Trend | null
  /** Forecast for the coming months (index 0 = next period). */
  ahead: Array<{ value: number; low: number; high: number }>
  /** Running period: spent so far and projected landing. */
  current: { actual: number; projected: number; low: number; high: number }
}

export interface ForecastMonth {
  period: string
  isCurrent: boolean
  /** Actually spent (only for the running period). */
  actual: number
  spend: number
  low: number
  high: number
  income: number | null
}

export interface ForecastResult {
  months: ForecastMonth[]
  categories: CategoryForecast[]
  historyPeriods: string[]
  enoughForTrends: boolean
}

interface ForecastInput {
  /** All rows for the selected person (any period), already category-filtered. */
  rows: AnalyticsRow[]
  currentPeriod: string
  earliestPeriod: string | null
  /** Share of the running period that has passed, 0–1. */
  periodProgress: number
  /** Months after the running one. */
  horizon: number
  loans: LoanInput[]
  recurring: RecurringInput[]
  /** Category filter, null = all. */
  categoryIds: Set<string> | null
  /** Known incomes per period (for the selected person). */
  incomeFor: (period: string) => number | null
  /** Category id → display data, for recurring-only categories. */
  categoryMeta: Map<string, { name: string; costType: string | null; isInvoice: boolean }>
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1))
}

/** Least-squares line through the values (x = 0..n-1). */
export function linearTrend(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, r2: 0 }
  const xm = (n - 1) / 2
  const ym = mean(values)
  let sxy = 0
  let sxx = 0
  let syy = 0
  values.forEach((y, x) => {
    sxy += (x - xm) * (y - ym)
    sxx += (x - xm) ** 2
    syy += (y - ym) ** 2
  })
  const slope = sxx ? sxy / sxx : 0
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0
  return { slope, intercept: ym - slope * xm, r2 }
}

/**
 * A trend worth showing: a reasonably good fit (R² ≥ 0.35) and a slope of at
 * least 50 kr and 3 % of the average per month.
 */
export function detectTrend(values: number[]): Trend | null {
  if (values.length < MIN_TREND_MONTHS) return null
  const window = values.slice(-TREND_WINDOW)
  const avg = mean(window)
  if (avg <= 0) return null
  const { slope, r2 } = linearTrend(window)
  if (r2 < 0.35 || Math.abs(slope) < Math.max(50, avg * 0.03)) return null
  return { slope, pctPerMonth: slope / avg, r2, months: window.length, direction: slope > 0 ? 'up' : 'down' }
}

/**
 * Complete periods usable as history: before the running period, from the
 * first one with meaningful data (a half-imported first month would drag
 * every average down).
 */
function historyPeriods(rows: AnalyticsRow[], earliest: string | null, current: string): string[] {
  if (!earliest || earliest >= current) return []
  const all = periodsBetween(earliest, shiftPeriod(current, -1))
  const totals = new Map<string, number>()
  for (const r of rows) totals.set(r.period, (totals.get(r.period) || 0) + r.expense.amount)
  const typical = median(all.map((p) => totals.get(p) || 0).filter((v) => v > 0))
  const firstFull = all.findIndex((p) => (totals.get(p) || 0) >= typical * 0.25)
  return firstFull < 0 ? [] : all.slice(firstFull).slice(-TREND_WINDOW)
}

const isInterestCategory = (name: string) => /ränta/i.test(name) && /(bolån|lån)/i.test(name)
const isAmortisationCategory = (name: string) => /amortering/i.test(name)

export function buildForecast(input: ForecastInput): ForecastResult {
  const { rows, currentPeriod, periodProgress, horizon } = input
  const history = historyPeriods(rows, input.earliestPeriod, currentPeriod)
  const historySet = new Set(history)
  const progress = Math.min(1, Math.max(0, periodProgress))

  // Per category: totals per history period, running-period actual, and the
  // share of amounts that belongs to the selected person (for loans).
  interface Acc {
    byPeriod: Map<string, number>
    current: number
    valueSum: number
    amountSum: number
    name: string
    costType: string | null
    isInvoice: boolean
  }
  const acc = new Map<string, Acc>()
  const get = (r: AnalyticsRow) => {
    const id = r.expense.category_id || 'none'
    let a = acc.get(id)
    if (!a) {
      a = {
        byPeriod: new Map(),
        current: 0,
        valueSum: 0,
        amountSum: 0,
        name: r.expense.category?.name || 'Utan kategori',
        costType: r.expense.category?.cost_type ?? null,
        isInvoice: isInvoiceLine(r.expense),
      }
      acc.set(id, a)
    }
    return a
  }
  for (const r of rows) {
    if (r.period === currentPeriod) {
      const a = get(r)
      a.current += r.value
    } else if (historySet.has(r.period)) {
      const a = get(r)
      a.byPeriod.set(r.period, (a.byPeriod.get(r.period) || 0) + r.value)
      a.valueSum += r.value
      a.amountSum += r.expense.amount
    }
  }

  // Recurring expenses for categories without any history.
  const recurringByCategory = new Map<string, number>()
  for (const re of input.recurring) {
    if (!re.is_active || (input.categoryIds && !input.categoryIds.has(re.category_id))) continue
    recurringByCategory.set(re.category_id, (recurringByCategory.get(re.category_id) || 0) + Number(re.amount))
  }
  for (const [id] of recurringByCategory) {
    if (acc.has(id)) continue
    const meta = input.categoryMeta.get(id)
    if (!meta) continue
    acc.set(id, { byPeriod: new Map(), current: 0, valueSum: 0, amountSum: 0, ...meta })
  }

  const budgetedLoans = input.loans.filter((l) => l.include_in_budget !== false && Number(l.current_balance) > 0)
  const loanMonth = (k: number) => {
    // k = months after the running period (0 = running period itself)
    let interest = 0
    let amortisation = 0
    for (const l of budgetedLoans) {
      const amort = Number(l.monthly_amortization) || 0
      const balance = Math.max(0, Number(l.current_balance) - amort * k)
      interest += (balance * (Number(l.interest_rate) || 0)) / 100 / 12
      amortisation += Math.min(amort, balance)
    }
    return { interest, amortisation }
  }

  const categories: CategoryForecast[] = []
  for (const [id, a] of acc) {
    const series = history.map((p) => a.byPeriod.get(p) || 0)
    const hasHistory = series.some((v) => v !== 0)
    const isFixedLike = a.costType !== 'Variable' || a.isInvoice
    const personRatio = a.amountSum > 0 ? a.valueSum / a.amountSum : 1
    const avg = mean(series)
    let method: ForecastMethod
    let trend: Trend | null = null
    let ahead: CategoryForecast['ahead']

    let loanKind: 'interest' | 'amortisation' | null = budgetedLoans.length > 0
      ? isInterestCategory(a.name) ? 'interest' : isAmortisationCategory(a.name) ? 'amortisation' : null
      : null
    // Trust the loans only when they explain the history: a loan missing from
    // the app would otherwise make the forecast far too low.
    if (loanKind && hasHistory) {
      const fromLoans = (loanKind === 'interest' ? loanMonth(0).interest : loanMonth(0).amortisation) * personRatio
      const historic = median(series.slice(-FIXED_WINDOW))
      if (historic > 0 && Math.abs(fromLoans - historic) / historic > 0.3) loanKind = null
    }

    if (loanKind) {
      method = 'loan'
      ahead = Array.from({ length: horizon }, (_, i) => {
        const m = loanMonth(i + 1)
        const v = (loanKind === 'interest' ? m.interest : m.amortisation) * personRatio
        return { value: v, low: v * 0.97, high: v * 1.03 }
      })
    } else if (!hasHistory) {
      const v = recurringByCategory.get(id) || 0
      if (v === 0 && a.current === 0) continue
      method = 'recurring'
      ahead = Array.from({ length: horizon }, () => ({ value: v, low: v, high: v }))
    } else if (isFixedLike) {
      method = 'median'
      const recent = series.slice(-FIXED_WINDOW)
      const base = median(recent)
      const lo = Math.min(...recent)
      const hi = Math.max(...recent)
      ahead = Array.from({ length: horizon }, () => ({
        value: base,
        low: Math.min(base, lo + (base - lo) * 0.5),
        high: Math.max(base, hi - (hi - base) * 0.5),
      }))
    } else {
      const recent = series.slice(-VARIABLE_WINDOW)
      const base = mean(recent)
      const spread = stdev(recent) * 0.8
      trend = detectTrend(series)
      method = trend ? 'trend' : 'mean'
      // A trend starts from the fitted end point, not the 6-month mean.
      const fit = trend ? linearTrend(series.slice(-TREND_WINDOW)) : null
      const start = fit ? fit.intercept + fit.slope * (Math.min(series.length, TREND_WINDOW) - 1) : base
      let drift = 0
      ahead = Array.from({ length: horizon }, (_, i) => {
        if (trend) drift += trend.slope * TREND_DAMPING ** i
        const value = Math.max(0, trend ? start + drift : base)
        const widen = 1 + 0.15 * i
        return { value, low: Math.max(0, value - spread * widen), high: value + spread * widen }
      })
    }

    // Running period: actual so far + expected remainder.
    const nextUp = ahead[0] ?? { value: 0, low: 0, high: 0 }
    let current: CategoryForecast['current']
    if (loanKind) {
      const m = loanMonth(0)
      const v = (loanKind === 'interest' ? m.interest : m.amortisation) * personRatio
      current = { actual: a.current, projected: Math.max(a.current, v), low: Math.max(a.current, v * 0.97), high: Math.max(a.current, v * 1.03) }
    } else if (isFixedLike || method === 'recurring') {
      current = {
        actual: a.current,
        projected: Math.max(a.current, nextUp.value),
        low: Math.max(a.current, nextUp.low),
        high: Math.max(a.current, nextUp.high),
      }
    } else {
      const left = 1 - progress
      current = {
        actual: a.current,
        projected: a.current + nextUp.value * left,
        low: a.current + nextUp.low * left,
        high: a.current + nextUp.high * left,
      }
    }

    categories.push({
      id,
      name: a.name,
      costType: a.costType,
      isInvoice: a.isInvoice,
      method,
      history: history.map((p, i) => ({ period: p, value: series[i] })),
      average: avg,
      trend,
      ahead,
      current,
    })
  }

  categories.sort((x, y) => (y.ahead[0]?.value ?? 0) - (x.ahead[0]?.value ?? 0))

  // Totals: independent categories → half-widths add in quadrature.
  const combine = (parts: Array<{ value: number; low: number; high: number }>) => {
    const value = parts.reduce((s, p) => s + p.value, 0)
    const down = Math.sqrt(parts.reduce((s, p) => s + (p.value - p.low) ** 2, 0))
    const up = Math.sqrt(parts.reduce((s, p) => s + (p.high - p.value) ** 2, 0))
    return { value, low: Math.max(0, value - down), high: value + up }
  }

  const knownIncomes = history.map((p) => input.incomeFor(p)).filter((v): v is number => v != null && v > 0)
  const typicalIncome = knownIncomes.length ? median(knownIncomes.slice(-3)) : null

  const months: ForecastMonth[] = []
  const cur = combine(categories.map((c) => ({ value: c.current.projected, low: c.current.low, high: c.current.high })))
  months.push({
    period: currentPeriod,
    isCurrent: true,
    actual: categories.reduce((s, c) => s + c.current.actual, 0),
    spend: cur.value,
    low: cur.low,
    high: cur.high,
    income: input.incomeFor(currentPeriod) ?? typicalIncome,
  })
  for (let i = 0; i < horizon; i++) {
    const period = shiftPeriod(currentPeriod, i + 1)
    const t = combine(categories.map((c) => c.ahead[i]))
    months.push({
      period,
      isCurrent: false,
      actual: 0,
      spend: t.value,
      low: t.low,
      high: t.high,
      income: input.incomeFor(period) ?? typicalIncome,
    })
  }

  return { months, categories, historyPeriods: history, enoughForTrends: history.length >= MIN_TREND_MONTHS }
}
