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
 *  - Credit-card invoice with purchases already on it: the known invoice
 *    (entered amount, or registered purchases + the days still to come).
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

export type ForecastMethod = 'median' | 'mean' | 'trend' | 'loan' | 'recurring' | 'invoice'

/** A credit-card invoice paid in a period, as far as it is known (see knownCardInvoices). */
export interface KnownInvoice {
  value: number
  low: number
  high: number
  /** Entered invoice amounts and purchases already registered on the invoices. */
  registered: number
  /** Expected purchases for the days not imported yet. */
  estimated: number
}

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
  /** Known credit-card invoice for the next period (selected person's share). */
  knownInvoice?: KnownInvoice
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
  /** Complete periods left out because they had too little data. */
  excludedPeriods: string[]
  coverage: PeriodCoverage[]
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
  /**
   * Unfiltered household rows used to judge which months have complete data.
   * Defaults to `rows`; pass the full set so a category filter or a single
   * person's view doesn't make a complete month look empty.
   */
  coverageRows?: AnalyticsRow[]
  /** Credit-card invoices already known per budget period, household totals. */
  cardInvoices?: Map<string, KnownInvoice>
}

export interface PeriodCoverage {
  period: string
  count: number
  days: number
  reliable: boolean
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

/** Least-squares line through the points (x defaults to 0..n-1). */
export function linearTrend(values: number[], xs?: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, r2: 0 }
  const x = xs ?? values.map((_, i) => i)
  const xm = mean(x)
  const ym = mean(values)
  let sxy = 0
  let sxx = 0
  let syy = 0
  values.forEach((y, i) => {
    sxy += (x[i] - xm) * (y - ym)
    sxx += (x[i] - xm) ** 2
    syy += (y - ym) ** 2
  })
  const slope = sxx ? sxy / sxx : 0
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0
  return { slope, intercept: ym - slope * xm, r2 }
}

/**
 * A trend worth showing: a reasonably good fit (R² ≥ 0.35) and a slope of at
 * least 50 kr and 3 % of the average per month. `xs` are month positions, so
 * skipped (incomplete) months keep their real distance in time.
 */
export function detectTrend(values: number[], xs?: number[]): Trend | null {
  if (values.length < MIN_TREND_MONTHS) return null
  const window = values.slice(-TREND_WINDOW)
  const windowX = xs?.slice(-TREND_WINDOW)
  const avg = mean(window)
  if (avg <= 0) return null
  const { slope, r2 } = linearTrend(window, windowX)
  if (r2 < 0.35 || Math.abs(slope) < Math.max(50, avg * 0.03)) return null
  return { slope, pctPerMonth: slope / avg, r2, months: window.length, direction: slope > 0 ? 'up' : 'down' }
}

/** Share of the typical month a period must reach to count as complete. */
export const COVERAGE_THRESHOLD = 0.5
const COVERAGE_LOOKBACK = 24

/**
 * Data completeness per finished period. A month counts as complete when it
 * has at least half of the typical number of transactions AND half of the
 * typical number of days with transactions, where "typical" is the median
 * over all months that have data. It measures how complete the import is,
 * not how much was spent: a cheap but fully imported month still counts,
 * a half-imported or empty one does not. The reference follows the data, so
 * the rule adapts as more banks and cards are imported.
 */
export function assessCoverage(rows: AnalyticsRow[], earliest: string | null, current: string): PeriodCoverage[] {
  if (!earliest || earliest >= current) return []
  const periods = periodsBetween(earliest, shiftPeriod(current, -1)).slice(-COVERAGE_LOOKBACK)
  const counts = new Map<string, number>()
  const days = new Map<string, Set<string>>()
  for (const r of rows) {
    counts.set(r.period, (counts.get(r.period) || 0) + 1)
    let d = days.get(r.period)
    if (!d) {
      d = new Set()
      days.set(r.period, d)
    }
    d.add(r.expense.date)
  }
  const withData = periods.filter((p) => (counts.get(p) || 0) > 0)
  const refCount = median(withData.map((p) => counts.get(p) || 0))
  const refDays = median(withData.map((p) => days.get(p)?.size || 0))
  // With very little history there is no meaningful "typical" month yet.
  const judge = withData.length >= 3
  return periods.map((p) => {
    const count = counts.get(p) || 0
    const dayCount = days.get(p)?.size || 0
    const reliable = count > 0 && (!judge || (count >= refCount * COVERAGE_THRESHOLD && dayCount >= refDays * COVERAGE_THRESHOLD))
    return { period: p, count, days: dayCount, reliable }
  })
}

/** Months between two periods (2026-02 → 2026-06 = 4). */
function monthIndex(period: string): number {
  const [y, m] = period.split('-').map(Number)
  return y * 12 + (m - 1)
}

const isInterestCategory = (name: string) => /ränta/i.test(name) && /(bolån|lån)/i.test(name)
const isAmortisationCategory = (name: string) => /amortering/i.test(name)

export function buildForecast(input: ForecastInput): ForecastResult {
  const { rows, currentPeriod, periodProgress, horizon } = input
  const coverage = assessCoverage(input.coverageRows ?? rows, input.earliestPeriod, currentPeriod)
  const history = coverage.filter((c) => c.reliable).map((c) => c.period).slice(-TREND_WINDOW)
  const excludedPeriods = coverage
    .filter((c) => !c.reliable && (history.length === 0 || c.period >= history[0]))
    .map((c) => c.period)
  const historyX = history.map(monthIndex)
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

  // Known card invoices go to one invoice category (the household's main
  // Kreditkort line), so two partners' invoice categories don't both get them.
  const invoiceCategoryId = input.cardInvoices?.size
    ? [...acc].filter(([, a]) => a.isInvoice).sort((x, y) => y[1].amountSum - x[1].amountSum)[0]?.[0]
    : undefined

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
      trend = detectTrend(series, historyX)
      method = trend ? 'trend' : 'mean'
      // A trend starts from the fitted end point, not the 6-month mean.
      const fit = trend ? linearTrend(series.slice(-TREND_WINDOW), historyX.slice(-TREND_WINDOW)) : null
      // Fitted value at the last complete month, then stepped forward from there.
      const start = fit ? fit.intercept + fit.slope * historyX[historyX.length - 1] : base
      // Damped steps from the last complete month to the target month.
      const lastX = historyX[historyX.length - 1]
      const currentX = monthIndex(currentPeriod)
      const drift = (steps: number) => {
        let d = 0
        for (let j = 0; j < steps; j++) d += (trend?.slope ?? 0) * TREND_DAMPING ** j
        return d
      }
      ahead = Array.from({ length: horizon }, (_, i) => {
        const value = Math.max(0, trend ? start + drift(currentX + i + 1 - lastX) : base)
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

    // Card invoices: what is already on them beats the median.
    let knownInvoice: KnownInvoice | undefined
    if (id === invoiceCategoryId && input.cardInvoices) {
      const share = (k: KnownInvoice): KnownInvoice => ({
        value: k.value * personRatio,
        low: k.low * personRatio,
        high: k.high * personRatio,
        registered: k.registered * personRatio,
        estimated: k.estimated * personRatio,
      })
      ahead = ahead.map((step, i) => {
        const k = input.cardInvoices!.get(shiftPeriod(currentPeriod, i + 1))
        return k ? share(k) : step
      })
      const next = input.cardInvoices.get(shiftPeriod(currentPeriod, 1))
      if (next) {
        method = 'invoice'
        knownInvoice = share(next)
      }
      const now = input.cardInvoices.get(currentPeriod)
      if (now) {
        const k = share(now)
        current = {
          actual: a.current,
          projected: Math.max(a.current, k.value),
          low: Math.max(a.current, k.low),
          high: Math.max(a.current, k.high),
        }
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
      knownInvoice,
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

  return {
    months,
    categories,
    historyPeriods: history,
    excludedPeriods,
    coverage,
    enoughForTrends: history.length >= MIN_TREND_MONTHS,
  }
}
