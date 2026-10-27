import { formatCurrency } from '@/lib/utils/formatters'
import { formatChange } from '@/lib/analytics/format'
import {
  isInvoiceLine,
  merchantTotals,
  relativeChange,
  type AnalyticsRow,
  type CategoryTotal,
} from '@/lib/analytics/analytics'

export type InsightTone = 'good' | 'warning' | 'neutral'

export interface Insight {
  id: string
  tone: InsightTone
  title: string
  text: string
  /** Opens the drilldown for this category when tapped. */
  categoryId?: string
  merchantKey?: string
}

interface InsightInput {
  rows: AnalyticsRow[]
  categories: CategoryTotal[]
  comparisonLabel: string
  /** Rows of the periods before the range (for "above your average"). */
  historyRows: AnalyticsRow[]
  historyPeriodCount: number
  periodCount: number
  /** Only for the running month: share of the period that has passed, 0–1. */
  periodProgress: number | null
  total: number
  /** Variable (non-invoice) spend and budget, for the pace projection. */
  variableSpent: number
  variableBudget: number
  income: number
}

const MIN_DELTA_KR = 500

/**
 * A handful of short, actionable observations. Ordered by how useful they
 * are; the page shows the first four.
 */
export function buildInsights(input: InsightInput): Insight[] {
  const out: Insight[] = []
  const variable = input.categories.filter((c) => c.costType === 'Variable')

  // 1. Pace in the running period. Only variable spending is projected:
  //    fixed costs land early in the period and would skew a linear forecast.
  if (input.periodProgress != null && input.variableBudget > 0 && input.periodProgress >= 0.15) {
    const projected = input.variableSpent / input.periodProgress
    const over = projected > input.variableBudget * 1.05
    out.push({
      id: 'pace',
      tone: over ? 'warning' : 'good',
      title: over ? 'Rörliga utgifter i takt att gå över' : 'Rörliga utgifter i fas med budgeten',
      text: `${Math.round(input.periodProgress * 100)} % av perioden har gått och ${Math.round((input.variableSpent / input.variableBudget) * 100)} % av den rörliga budgeten är använd. Prognos: ${formatCurrency(projected)} av ${formatCurrency(input.variableBudget)}.`,
    })
  }

  // 2. Biggest increase / decrease among variable categories.
  if (input.comparisonLabel) {
    const deltas = variable
      .map((c) => ({ c, delta: c.total - c.previous }))
      .filter((d) => d.c.previous > 0 && Math.abs(d.delta) >= MIN_DELTA_KR)
      .sort((a, b) => b.delta - a.delta)
    const up = deltas[0]
    if (up && up.delta > 0) {
      out.push({
        id: `up-${up.c.id}`,
        tone: 'warning',
        title: `${up.c.name} ökade mest`,
        text: `+${formatCurrency(up.delta)} (${formatChange(relativeChange(up.c.total, up.c.previous))}) jämfört med ${input.comparisonLabel}.`,
        categoryId: up.c.id,
      })
    }
    const down = deltas[deltas.length - 1]
    // A category not bought yet this period is not a real decrease.
    if (down && down.delta < 0 && down.c.total > 0) {
      out.push({
        id: `down-${down.c.id}`,
        tone: 'good',
        title: `${down.c.name} minskade mest`,
        text: `${formatCurrency(down.delta)} (${formatChange(relativeChange(down.c.total, down.c.previous))}) jämfört med ${input.comparisonLabel}.`,
        categoryId: down.c.id,
      })
    }
  }

  // 3. Category well above its own historical monthly average.
  if (input.historyPeriodCount >= 3) {
    const history = new Map<string, number>()
    for (const r of input.historyRows) {
      if (isInvoiceLine(r.expense)) continue
      const id = r.expense.category_id || 'none'
      history.set(id, (history.get(id) || 0) + r.value)
    }
    const above = variable
      .map((c) => {
        const avg = ((history.get(c.id) || 0) / input.historyPeriodCount) * input.periodCount
        return { c, avg, ratio: avg > 0 ? c.total / avg : 0 }
      })
      .filter((x) => x.avg >= 300 && x.ratio >= 1.25 && x.c.total - x.avg >= MIN_DELTA_KR)
      .sort((a, b) => b.c.total - b.avg - (a.c.total - a.avg))[0]
    if (above && !out.some((i) => i.categoryId === above.c.id)) {
      out.push({
        id: `avg-${above.c.id}`,
        tone: 'warning',
        title: `${above.c.name} över ditt snitt`,
        text: `${formatCurrency(above.c.total)} mot normalt ${formatCurrency(above.avg)} — ${Math.round((above.ratio - 1) * 100)} % mer än snittet för de ${input.historyPeriodCount} månaderna innan.`,
        categoryId: above.c.id,
      })
    }
  }

  // 4. Most frequent merchant.
  const merchants = merchantTotals(input.rows).sort((a, b) => b.count - a.count || b.total - a.total)
  const top = merchants[0]
  if (top && top.count >= 3) {
    out.push({
      id: `merchant-${top.key}`,
      tone: 'neutral',
      title: `Oftast: ${top.name}`,
      text: `${top.count} köp för totalt ${formatCurrency(top.total)} — i snitt ${formatCurrency(top.total / top.count)} per gång.`,
      merchantKey: top.key,
    })
  }

  // 5. Savings rate when income is known.
  if (input.income > 0 && input.total > 0) {
    const left = input.income - input.total
    out.push({
      id: 'left',
      tone: left >= 0 ? 'good' : 'warning',
      title: left >= 0 ? `${formatCurrency(left)} kvar av inkomsten` : `${formatCurrency(-left)} mer än inkomsten`,
      text: `Utgifterna motsvarar ${Math.round((input.total / input.income) * 100)} % av inkomsten under perioden.`,
    })
  }

  // 6. Uncategorised rows are an easy fix.
  const uncategorised = input.rows.filter((r) => !r.expense.category_id).length
  if (uncategorised > 0) {
    out.push({
      id: 'uncategorised',
      tone: 'warning',
      title: `${uncategorised} utan kategori`,
      text: 'De syns inte i kategorianalysen. Tryck för att kategorisera dem.',
      categoryId: 'none',
    })
  }

  return out
}
