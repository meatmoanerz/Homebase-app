'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser, usePartner } from '@/hooks/use-user'
import { useExpensesByPeriod } from '@/hooks/use-expenses'
import { useHouseholdIncome } from '@/hooks/use-incomes'
import { useMonthlyIncomeTotal } from '@/hooks/use-monthly-incomes'
import { useBudgetByPeriod } from '@/hooks/use-budgets'
import { useCategories } from '@/hooks/use-categories'
import { getCurrentBudgetPeriod, formatPeriodDisplay, shiftPeriod, getPeriodDates } from '@/lib/utils/budget-period'
import { SpendHero } from '@/components/dashboard/spend-hero'
import { RecentExpenses } from '@/components/dashboard/recent-expenses'
import { PersonBudgetBreakdown } from '@/components/dashboard/person-budget-breakdown'
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton'
import { TodoList } from '@/components/dashboard/todo-list'
import { BudgetDeviations, type CategoryDeviation } from '@/components/dashboard/budget-deviations'
import { MoneyShortcuts } from '@/components/dashboard/money-shortcuts'
import { SettlementShortcut } from '@/components/dashboard/settlement-shortcut'
import { PeriodStrip } from '@/components/shared/period-strip'
import { calcCashOut, calcConsumption, calcPersonSpend, isCreditPurchaseThisPeriod } from '@/lib/utils/spend-calc'
import { sumBudgetSplit } from '@/lib/utils/budget-split'
import { useHouseholdEconomy } from '@/hooks/use-household-economy'
import { usePerspective } from '@/hooks/use-perspective'
import { useAllExpenses } from '@/hooks/use-analytics'
import { useAllLoans } from '@/hooks/use-loans'
import { useActiveRecurringExpenses } from '@/hooks/use-recurring-expenses'
import { useCreditCards } from '@/hooks/use-credit-cards'
import { useCCMInvoices } from '@/hooks/use-ccm-invoices'
import { budgetTotal, isInvoiceLine, personShare, savingsPlanFrom, toRows } from '@/lib/analytics/analytics'
import { buildForecast } from '@/lib/analytics/forecast'
import { knownCardInvoices } from '@/lib/analytics/card-invoices'
import { getBudgetPeriod, getDaysUntilSalary, getPeriodProgress } from '@/lib/utils/budget-period'
import { splitBudgetItem } from '@/lib/utils/budget-split'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [setupDone, setSetupDone] = useState(false)
  const { data: user, isLoading: userLoading } = useUser()
  const { data: partner } = usePartner()
  const { data: categories, refetch: refetchCategories } = useCategories()
  const supabase = createClient()
  const hasPartner = !!partner

  // Auto-setup: Create categories if they don't exist
  useEffect(() => {
    async function ensureSetup() {
      if (setupDone || !user?.id) return
      
      // Check if categories exist
      if (categories && categories.length > 0) {
        setSetupDone(true)
        return
      }

      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) return

        console.log('Running auto-setup for user:', authUser.id)
        
        const response = await fetch('/api/setup-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: authUser.id,
            email: authUser.email,
            firstName: user.first_name,
            lastName: user.last_name,
          }),
        })

        const result = await response.json()
        console.log('Auto-setup result:', result)
        
        if (response.ok) {
          // Refresh categories
          refetchCategories()
        }
      } catch (error) {
        console.error('Auto-setup error:', error)
      }
      
      setSetupDone(true)
    }

    ensureSetup()
  }, [user, categories, setupDone, supabase, refetchCategories])
  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay)
  const perspective = usePerspective((s) => s.perspective)
  const person = hasPartner ? perspective : 'all'

  // Selected period for the overview — defaults to current, steppable with arrows
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod.period)
  const isCurrentPeriod = selectedPeriod === currentPeriod.period
  const periodDates = getPeriodDates(selectedPeriod, salaryDay)
  const periodRange = `${periodDates.startDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} – ${periodDates.endDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`

  const { data: expenses = [], isLoading: expensesLoading } = useExpensesByPeriod(selectedPeriod, salaryDay)
  const { data: householdIncome } = useHouseholdIncome()
  const { data: monthlyIncomeTotal } = useMonthlyIncomeTotal(selectedPeriod)
  const { data: budget } = useBudgetByPeriod(selectedPeriod)
  // Full history only feeds the running period's forecast.
  const { data: allExpenses = [] } = useAllExpenses()
  const { data: loans = [] } = useAllLoans()
  const { data: recurring = [] } = useActiveRecurringExpenses()
  const { data: creditCards = [] } = useCreditCards()
  const { data: ccmInvoices = [] } = useCCMInvoices()

  const budgetItems = useMemo(() => budget?.budget_items ?? [], [budget])
  // Income-share split for categories shared "Efter inkomst"
  const { splitRule } = useHouseholdEconomy(selectedPeriod)

  // Amounts as seen from the chosen perspective (Alla / Du / Partner).
  const scoped = useMemo(
    () => expenses.map((e) => ({ ...e, amount: e.amount * personShare(e, person, user?.id) })),
    [expenses, person, user?.id]
  )

  // Two forecasts for the running period from the same history:
  //  - consumption: every purchase in its category, the Kreditkort line left out
  //  - cash out: bank-paid rows plus the card invoices drawn in the period,
  //    taken from the purchases already on them (see knownCardInvoices)
  const forecasts = useMemo(() => {
    if (!isCurrentPeriod || allExpenses.length === 0) return null
    const rows = toRows(allExpenses, salaryDay, person, user?.id)
    const oldest = allExpenses[allExpenses.length - 1]
    const base = {
      currentPeriod: currentPeriod.period,
      earliestPeriod: oldest ? getBudgetPeriod(new Date(`${oldest.date}T00:00:00`), salaryDay).period : null,
      periodProgress: getPeriodProgress(salaryDay) / 100,
      horizon: 1,
      loans: loans.map((l) => ({
        current_balance: Number(l.current_balance),
        interest_rate: Number(l.interest_rate),
        monthly_amortization: Number(l.monthly_amortization),
        include_in_budget: l.include_in_budget,
      })),
      recurring: recurring.map((r) => ({ category_id: r.category_id, amount: Number(r.amount), is_active: r.is_active })),
      categoryIds: null,
      incomeFor: () => null,
      categoryMeta: new Map(),
      coverageRows: person === 'all' ? rows : toRows(allExpenses, salaryDay, 'all', user?.id),
    }
    const consumption = buildForecast({
      ...base,
      rows: rows.filter((r) => !isInvoiceLine(r.expense)),
      savingsPlan: savingsPlanFrom(budgetItems, person, user?.id, partner?.id, splitRule),
    })
    if (consumption.historyPeriods.length < 2) return null
    const cash = buildForecast({
      ...base,
      rows: rows.filter((r) => !isCreditPurchaseThisPeriod(r.expense)),
      cardInvoices: knownCardInvoices({
        budgetPeriods: [currentPeriod.period, shiftPeriod(currentPeriod.period, 1)],
        cards: creditCards,
        expenses: allExpenses,
        invoices: ccmInvoices,
        salaryDay,
      }),
    })
    return { consumption, cash }
  }, [isCurrentPeriod, allExpenses, salaryDay, person, user?.id, partner?.id, splitRule, budgetItems, currentPeriod.period, loans, recurring, creditCards, ccmInvoices])
  const forecast = forecasts?.consumption ?? null

  const deviations = useMemo<CategoryDeviation[]>(() => {
    const actualByCategory = new Map<string, number>()
    for (const e of scoped) {
      const id = e.category_id || ''
      actualByCategory.set(id, (actualByCategory.get(id) || 0) + e.amount)
    }
    const projectedByCategory = new Map(
      (forecast?.categories ?? []).filter((c) => c.costType === 'Variable' && !c.isInvoice).map((c) => [c.id, c.current.projected])
    )
    const byCategory = new Map<string, CategoryDeviation>()
    for (const item of budgetItems) {
      // Kreditkort budgets the invoice (cash flow), not consumption
      if (!item.category_id || isInvoiceLine(item)) continue
      const amount = person === 'all'
        ? item.amount
        : person === 'me'
          ? splitBudgetItem(item, user?.id, partner?.id, splitRule).user
          : splitBudgetItem(item, user?.id, partner?.id, splitRule).partner
      const existing = byCategory.get(item.category_id)
      if (existing) {
        existing.budget += amount
        continue
      }
      byCategory.set(item.category_id, {
        categoryId: item.category_id,
        name: item.category?.name || item.name,
        budget: amount,
        actual: actualByCategory.get(item.category_id) || 0,
        projected: projectedByCategory.get(item.category_id) ?? null,
      })
    }
    return [...byCategory.values()]
  }, [scoped, budgetItems, forecast, person, user?.id, partner?.id, splitRule])

  if (userLoading || expensesLoading) {
    return <DashboardSkeleton />
  }

  // Income: monthly income for the period, else the static household income.
  const monthlyTotal = person === 'me'
    ? monthlyIncomeTotal?.user_income ?? 0
    : person === 'partner'
      ? monthlyIncomeTotal?.partner_income ?? 0
      : monthlyIncomeTotal?.total_income ?? 0
  const totalIncome = monthlyTotal > 0
    ? monthlyTotal
    : person === 'all' ? (householdIncome?.total_income ?? 0) : 0

  // CONSUMPTION (main KPI): every purchase once, the credit-card invoice line excluded.
  const totalSpent = calcConsumption(scoped)
  // CASH FLOW out (secondary): this period's credit-card purchases excluded, the invoice included.
  const cashOut = calcCashOut(scoped)

  const budgetForPerson = budgetTotal(
    budget ? [{ period: selectedPeriod, budget_items: budgetItems }] : [],
    new Set([selectedPeriod]),
    null,
    person,
    user?.id,
    partner?.id,
    splitRule
  ).total
  const hasBudget = budgetForPerson > 0

  // Per person: assignment-based budget split, owner-aware spend.
  const split = sumBudgetSplit(budgetItems.filter((item) => !isInvoiceLine(item)), user?.id, partner?.id, splitRule)
  const userSpent = calcPersonSpend(expenses, 'user', user?.id)
  const partnerSpent = calcPersonSpend(expenses, 'partner', user?.id)

  const currentForecast = forecast?.months[0] ?? null
  // Room to save = income minus the forecast for costs and amortisation
  // (voluntary savings left out), set against the savings in the plan.
  const plannedSavings = [...savingsPlanFrom(budgetItems, person, user?.id, partner?.id, splitRule).values()]
    .reduce((sum, p) => sum + p.amount, 0)
  const savingsRoom = currentForecast && totalIncome > 0
    ? { room: totalIncome - (currentForecast.spend - currentForecast.savings), planned: plannedSavings }
    : null
  const nextInvoice = forecasts?.cash.categories.find((c) => c.knownInvoice)?.knownInvoice ?? null
  const scopeLabel = person === 'me' ? `${user?.first_name || 'Din'}s andel` : person === 'partner' ? `${partner?.first_name || 'Partner'}s andel` : null

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-5 max-w-3xl md:mx-auto">
      {/* Desktop title (mobile shows in header) */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="hidden md:block space-y-1"
      >
        <h1 className="font-serif text-[32px] font-medium tracking-tight">Översikt</h1>
        <p className="text-sm text-muted-foreground">
          {isCurrentPeriod ? 'Aktuell budgetperiod' : 'Tidigare/kommande period'}
        </p>
      </motion.div>

      {/* Period strip with arrows */}
      <PeriodStrip
        label={formatPeriodDisplay(selectedPeriod)}
        range={periodRange}
        onPrevious={() => setSelectedPeriod((p) => shiftPeriod(p, -1))}
        onNext={() => setSelectedPeriod((p) => shiftPeriod(p, 1))}
        className="pt-1"
      />

      {/* Hero: remaining + forecast (primary) and cash flow (secondary) */}
      <SpendHero
        spent={totalSpent}
        budget={budgetForPerson}
        income={totalIncome}
        cashOut={cashOut}
        hasBudget={hasBudget}
        forecast={currentForecast ? { spend: currentForecast.spend, low: currentForecast.low, high: currentForecast.high } : null}
        savingsRoom={savingsRoom}
        nextInvoice={nextInvoice ? { value: nextInvoice.value, registered: nextInvoice.registered } : null}
        daysLeft={isCurrentPeriod ? getDaysUntilSalary(salaryDay) : null}
        scopeLabel={scopeLabel}
      />

      {/* What needs doing */}
      {isCurrentPeriod && <TodoList />}

      {/* Categories that need attention */}
      <BudgetDeviations items={deviations} hasBudget={hasBudget} />

      {/* Per person — only in the household view */}
      {hasPartner && person === 'all' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <PersonBudgetBreakdown
            userName={user?.first_name || 'Du'}
            partnerName={partner?.first_name || 'Partner'}
            userSpent={userSpent}
            partnerSpent={partnerSpent}
            userBudget={budgetItems.length > 0 ? split.user : 0}
            partnerBudget={budgetItems.length > 0 ? split.partner : 0}
          />
        </motion.div>
      )}

      <SettlementShortcut />
      <MoneyShortcuts />

      {/* Recent Expenses */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <RecentExpenses expenses={expenses.slice(0, 5)} />
      </motion.div>
    </div>
  )
}
