'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Store,
  Receipt,
  ListFilter,
} from 'lucide-react'
import { useUser, usePartner } from '@/hooks/use-user'
import { usePerspective } from '@/hooks/use-perspective'
import { useBudgets } from '@/hooks/use-budgets'
import { useAllExpenses, usePeriodIncomes } from '@/hooks/use-analytics'
import { getBudgetPeriod, getCurrentBudgetPeriod, getPeriodDates, getPeriodProgress, shiftPeriod } from '@/lib/utils/budget-period'
import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns'
import { formatCurrency } from '@/lib/utils/formatters'
import { getBudgetStatus, budgetStatusBarClass } from '@/lib/utils/budget-status'
import {
  TIMEFRAME_LABELS,
  budgetTotal,
  categoryTotals,
  comparisonLabel as getComparisonLabel,
  comparisonPeriods,
  filterRows,
  isInvoiceLine,
  merchantKey,
  merchantTotals,
  periodsBetween,
  relativeChange,
  sumRows,
  timeframePeriods,
  toRows,
  totalsByPeriod,
  type AnalyticsRow,
  type Timeframe,
} from '@/lib/analytics/analytics'
import { buildInsights, type Insight } from '@/lib/analytics/insights'
import { formatChange, formatPeriodShort } from '@/lib/analytics/format'
import { PerspectiveSwitch } from '@/components/shared/perspective-switch'
import { AnalyticsTrendChart, type TrendPoint } from '@/components/analytics/analytics-trend-chart'
import { AnalyticsCategoryList } from '@/components/analytics/analytics-category-list'
import { CategoryFilterSheet, type CategoryOption } from '@/components/analytics/category-filter-sheet'
import { AnalyticsDrilldownSheet, type DrilldownData } from '@/components/analytics/analytics-drilldown-sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils/cn'

type DrillTarget =
  | { kind: 'category'; id: string }
  | { kind: 'merchant'; key: string; name: string }
  | { kind: 'filter' }

const TIMEFRAMES: Timeframe[] = ['month', 'ytd', '12m', 'all']

export default function AnalysPage() {
  const { data: user, isLoading: userLoading } = useUser()
  const { data: partner } = usePartner()
  const storedPerspective = usePerspective((s) => s.perspective)
  const person = partner ? storedPerspective : 'all'
  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay).period

  const [timeframe, setTimeframe] = useState<Timeframe>('month')
  const [anchor, setAnchor] = useState(currentPeriod)
  const [categoryIds, setCategoryIds] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const [drill, setDrill] = useState<DrillTarget | null>(null)

  const { data: expenses = [], isLoading: expensesLoading } = useAllExpenses()
  const { data: budgets = [] } = useBudgets()

  const earliestPeriod = useMemo(() => {
    const oldest = expenses[expenses.length - 1]
    return oldest ? getBudgetPeriod(new Date(`${oldest.date}T00:00:00`), salaryDay).period : null
  }, [expenses, salaryDay])

  const allRows = useMemo(
    () => toRows(expenses, salaryDay, person, user?.id),
    [expenses, salaryDay, person, user?.id]
  )

  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const map = new Map<string, CategoryOption>()
    for (const e of expenses) {
      if (!e.category_id || !e.category || map.has(e.category_id)) continue
      map.set(e.category_id, {
        id: e.category_id,
        name: e.category.name,
        costType: e.category.cost_type,
        isInvoice: isInvoiceLine(e),
      })
    }
    return [...map.values()]
  }, [expenses])
  const categoryName = (id: string) =>
    id === 'none' ? 'Utan kategori' : categoryOptions.find((c) => c.id === id)?.name || 'Kategori'

  const catFilter = categoryIds.size > 0 ? categoryIds : null
  const periods = useMemo(
    () => timeframePeriods(timeframe, anchor, currentPeriod, earliestPeriod),
    [timeframe, anchor, currentPeriod, earliestPeriod]
  )
  const periodSet = useMemo(() => new Set(periods), [periods])
  const isRunningMonth = timeframe === 'month' && anchor === currentPeriod
  // No comparison against months before the first recorded expense — an
  // empty "last year" would read as a +1000 % jump.
  const prevPeriods = useMemo(() => {
    const prev = comparisonPeriods(timeframe, periods)
    return prev.length > 0 && earliestPeriod && prev[0] < earliestPeriod ? [] : prev
  }, [timeframe, periods, earliestPeriod])
  // A running month is compared with the same number of days into the
  // previous period, not with the whole of it.
  const prevCutoff = useMemo(() => {
    if (!isRunningMonth || prevPeriods.length === 0) return null
    const elapsed = differenceInCalendarDays(startOfDay(new Date()), getPeriodDates(currentPeriod, salaryDay).startDate)
    return format(addDays(getPeriodDates(prevPeriods[0], salaryDay).startDate, elapsed), 'yyyy-MM-dd')
  }, [isRunningMonth, prevPeriods, currentPeriod, salaryDay])
  const compLabel = prevPeriods.length > 0 ? getComparisonLabel(timeframe, isRunningMonth) : ''
  const rangeEnd = periods[periods.length - 1] ?? currentPeriod
  const chartPeriods = useMemo(
    () => (periods.length >= 12 ? periods : periodsBetween(shiftPeriod(rangeEnd, -11), rangeEnd)),
    [periods, rangeEnd]
  )

  const rows = useMemo(() => filterRows(allRows, periodSet, catFilter), [allRows, periodSet, catFilter])
  const comparisonRows = (base: Set<string> | null) => {
    const prev = filterRows(allRows, new Set(prevPeriods), base)
    return prevCutoff ? prev.filter((r) => r.expense.date <= prevCutoff) : prev
  }
  const prevRows = useMemo(
    () => comparisonRows(catFilter),
    // comparisonRows only closes over allRows, prevPeriods and prevCutoff
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allRows, prevPeriods, prevCutoff, catFilter]
  )
  const total = sumRows(rows)
  const prevTotal = prevPeriods.length > 0 ? sumRows(prevRows) : null

  const { data: incomes } = usePeriodIncomes(chartPeriods)
  const incomeFor = (period: string) => {
    const inc = incomes?.get(period)
    if (!inc) return null
    return person === 'me' ? inc.user_income : person === 'partner' ? inc.partner_income : inc.total_income
  }
  const showIncome = !catFilter
  const rangeIncome = showIncome ? periods.reduce((s, p) => s + (incomeFor(p) ?? 0), 0) : 0

  const budget = useMemo(
    () => budgetTotal(budgets, periodSet, catFilter, person, user?.id, partner?.id),
    [budgets, periodSet, catFilter, person, user?.id, partner?.id]
  )

  const budgetSpent = sumRows(rows.filter((r) => budget.budgetedPeriods.has(r.period)))

  // Pace projection uses variable categories only (fixed costs land early).
  const variableIds = useMemo(
    () => new Set(
      categoryOptions
        .filter((c) => c.costType === 'Variable' && !c.isInvoice && (!catFilter || catFilter.has(c.id)))
        .map((c) => c.id)
    ),
    [categoryOptions, catFilter]
  )
  const variableSpent = sumRows(rows.filter((r) => variableIds.has(r.expense.category_id || '')))
  const variableBudget = useMemo(
    () => budgetTotal(budgets, periodSet, variableIds, person, user?.id, partner?.id).total,
    [budgets, periodSet, variableIds, person, user?.id, partner?.id]
  )

  const periodProgress = isRunningMonth ? getPeriodProgress(salaryDay) / 100 : null

  const trend = useMemo<TrendPoint[]>(() => {
    const totals = totalsByPeriod(filterRows(allRows, new Set(chartPeriods), catFilter))
    return chartPeriods.map((p) => ({
      period: p,
      value: totals.get(p) || 0,
      income: showIncome ? incomeFor(p) : null,
      inRange: periodSet.has(p),
    }))
    // incomeFor reads `incomes` and `person`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, chartPeriods, catFilter, showIncome, incomes, person, periodSet])

  const categories = useMemo(() => categoryTotals(rows, prevRows), [rows, prevRows])

  const insights = useMemo<Insight[]>(() => {
    const historyPeriods = periodsBetween(shiftPeriod(periods[0] ?? currentPeriod, -6), shiftPeriod(periods[0] ?? currentPeriod, -1))
      .filter((p) => !earliestPeriod || p >= earliestPeriod)
    return buildInsights({
      rows,
      categories,
      comparisonLabel: compLabel,
      historyRows: filterRows(allRows, new Set(historyPeriods), catFilter),
      historyPeriodCount: historyPeriods.length,
      periodCount: periods.length,
      periodProgress,
      total,
      variableSpent,
      variableBudget,
      income: rangeIncome,
    })
  }, [rows, categories, compLabel, allRows, catFilter, periods, currentPeriod, earliestPeriod, periodProgress, total, variableSpent, variableBudget, rangeIncome])

  const topMerchants = useMemo(
    () => merchantTotals(rows).sort((a, b) => b.total - a.total).slice(0, 5),
    [rows]
  )
  const biggest = useMemo(
    () =>
      rows
        .filter((r) => !isInvoiceLine(r.expense) && (catFilter || r.expense.category?.cost_type === 'Variable'))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    [rows, catFilter]
  )

  const drillData = useMemo<DrilldownData | null>(() => {
    if (!drill) return null
    let match: (r: AnalyticsRow) => boolean
    let title: string
    let budgetIds: Set<string> | null = catFilter
    if (drill.kind === 'category') {
      match = (r) => (r.expense.category_id || 'none') === drill.id
      title = categoryName(drill.id)
      budgetIds = drill.id === 'none' ? null : new Set([drill.id])
    } else if (drill.kind === 'merchant') {
      match = (r) => merchantKey(r.expense.description) === drill.key
      title = drill.name
      budgetIds = null
    } else {
      match = () => true
      title = catFilter ? [...catFilter].map(categoryName).join(', ') : 'Alla transaktioner'
    }
    const base = drill.kind === 'filter' ? catFilter : null
    const drillRows = filterRows(allRows, periodSet, base).filter(match)
    const drillPrev = prevPeriods.length ? comparisonRows(base).filter(match) : null
    const chartTotals = totalsByPeriod(filterRows(allRows, new Set(chartPeriods), base).filter(match))
    const drillBudget = drill.kind === 'merchant' || (drill.kind === 'category' && drill.id === 'none')
      ? null
      : budgetTotal(budgets, periodSet, budgetIds, person, user?.id, partner?.id)
    return {
      title,
      subtitle: rangeLabel(timeframe, periods),
      rows: drillRows,
      trend: chartPeriods.map((p) => ({ period: p, value: chartTotals.get(p) || 0, inRange: periodSet.has(p) })),
      periodCount: periods.length,
      previousTotal: drillPrev ? sumRows(drillPrev) : null,
      comparisonLabel: compLabel,
      budget: drillBudget?.total ?? null,
      budgetSpent: drillBudget ? sumRows(drillRows.filter((r) => drillBudget.budgetedPeriods.has(r.period))) : 0,
      isShare: person !== 'all',
    }
    // categoryName derives from categoryOptions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill, allRows, periodSet, prevPeriods, prevCutoff, chartPeriods, catFilter, budgets, person, user?.id, partner?.id, timeframe, periods, compLabel, categoryOptions])

  const selectPeriod = (period: string) => {
    setTimeframe('month')
    setAnchor(period)
    setDrill(null)
  }

  if (userLoading || expensesLoading) return <AnalysSkeleton />

  const change = prevTotal != null ? relativeChange(total, prevTotal) : null
  const budgetStatus = budget.total > 0 ? getBudgetStatus(budgetSpent, budget.total) : null
  const partlyBudgeted = periods.length > 1 && budget.budgetedPeriods.size < periods.length
  const personName = person === 'me' ? user?.first_name || 'Du' : person === 'partner' ? partner?.first_name || 'Partner' : null

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-4 max-w-3xl mx-auto">
      <div className="hidden md:block">
        <h1 className="font-serif text-[32px] font-medium tracking-tight">Analys</h1>
        <p className="text-sm text-muted-foreground mt-1">Följ utvecklingen och dyk ner i dina utgifter</p>
      </div>

      {/* Controls */}
      <div className="sticky top-[63px] md:top-0 z-30 -mx-4 px-4 md:-mx-2 md:px-2 py-2 bg-background/95 backdrop-blur-md space-y-2">
        <div className="flex gap-1 bg-secondary rounded-full p-1" role="radiogroup" aria-label="Tidsperiod">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={timeframe === t}
              onClick={() => {
                setTimeframe(t)
                if (t === 'month') setAnchor(currentPeriod)
              }}
              className={cn(
                'flex-1 py-1.5 rounded-full text-[13px] font-medium transition-all',
                timeframe === t ? 'bg-hb-nav text-hb-nav-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {TIMEFRAME_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <PerspectiveSwitch className="flex-1" />
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors shrink-0',
              catFilter ? 'bg-hb-cognac/15 border-hb-cognac/40 text-hb-cognac-deep' : 'bg-card border-border text-muted-foreground',
              !partner && 'ml-auto'
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {catFilter ? `${catFilter.size} ${catFilter.size === 1 ? 'kategori' : 'kategorier'}` : 'Kategorier'}
          </button>
        </div>
        {catFilter && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
            {[...catFilter].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategoryIds((prev) => {
                  const next = new Set(prev)
                  next.delete(id)
                  return next
                })}
                className="inline-flex items-center gap-1 rounded-full bg-hb-nav text-hb-nav-foreground px-2.5 py-1 text-[12px] whitespace-nowrap"
                aria-label={`Ta bort filter ${categoryName(id)}`}
              >
                {categoryName(id)}
                <X className="w-3 h-3 opacity-70" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCategoryIds(new Set())}
              className="text-[12px] text-muted-foreground px-2 whitespace-nowrap"
            >
              Rensa
            </button>
          </div>
        )}
      </div>

      {/* Hero */}
      <motion.section
        key={`${timeframe}-${anchor}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-card border border-border rounded-3xl px-5 py-5 md:px-6 shadow-sm"
      >
        <div className="flex items-center justify-between gap-2">
          {timeframe === 'month' ? (
            <div className="flex items-center gap-1 -ml-2">
              <button
                type="button"
                onClick={() => setAnchor((p) => shiftPeriod(p, -1))}
                disabled={!!earliestPeriod && anchor <= earliestPeriod}
                className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-secondary disabled:opacity-30"
                aria-label="Föregående månad"
              >
                <ChevronLeft className="w-[18px] h-[18px]" />
              </button>
              <span className="font-serif text-[17px] font-medium tracking-tight capitalize">
                {formatPeriodShort(anchor, true)}
              </span>
              <button
                type="button"
                onClick={() => setAnchor((p) => shiftPeriod(p, 1))}
                disabled={anchor >= currentPeriod}
                className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-secondary disabled:opacity-30"
                aria-label="Nästa månad"
              >
                <ChevronRight className="w-[18px] h-[18px]" />
              </button>
            </div>
          ) : (
            <span className="font-serif text-[17px] font-medium tracking-tight">{rangeLabel(timeframe, periods)}</span>
          )}
          {personName && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {personName}s andel
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{periodRangeText(periods, salaryDay)}</div>

        <div className="label-caps text-muted-foreground mt-4">
          {catFilter ? 'Spenderat i valda kategorier' : 'Spenderat'}
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="font-serif-hero text-[40px] md:text-[46px] leading-[1.05] mt-1">{formatCurrency(total)}</div>
          {change != null && (
            <span
              className={cn(
                'mb-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium',
                change > 0 ? 'bg-destructive/10 text-destructive' : 'bg-hb-green/15 text-hb-green'
              )}
            >
              {change > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {formatChange(change)}
            </span>
          )}
        </div>
        <div className="text-[12px] text-muted-foreground mt-1">
          {rows.length} transaktioner
          {periods.length > 1 && ` · snitt ${formatCurrency(total / periods.length)}/mån`}
          {change != null && prevTotal != null && ` · ${formatCurrency(prevTotal)} ${compLabel}`}
        </div>

        {budgetStatus && (
          <div className="mt-4">
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', budgetStatusBarClass(budgetStatus))}
                style={{ width: `${Math.min(100, (budgetSpent / budget.total) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between gap-3 text-[12px] text-muted-foreground mt-1.5">
              <span>
                {Math.round((budgetSpent / budget.total) * 100)} % av budget {formatCurrency(budget.total)}
                {partlyBudgeted && ` · ${budget.budgetedPeriods.size} av ${periods.length} mån har budget`}
              </span>
              <span className={cn('shrink-0', budgetStatus === 'over' && 'text-destructive')}>
                {budgetSpent <= budget.total ? `${formatCurrency(budget.total - budgetSpent)} kvar` : `${formatCurrency(budgetSpent - budget.total)} över`}
              </span>
            </div>
          </div>
        )}

        {showIncome && rangeIncome > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="bg-secondary/50 rounded-2xl px-3 py-2.5">
              <div className="text-[11px] text-muted-foreground">Inkomst</div>
              <div className="font-serif-kpi text-[16px] mt-0.5">{formatCurrency(rangeIncome)}</div>
            </div>
            <div className="bg-secondary/50 rounded-2xl px-3 py-2.5">
              <div className="text-[11px] text-muted-foreground">Kvar efter utgifter</div>
              <div className={cn('font-serif-kpi text-[16px] mt-0.5', rangeIncome - total < 0 && 'text-destructive')}>
                {formatCurrency(rangeIncome - total)}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setDrill({ kind: 'filter' })}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl border border-border py-2.5 text-[13px] font-medium hover:bg-secondary/60 transition-colors"
        >
          <ListFilter className="w-4 h-4" />
          Visa alla {rows.length} transaktioner
        </button>
      </motion.section>

      {/* 12-month trend */}
      <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
        <div className="mb-3">
          <h2 className="font-serif text-[19px] font-medium tracking-tight">
            {chartPeriods.length > 12 ? 'Hela historiken' : '12 månader'}
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Tryck på en stapel för att öppna månaden</p>
        </div>
        <AnalyticsTrendChart
          data={trend}
          showIncome={showIncome}
          height={210}
          onSelectPeriod={selectPeriod}
          selectedPeriod={timeframe === 'month' ? anchor : null}
        />
      </section>

      {/* Insights */}
      {insights.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-serif text-[19px] font-medium tracking-tight px-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-hb-cognac" />
            Insikter
          </h2>
          <div className="grid gap-2 md:grid-cols-2">
            {insights.slice(0, 4).map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onClick={
                  insight.categoryId
                    ? () => setDrill({ kind: 'category', id: insight.categoryId! })
                    : insight.merchantKey
                      ? () => setDrill({ kind: 'merchant', key: insight.merchantKey!, name: insight.title.replace(/^Oftast: /, '') })
                      : undefined
                }
              />
            ))}
          </div>
        </section>
      )}

      <AnalyticsCategoryList
        categories={categories}
        comparisonLabel={compLabel}
        onSelect={(id) => setDrill({ kind: 'category', id })}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
          <h2 className="font-serif text-[19px] font-medium tracking-tight flex items-center gap-2">
            <Store className="w-4 h-4 text-muted-foreground" />
            Var pengarna går
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Butiker och tjänster, rörliga köp</p>
          {topMerchants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Inga köp under perioden.</p>
          ) : (
            <ul className="mt-2 -mx-1">
              {topMerchants.map((m) => (
                <li key={m.key}>
                  <button
                    type="button"
                    onClick={() => setDrill({ kind: 'merchant', key: m.key, name: m.name })}
                    className="w-full flex items-center justify-between gap-3 px-1 py-2 rounded-xl hover:bg-secondary/50 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium truncate">{m.name}</span>
                      <span className="block text-[11px] text-muted-foreground">{m.count} köp</span>
                    </span>
                    <span className="font-serif text-[15px] font-medium shrink-0">{formatCurrency(m.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
          <h2 className="font-serif text-[19px] font-medium tracking-tight flex items-center gap-2">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            Största köpen
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {catFilter ? 'Inom valda kategorier' : 'Rörliga kategorier, utan kreditkortsfakturan'}
          </p>
          {biggest.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Inga köp under perioden.</p>
          ) : (
            <ul className="mt-2 -mx-1">
              {biggest.map((r) => (
                <li key={r.expense.id}>
                  <button
                    type="button"
                    onClick={() => setDrill({ kind: 'category', id: r.expense.category_id || 'none' })}
                    className="w-full flex items-center justify-between gap-3 px-1 py-2 rounded-xl hover:bg-secondary/50 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium truncate">{r.expense.description}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">
                        {r.expense.category?.name || 'Utan kategori'} · {new Date(`${r.expense.date}T00:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                      </span>
                    </span>
                    <span className="font-serif text-[15px] font-medium shrink-0">{formatCurrency(r.value)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <CategoryFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        options={categoryOptions}
        selected={categoryIds}
        onApply={setCategoryIds}
      />
      <AnalyticsDrilldownSheet
        data={drillData}
        onOpenChange={(open) => !open && setDrill(null)}
        onSelectPeriod={selectPeriod}
      />
    </div>
  )
}

function InsightCard({ insight, onClick }: { insight: Insight; onClick?: () => void }) {
  const Icon = insight.tone === 'warning' ? AlertTriangle : insight.tone === 'good' ? CheckCircle2 : Sparkles
  const content = (
    <>
      <div
        className={cn(
          'w-8 h-8 rounded-xl grid place-items-center shrink-0',
          insight.tone === 'warning' && 'bg-hb-amber/15 text-hb-amber',
          insight.tone === 'good' && 'bg-hb-green/15 text-hb-green',
          insight.tone === 'neutral' && 'bg-hb-cognac/12 text-hb-cognac-deep'
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium">{insight.title}</div>
        <div className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{insight.text}</div>
      </div>
      {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 self-center" />}
    </>
  )
  const className = 'flex gap-3 bg-card border border-border rounded-2xl px-3.5 py-3 shadow-sm text-left w-full'
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(className, 'hover:bg-secondary/40 transition-colors')}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}

function rangeLabel(timeframe: Timeframe, periods: string[]): string {
  if (periods.length === 0) return ''
  if (timeframe === 'month') return formatPeriodShort(periods[0], true)
  const first = formatPeriodShort(periods[0], true)
  const last = formatPeriodShort(periods[periods.length - 1], true)
  return first === last ? first : `${capitalize(first)} – ${last}`
}

function periodRangeText(periods: string[], salaryDay: number): string {
  if (periods.length === 0) return ''
  const start = getPeriodDates(periods[0], salaryDay).startDate
  const end = getPeriodDates(periods[periods.length - 1], salaryDay).endDate
  const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function AnalysSkeleton() {
  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-4 max-w-3xl mx-auto">
      <Skeleton className="h-9 w-full rounded-full" />
      <Skeleton className="h-8 w-full rounded-full" />
      <Skeleton className="h-56 w-full rounded-3xl" />
      <Skeleton className="h-64 w-full rounded-3xl" />
      <Skeleton className="h-72 w-full rounded-3xl" />
    </div>
  )
}
