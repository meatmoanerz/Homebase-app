'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Info, ChevronRight, Activity } from 'lucide-react'
import { BottomSheet } from '@/components/shared/bottom-sheet'
import { ForecastChart, type ForecastPoint } from '@/components/analytics/forecast-chart'
import { formatCurrency } from '@/lib/utils/formatters'
import { shiftPeriod } from '@/lib/utils/budget-period'
import { formatPeriodShort } from '@/lib/analytics/format'
import { getBudgetStatus, budgetStatusBarClass } from '@/lib/utils/budget-status'
import {
  COVERAGE_THRESHOLD,
  MIN_TREND_MONTHS,
  type CategoryForecast,
  type ForecastResult,
  type Trend,
} from '@/lib/analytics/forecast'
import { cn } from '@/lib/utils/cn'

export type ForecastHorizon = 3 | 12

interface AnalyticsForecastViewProps {
  forecast: ForecastResult
  horizon: ForecastHorizon
  onHorizonChange: (h: ForecastHorizon) => void
  /** Budget for the running period (0 = none). */
  currentBudget: number
  showIncome: boolean
  /** Spent per history period, for the chart context. */
  historyTotals: Array<{ period: string; value: number; income: number | null }>
}

const METHOD_LABEL: Record<CategoryForecast['method'], string> = {
  median: 'median 3 mån',
  mean: 'snitt 6 mån',
  trend: 'trend',
  loan: 'från lånen',
  recurring: 'återkommande',
}

export function AnalyticsForecastView({
  forecast,
  horizon,
  onHorizonChange,
  currentBudget,
  showIncome,
  historyTotals,
}: AnalyticsForecastViewProps) {
  const [selected, setSelected] = useState<CategoryForecast | null>(null)
  const current = forecast.months[0]
  const future = forecast.months.slice(1)

  const chartData = useMemo<ForecastPoint[]>(() => [
    ...historyTotals.slice(-6).map((h) => ({
      period: h.period, kind: 'history' as const, actual: h.value, forecast: 0, low: null, high: null, income: h.income,
      incomplete: !forecast.historyPeriods.includes(h.period),
    })),
    {
      period: current.period, kind: 'current' as const, actual: current.actual,
      forecast: Math.max(0, current.spend - current.actual), low: current.low, high: current.high, income: current.income,
    },
    ...future.map((m) => ({
      period: m.period, kind: 'future' as const, actual: 0, forecast: m.spend, low: m.low, high: m.high, income: m.income,
    })),
  ], [historyTotals, current, future, forecast.historyPeriods])

  const futureSpend = future.reduce((s, m) => s + m.spend, 0)
  const futureIncome = future.every((m) => m.income != null) ? future.reduce((s, m) => s + (m.income ?? 0), 0) : null
  const status = currentBudget > 0 ? getBudgetStatus(current.spend, currentBudget) : null

  const fixed = forecast.categories.filter((c) => c.method === 'loan' || c.costType !== 'Variable' || c.isInvoice)
  const variable = forecast.categories.filter((c) => !fixed.includes(c))
  const trends = forecast.categories
    .filter((c) => c.trend)
    .sort((a, b) => Math.abs(b.trend!.slope) - Math.abs(a.trend!.slope))

  if (forecast.historyPeriods.length < 2) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 text-center shadow-sm">
        <Activity className="w-8 h-8 mx-auto text-muted-foreground/50 mb-3" />
        <p className="font-medium">För lite historik för en prognos</p>
        <p className="text-sm text-muted-foreground mt-1">Prognosen behöver minst två hela månader med utgifter.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Running period */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-3xl px-5 py-5 md:px-6 shadow-sm"
      >
        <div className="label-caps text-muted-foreground capitalize">{formatPeriodShort(current.period, true)} landar på</div>
        <div className="font-serif-hero text-[40px] md:text-[46px] leading-[1.05] mt-1">~{formatCurrency(current.spend)}</div>
        <div className="text-[12px] text-muted-foreground mt-1">
          troligen {formatCurrency(current.low)} – {formatCurrency(current.high)} · {formatCurrency(current.actual)} spenderat hittills
        </div>

        {currentBudget > 0 && status && (
          <div className="mt-4">
            <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn('absolute inset-y-0 left-0 rounded-full opacity-35', budgetStatusBarClass(status))}
                style={{ width: `${Math.min(100, (current.spend / currentBudget) * 100)}%` }}
              />
              <div
                className={cn('absolute inset-y-0 left-0 rounded-full', budgetStatusBarClass(status))}
                style={{ width: `${Math.min(100, (current.actual / currentBudget) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between gap-3 text-[12px] text-muted-foreground mt-1.5">
              <span>Budget {formatCurrency(currentBudget)}</span>
              <span className={cn('shrink-0', status === 'over' && 'text-destructive', status === 'complete' && 'text-hb-green')}>
                {current.spend <= currentBudget
                  ? `~${formatCurrency(currentBudget - current.spend)} kvar vid periodslut`
                  : `~${formatCurrency(current.spend - currentBudget)} över`}
              </span>
            </div>
          </div>
        )}
      </motion.section>

      {/* Chart */}
      <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="font-serif text-[19px] font-medium tracking-tight">Framåt</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">6 månader bakåt, {horizon} framåt</p>
          </div>
          <div className="flex gap-0.5 bg-secondary rounded-full p-0.5 text-[12px] shrink-0">
            {([3, 12] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => onHorizonChange(h)}
                className={cn('px-3 py-1 rounded-full transition-colors', horizon === h ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground')}
              >
                {h} mån
              </button>
            ))}
          </div>
        </div>
        <ForecastChart data={chartData} showIncome={showIncome} height={230} />
      </section>

      {/* Horizon summary */}
      <section className="grid grid-cols-3 gap-2" aria-label="Prognos summerad">
        <Tile label={`Utgifter ${horizon} mån`} value={formatCurrency(futureSpend)} />
        <Tile label="Inkomst" value={showIncome && futureIncome != null ? formatCurrency(futureIncome) : '–'} />
        <Tile
          label="Kvar"
          value={showIncome && futureIncome != null ? formatCurrency(futureIncome - futureSpend) : '–'}
          tone={showIncome && futureIncome != null ? (futureIncome - futureSpend >= 0 ? 'good' : 'bad') : undefined}
        />
      </section>

      {/* Trends */}
      <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
        <h2 className="font-serif text-[19px] font-medium tracking-tight">Trender</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Kategorier som stadigt ökar eller minskar månad för månad
        </p>
        {!forecast.enoughForTrends ? (
          <div className="mt-3 rounded-2xl bg-secondary/50 px-3.5 py-3 text-[13px] text-muted-foreground flex gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Trender visas när det finns {MIN_TREND_MONTHS} hela månader att jämföra — nu finns {forecast.historyPeriods.length}.
            </span>
          </div>
        ) : trends.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3">Inga tydliga trender — utgifterna per kategori är stabila.</p>
        ) : (
          <ul className="mt-2 -mx-1">
            {trends.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className="w-full flex items-center gap-3 px-1 py-2.5 rounded-xl hover:bg-secondary/50 text-left"
                >
                  <TrendBadge trend={c.trend!} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-medium truncate">{c.name}</span>
                    <span className="block text-[11px] text-muted-foreground">{trendText(c.trend!)}</span>
                  </span>
                  <Sparkline values={c.history.map((h) => h.value)} up={c.trend!.direction === 'up'} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Per-category forecast for next month */}
      {future[0] && (
        <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-[19px] font-medium tracking-tight capitalize">{formatPeriodShort(future[0].period, true)}</h2>
            <span className="text-xs text-muted-foreground">~{formatCurrency(future[0].spend)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Prognos per kategori</p>
          <CategoryGroup title="Fasta, lån och sparande" items={fixed} onSelect={setSelected} />
          <CategoryGroup title="Rörliga" items={variable} onSelect={setSelected} showRange />
        </section>
      )}

      <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
        Prognosen bygger på {forecast.historyPeriods.length} hela månader ({periodList(forecast.historyPeriods)}): fasta
        kostnader som median av de senaste tre, ränta och amortering från lånen, rörliga som snitt av de senaste sex med
        spann efter hur mycket månaderna varierat{forecast.enoughForTrends ? ' och tydliga trender (dämpade framåt)' : ''}.
        {forecast.excludedPeriods.length > 0 && (
          <>
            {' '}Utelämnade: {periodList(forecast.excludedPeriods)} — för få transaktioner eller dagar med köp jämfört med en
            typisk månad (under {Math.round(COVERAGE_THRESHOLD * 100)} %), troligen ofullständigt importerade.
          </>
        )}
      </p>

      <CategoryForecastSheet category={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="bg-card border border-border rounded-2xl px-3 py-2.5 shadow-sm">
      <div className="text-[11px] text-muted-foreground truncate">{label}</div>
      <div className={cn('font-serif-kpi text-[14px] md:text-[16px] leading-tight mt-0.5 break-words', tone === 'good' && 'text-hb-green', tone === 'bad' && 'text-destructive')}>
        {value}
      </div>
    </div>
  )
}

function CategoryGroup({
  title,
  items,
  onSelect,
  showRange,
}: {
  title: string
  items: CategoryForecast[]
  onSelect: (c: CategoryForecast) => void
  showRange?: boolean
}) {
  const visible = items.filter((c) => (c.ahead[0]?.value ?? 0) >= 1)
  if (visible.length === 0) return null
  const sum = visible.reduce((s, c) => s + c.ahead[0].value, 0)
  return (
    <div className="mt-4">
      <div className="flex justify-between label-caps text-muted-foreground mb-1">
        <span>{title}</span>
        <span>{formatCurrency(sum)}</span>
      </div>
      <ul className="-mx-1">
        {visible.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c)}
              className="w-full flex items-center gap-2 px-1 py-2 rounded-xl hover:bg-secondary/50 text-left"
            >
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-[14px] font-medium truncate">{c.name}</span>
                  {c.trend && (c.trend.direction === 'up'
                    ? <TrendingUp className="w-3.5 h-3.5 text-destructive shrink-0" aria-label="ökande" />
                    : <TrendingDown className="w-3.5 h-3.5 text-hb-green shrink-0" aria-label="minskande" />)}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {METHOD_LABEL[c.method]}
                  {showRange && ` · ${formatCurrency(c.ahead[0].low)}–${formatCurrency(c.ahead[0].high)}`}
                </span>
              </span>
              <span className="font-serif text-[15px] font-medium shrink-0">{formatCurrency(c.ahead[0].value)}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function trendText(t: Trend): string {
  const sign = t.slope > 0 ? 'ökar' : 'minskar'
  return `${sign} ~${formatCurrency(Math.abs(t.slope))}/mån (${Math.round(Math.abs(t.pctPerMonth) * 100)} %) senaste ${t.months} mån`
}

function TrendBadge({ trend }: { trend: Trend }) {
  const up = trend.direction === 'up'
  return (
    <span
      className={cn(
        'w-8 h-8 rounded-xl grid place-items-center shrink-0',
        up ? 'bg-destructive/10 text-destructive' : 'bg-hb-green/15 text-hb-green'
      )}
    >
      {up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
    </span>
  )
}

/** Tiny inline line of monthly values; the last point is marked. */
export function Sparkline({ values, up, width = 72, height = 26 }: { values: number[]; up?: boolean; width?: number; height?: number }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6)
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const last = values.length - 1
  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden="true">
      <polyline points={points} fill="none" stroke="var(--chart-spend)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={3} fill={up ? 'var(--destructive)' : 'var(--hb-green)'} stroke="var(--card)" strokeWidth={1.5} />
    </svg>
  )
}

function CategoryForecastSheet({ category, onOpenChange }: { category: CategoryForecast | null; onOpenChange: (open: boolean) => void }) {
  const data: ForecastPoint[] = !category ? [] : [
    ...category.history.map((h) => ({ period: h.period, kind: 'history' as const, actual: h.value, forecast: 0, low: null, high: null, income: null })),
    {
      period: shiftPeriod(category.history[category.history.length - 1]?.period ?? '', 1),
      kind: 'current' as const,
      actual: category.current.actual,
      forecast: Math.max(0, category.current.projected - category.current.actual),
      low: category.current.low,
      high: category.current.high,
      income: null,
    },
    ...category.ahead.slice(0, 6).map((a, i) => ({
      // ahead[0] is the period after the running one
      period: shiftPeriod(category.history[category.history.length - 1]?.period ?? '', i + 2),
      kind: 'future' as const,
      actual: 0,
      forecast: a.value,
      low: a.low,
      high: a.high,
      income: null,
    })),
  ]

  return (
    <BottomSheet
      open={!!category}
      onOpenChange={onOpenChange}
      title={category?.name}
      subtitle={category ? `Prognos · ${METHOD_LABEL[category.method]}` : undefined}
    >
      {category && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-secondary/40 rounded-2xl px-3 py-2.5">
              <div className="text-[11px] text-muted-foreground">Nästa månad</div>
              <div className="font-serif-kpi text-[20px] mt-0.5">~{formatCurrency(category.ahead[0]?.value ?? 0)}</div>
            </div>
            <div className="bg-secondary/40 rounded-2xl px-3 py-2.5">
              <div className="text-[11px] text-muted-foreground">Snitt historik</div>
              <div className="font-serif-kpi text-[20px] mt-0.5">{formatCurrency(category.average)}</div>
            </div>
          </div>
          {category.trend ? (
            <div className={cn('rounded-2xl px-3.5 py-3 text-[13px] flex gap-2.5', category.trend.direction === 'up' ? 'bg-destructive/8 text-destructive' : 'bg-hb-green/10 text-hb-green')}>
              {category.trend.direction === 'up' ? <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" /> : <TrendingDown className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>
                {category.name} {trendText(category.trend)}. Prognosen följer trenden men dämpas för varje månad framåt.
              </span>
            </div>
          ) : category.method === 'mean' && category.history.length >= MIN_TREND_MONTHS ? (
            <p className="text-[13px] text-muted-foreground">Ingen tydlig trend — månaderna varierar runt snittet.</p>
          ) : null}
          <ForecastChart data={data} height={180} />
          <div className="text-[12px] text-muted-foreground">
            Spann nästa månad: {formatCurrency(category.ahead[0]?.low ?? 0)} – {formatCurrency(category.ahead[0]?.high ?? 0)}
          </div>
        </div>
      )}
    </BottomSheet>
  )
}

/** "feb, jun–okt" — consecutive months collapsed into ranges. */
function periodList(periods: string[]): string {
  const parts: string[] = []
  let runStart = 0
  for (let i = 1; i <= periods.length; i++) {
    if (i < periods.length && periods[i] === shiftPeriod(periods[i - 1], 1)) continue
    const first = formatPeriodShort(periods[runStart])
    const last = formatPeriodShort(periods[i - 1])
    parts.push(i - 1 === runStart ? first : `${first}–${last}`)
    runStart = i
  }
  return parts.join(', ')
}
