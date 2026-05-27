'use client'

import { useEffect, useState } from 'react'
import { useUser, usePartner } from '@/hooks/use-user'
import { useExpensesByPeriod } from '@/hooks/use-expenses'
import { useHouseholdIncome } from '@/hooks/use-incomes'
import { useMonthlyIncomeTotal } from '@/hooks/use-monthly-incomes'
import { useBudgetByPeriod } from '@/hooks/use-budgets'
import { useCategories } from '@/hooks/use-categories'
import { getCurrentBudgetPeriod, formatPeriodDisplay } from '@/lib/utils/budget-period'
import { KPICards } from '@/components/dashboard/kpi-cards'
import { BudgetOverview } from '@/components/dashboard/budget-overview'
import { RecentExpenses } from '@/components/dashboard/recent-expenses'
import { ShowMyMonthCard } from '@/components/dashboard/show-my-month-card'
import { PersonBudgetBreakdown } from '@/components/dashboard/person-budget-breakdown'
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton'
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
  
  const { data: expenses = [], isLoading: expensesLoading } = useExpensesByPeriod(salaryDay)
  const { data: householdIncome } = useHouseholdIncome()
  const { data: monthlyIncomeTotal } = useMonthlyIncomeTotal(currentPeriod.period)
  const { data: budget } = useBudgetByPeriod(currentPeriod.period)

  if (userLoading || expensesLoading) {
    return <DashboardSkeleton />
  }

  // Calculate totals - prefer monthly income if available, otherwise use static household income
  const monthlyTotal = monthlyIncomeTotal?.total_income ?? 0
  const totalIncome = monthlyTotal > 0
    ? monthlyTotal
    : (householdIncome?.total_income ?? 0)

  // Calculate TOTAL spent (household view - sum of all expenses including savings)
  // When partners are connected, dashboard shows total household expenses
  const totalSpent = expenses.reduce((sum, exp) => {
    return sum + exp.amount
  }, 0)

  // Calculate user's portion of expenses (for per-person breakdown)
  // - personal: full amount
  // - shared: 50% of the amount (split with partner)
  // - partner: 0 (doesn't count toward user's budget, partner pays)
  const userSpent = expenses.reduce((sum, exp) => {
    const assignment = exp.cost_assignment || 'personal'
    if (assignment === 'partner') return sum // Partner pays, not user
    if (assignment === 'shared') return sum + (exp.amount / 2) // 50/50 split
    return sum + exp.amount // personal - full amount
  }, 0)

  // Calculate partner's portion of expenses
  const partnerSpent = expenses.reduce((sum, exp) => {
    const assignment = exp.cost_assignment || 'personal'
    if (assignment === 'personal') return sum // User pays, not partner
    if (assignment === 'shared') return sum + (exp.amount / 2) // 50/50 split
    return sum + exp.amount // partner - full amount
  }, 0)

  // Calculate actual savings from expenses in savings categories
  const actualSavings = expenses.reduce((sum, exp) => {
    if (exp.category?.cost_type === 'Savings') {
      return sum + exp.amount
    }
    return sum
  }, 0)

  // Calculate budget amounts by type
  const budgetItems = {
    fixed: budget?.budget_items
      ?.filter(item => item.type === 'fixedExpense')
      .reduce((sum, item) => sum + item.amount, 0) || 0,
    variable: budget?.budget_items
      ?.filter(item => item.type === 'variableExpense')
      .reduce((sum, item) => sum + item.amount, 0) || 0,
    savings: budget?.budget_items
      ?.filter(item => item.type === 'savings')
      .reduce((sum, item) => sum + item.amount, 0) || 0,
  }

  // KPIs are always budget-based, never income-based
  const hasBudget = !!(budget && (budgetItems.fixed + budgetItems.variable + budgetItems.savings) > 0)
  const totalBudgetedExpenses = budgetItems.fixed + budgetItems.variable + budgetItems.savings
  const availableToSpend = hasBudget
    ? totalBudgetedExpenses  // Budget amount for expenses
    : totalIncome            // Full income when no budget

  const savingsRate = totalIncome > 0 
    ? (budgetItems.savings / totalIncome) * 100 
    : 0

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-5">
      {/* Desktop title (mobile shows in header) */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="hidden md:block space-y-1"
      >
        <h1 className="font-serif text-[32px] font-medium tracking-tight">Översikt</h1>
        <p className="text-sm text-muted-foreground">
          {formatPeriodDisplay(currentPeriod.period)}
        </p>
      </motion.div>

      {/* Mobile period strip */}
      <div className="md:hidden flex items-center justify-center font-serif text-[15px] text-muted-foreground pt-1">
        {formatPeriodDisplay(currentPeriod.period)}
      </div>

      {/* KPI Cards */}
      <KPICards
        totalBudget={availableToSpend}
        totalSpent={totalSpent}
        savingsRate={savingsRate}
        salaryDay={salaryDay}
        hasBudget={hasBudget}
        totalIncome={totalIncome}
        actualSavings={actualSavings}
      />

      {/* Per-person breakdown - only show when partner is connected */}
      {hasPartner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <PersonBudgetBreakdown
            userName={user?.first_name || 'Du'}
            partnerName={partner?.first_name || 'Partner'}
            userSpent={userSpent}
            partnerSpent={partnerSpent}
            userBudget={availableToSpend / 2}
            partnerBudget={availableToSpend / 2}
          />
        </motion.div>
      )}

      {/* Budget Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <BudgetOverview
          expenses={expenses}
          budgetItems={budgetItems}
        />
      </motion.div>

      {/* Monthly Report CTA */}
      <ShowMyMonthCard />

      {/* Recent Expenses */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <RecentExpenses expenses={expenses.slice(0, 5)} />
      </motion.div>
    </div>
  )
}

