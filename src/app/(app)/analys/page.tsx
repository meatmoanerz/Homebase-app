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
  Search,
} from 'lucide-react'
import { useUser, usePartner } from '@/hooks/use-user'
import { usePerspective } from '@/hooks/use-perspective'
import { useBudgets } from '@/hooks/use-budgets'
import { useAllExpenses, usePeriodIncomes } from '@/hooks/use-analytics'
import { useAllLoans } from '@/hooks/use-loans'
import { useActiveRecurringExpenses } from '@/hooks/use-recurring-expenses'
import { useCreditCards } from '@/hooks/use-credit-cards'
import { useCCMInvoices } from '@/hooks/use-ccm-invoices'
import { assessCoverage, buildForecast } from '@/lib/analytics/forecast'
import { knownCardInvoices } from '@/lib/analytics/card-invoices'
import { AnalyticsForecastView, type ForecastHorizon } from '@/components/analytics/analytics-forecast-view'
import { ExpenseEditDialog } from '@/components/expenses/expense-edit-dialog'
import { AssignmentPill } from '@/components/shared/assignment-pill'
import type { ExpenseWithCategory } from '@/types'
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
const RECENT_COUNT = 8

type View = 'history' | 'forecast'

/** Deep link: /analys?view=forecast opens the Framåt tab. */
function initialView(): View {
  if (typeof window === 'undefined') return 'history'
  return new URLSearchParams(window.location.search).get('view') === 'forecast' ? 'forecast' : 'history'
}

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
  const [view, setView] = useState<View>(initialView)
  const [horizon, setHorizon] = useState<ForecastHorizon>(3)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<ExpenseWithCategory | null>(null)

  const { data: expenses = [], isLoading: expensesLoading } = useAllExpenses()
  const { data: budgets = [] } = useBudgets()
  const { data: loans = [] } = useAllLoans()
  const { data: recurring = [] } = useActiveRecurringExpenses()
  const { data: creditCards = [] } = useCreditCards()
  const { data: ccmInvoices = [] } = useCCMInvoices()

  const earliestPeriod = useMemo(() => {
    const oldest = expenses[expenses.length - 1]
    return oldest ? getBudgetPeriod(new Date(`${oldest.date}T00:00:00`), salaryDay).period : null
  }, [expenses, salaryDay])

  // Free-text search narrows everything on the page (e.g. "ica" this year).
  const searchTerm = query.trim().toLowerCase()
  const allRows = useMemo(() => {
    const rows = toRows(expenses, salaryDay, person, user?.id)
    if (!searchTerm) return rows
    // Match from the start of a word: "ica" finds "ICA NARA", not "AMERICAN".
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}`, 'iu')
    return rows.filter((r) => re.test(r.expense.description) || re.test(r.expense.category?.name ?? ''))
  }, [expenses, salaryDay, person, user?.id, searchTerm])

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
  const currentYear = currentPeriod.slice(0, 4)
  const anchorYear = anchor.slice(0, 4)
  const earliestYear = earliestPeriod?.slice(0, 4) ?? currentYear
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
  const compLabel = prevPeriods.length > 0
    ? getComparisonLabel(timeframe, timeframe === 'ytd' ? anchorYear === currentYear : isRunningMonth)
    : ''
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
  const showIncome = !catFilter && !searchTerm
  const rangeIncome = showIncome ? periods.reduce((s, p) => s + (incomeFor(p) ?? 0), 0) : 0

  // A free-text search has no budget to compare against.
  const budget = useMemo(
    () => searchTerm
      ? { total: 0, budgetedPeriods: new Set<string>() }
      : budgetTotal(budgets, periodSet, catFilter, person, user?.id, partner?.id),
    [budgets, periodSet, catFilter, person, user?.id, partner?.id, searchTerm]
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

  // Data completeness is judged on the whole household, unfiltered: months
  // with too little imported data are left out of averages and forecasts.
  const coverageRows = useMemo(() => toRows(expenses, salaryDay, 'all', user?.id), [expenses, salaryDay, user?.id])
  const completePeriods = useMemo(
    () => new Set(assessCoverage(coverageRows, earliestPeriod, currentPeriod).filter((c) => c.reliable).map((c) => c.period)),
    [coverageRows, earliestPeriod, currentPeriod]
  )

  // ---- Framåt (forecast) ----
  const forecastIncomePeriods = useMemo(
    () => (view === 'forecast' ? periodsBetween(shiftPeriod(currentPeriod, -12), shiftPeriod(currentPeriod, horizon)) : []),
    [view, currentPeriod, horizon]
  )
  const { data: forecastIncomes } = usePeriodIncomes(forecastIncomePeriods)
  const categoryMeta = useMemo(
    () => new Map(categoryOptions.map((c) => [c.id, { name: c.name, costType: c.costType, isInvoice: c.isInvoice }])),
    [categoryOptions]
  )
  // Card invoices already known (purchases on them) for the running period and ahead.
  const cardInvoices = useMemo(
    () => view === 'forecast'
      ? knownCardInvoices({
          budgetPeriods: periodsBetween(currentPeriod, shiftPeriod(currentPeriod, horizon)),
          cards: creditCards,
          expenses,
          invoices: ccmInvoices,
          salaryDay,
        })
      : undefined,
    [view, currentPeriod, horizon, creditCards, expenses, ccmInvoices, salaryDay]
  )
  const forecast = useMemo(() => {
    if (view !== 'forecast') return null
    const forecastIncomeFor = (period: string) => {
      const inc = forecastIncomes?.get(period)
      if (!inc) return null
      const v = person === 'me' ? inc.user_income : person === 'partner' ? inc.partner_income : inc.total_income
      return v > 0 ? v : null
    }
    return buildForecast({
      rows: catFilter ? allRows.filter((r) => catFilter.has(r.expense.category_id || '')) : allRows,
      currentPeriod,
      earliestPeriod,
      periodProgress: getPeriodProgress(salaryDay) / 100,
      horizon,
      // Loans are household-level; the person split follows the history of
      // the interest/amortisation categories inside buildForecast.
      loans: loans.map((l) => ({
        current_balance: Number(l.current_balance),
        interest_rate: Number(l.interest_rate),
        monthly_amortization: Number(l.monthly_amortization),
        include_in_budget: l.include_in_budget,
      })),
      recurring: recurring.map((r) => ({ category_id: r.category_id, amount: Number(r.amount), is_active: r.is_active })),
      categoryIds: catFilter,
      incomeFor: forecastIncomeFor,
      categoryMeta,
      coverageRows,
      cardInvoices,
    })
  }, [view, coverageRows, allRows, catFilter, currentPeriod, earliestPeriod, salaryDay, horizon, loans, recurring, forecastIncomes, person, categoryMeta, cardInvoices])
  const forecastHistory = useMemo(() => {
    if (!forecast) return []
    const totals = totalsByPeriod(catFilter ? allRows.filter((r) => catFilter.has(r.expense.category_id || '')) : allRows)
    return periodsBetween(shiftPeriod(currentPeriod, -6), shiftPeriod(currentPeriod, -1))
      .filter((p) => !earliestPeriod || p >= earliestPeriod)
      .map((p) => {
        const inc = forecastIncomes?.get(p)
        const income = inc ? (person === 'me' ? inc.user_income : person === 'partner' ? inc.partner_income : inc.total_income) : null
        return { period: p, value: totals.get(p) || 0, income }
      })
  }, [forecast, allRows, catFilter, currentPeriod, earliestPeriod, forecastIncomes, person])
  const currentBudget = useMemo(
    () => budgetTotal(budgets, new Set([currentPeriod]), catFilter, person, user?.id, partner?.id).total,
    [budgets, currentPeriod, catFilter, person, user?.id, partner?.id]
  )

  const recentRows = useMemo(
    () => [...rows].sort((a, b) => b.expense.date.localeCompare(a.expense.date) || b.expense.created_at.localeCompare(a.expense.created_at)).slice(0, RECENT_COUNT),
    [rows]
  )

  const insights = useMemo<Insight[]>(() => {
    const historyPeriods = periodsBetween(shiftPeriod(periods[0] ?? currentPeriod, -6), shiftPeriod(periods[0] ?? currentPeriod, -1))
      .filter((p) => completePeriods.has(p))
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
  }, [rows, categories, compLabel, allRows, catFilter, periods, currentPeriod, completePeriods, periodProgress, total, variableSpent, variableBudget, rangeIncome])

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
    setView('history')
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
              aria-checked={view === 'history' && timeframe === t}
              onClick={() => {
                setView('history')
                setTimeframe(t)
                if (t === 'month' || t === 'ytd') setAnchor(currentPeriod)
              }}
              className={cn(
                'flex-1 py-1.5 rounded-full text-[13px] font-medium transition-all whitespace-nowrap',
                view === 'history' && timeframe === t ? 'bg-hb-nav text-hb-nav-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'ytd' && timeframe === 'ytd' && anchorYear !== currentYear ? anchorYear : TIMEFRAME_LABELS[t]}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={view === 'forecast'}
            onClick={() => setView('forecast')}
            className={cn(
              'flex-1 py-1.5 rounded-full text-[13px] font-medium transition-all whitespace-nowrap',
              view === 'forecast' ? 'bg-hb-cognac text-white shadow-sm' : 'text-hb-cognac-deep hover:text-foreground'
            )}
          >
            Framåt
          </button>
        </div>
        <div className="flex items-center gap-2">
          <PerspectiveSwitch className="flex-1" />
          <button
            type="button"
            onClick={() => {
              if (searchOpen) setQuery('')
              setSearchOpen((v) => !v)
            }}
            aria-label={searchOpen ? 'Stäng sök' : 'Sök transaktioner'}
            aria-pressed={searchOpen}
            className={cn(
              'w-8 h-8 grid place-items-center rounded-full border shrink-0 transition-colors',
              searchTerm ? 'bg-hb-cognac/15 border-hb-cognac/40 text-hb-cognac-deep' : 'bg-card border-border text-muted-foreground',
              !partner && 'ml-auto'
            )}
          >
            {searchOpen ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors shrink-0',
              catFilter ? 'bg-hb-cognac/15 border-hb-cognac/40 text-hb-cognac-deep' : 'bg-card border-border text-muted-foreground'
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {catFilter ? `${catFilter.size} ${catFilter.size === 1 ? 'kategori' : 'kategorier'}` : 'Kategorier'}
          </button>
        </div>
        {searchOpen && (
          <div className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök butik, beskrivning eller kategori…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              enterKeyHint="search"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-muted-foreground" aria-label="Rensa sökning">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
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

      {view === 'forecast' && forecast ? (
        <AnalyticsForecastView
          forecast={forecast}
          horizon={horizon}
          onHorizonChange={setHorizon}
          currentBudget={currentBudget}
          showIncome={!catFilter && !searchTerm}
          historyTotals={forecastHistory}
        />
      ) : (
      <>
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
          ) : timeframe === 'ytd' ? (
            <div className="flex items-center gap-1 -ml-2">
              <button
                type="button"
                onClick={() => setAnchor(`${Number(anchorYear) - 1}-12`)}
                disabled={anchorYear <= earliestYear}
                className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-secondary disabled:opacity-30"
                aria-label="Föregående år"
              >
                <ChevronLeft className="w-[18px] h-[18px]" />
              </button>
              <span className="font-serif text-[17px] font-medium tracking-tight tabular-nums">{anchorYear}</span>
              <button
                type="button"
                onClick={() => setAnchor(Number(anchorYear) + 1 >= Number(currentYear) ? currentPeriod : `${Number(anchorYear) + 1}-12`)}
                disabled={anchorYear >= currentYear}
                className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-secondary disabled:opacity-30"
                aria-label="Nästa år"
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
          {searchTerm ? `Spenderat · "${query.trim()}"` : catFilter ? 'Spenderat i valda kategorier' : 'Spenderat'}
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

      {/* Latest transactions (replaces the old Utgifter list) */}
      <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-[19px] font-medium tracking-tight">Transaktioner</h2>
          <span className="text-[11px] text-muted-foreground">Tryck för att redigera</span>
        </div>
        {recentRows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Inga transaktioner under perioden.</p>
        ) : (
          <ul className="mt-2 -mx-1 divide-y divide-border/60">
            {recentRows.map((r) => (
              <li key={r.expense.id}>
                <button
                  type="button"
                  onClick={() => setEditExpense(r.expense)}
                  className="w-full flex items-center gap-3 px-1 py-2.5 hover:bg-secondary/40 rounded-xl text-left"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-medium truncate">{r.expense.description}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                      <span className="truncate">
                        {new Date(`${r.expense.date}T00:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                        {' · '}
                        {r.expense.category?.name || 'Utan kategori'}
                      </span>
                      <AssignmentPill assignment={r.expense.cost_assignment} />
                    </span>
                  </span>
                  <span className="font-serif text-[15px] font-medium shrink-0">{formatCurrency(r.value)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {rows.length > RECENT_COUNT && (
          <button
            type="button"
            onClick={() => setDrill({ kind: 'filter' })}
            className="w-full mt-1 py-2 text-xs font-medium text-hb-cognac-deep"
          >
            Visa alla {rows.length}
          </button>
        )}
      </section>
      </>
      )}

      <ExpenseEditDialog
        expense={editExpense}
        open={!!editExpense}
        onOpenChange={(open) => !open && setEditExpense(null)}
      />
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
