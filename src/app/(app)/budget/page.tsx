'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useBudgets } from '@/hooks/use-budgets'
import { useTemporaryBudgets } from '@/hooks/use-temporary-budgets'
import { useExpensesByPeriod } from '@/hooks/use-expenses'
import { useUser, usePartner } from '@/hooks/use-user'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { BudgetListSkeleton } from '@/components/budget/budget-list-skeleton'
import { IncomeOverviewCard } from '@/components/budget/income-overview-card'
import { formatCurrency, formatPercentage, formatDate } from '@/lib/utils/formatters'
import { formatPeriodDisplay, getCurrentBudgetPeriod } from '@/lib/utils/budget-period'
import { getCurrency, formatCurrencyAmount, convertFromSEK } from '@/lib/utils/currencies'
import { motion } from 'framer-motion'
import { Plus, ChevronRight, Wallet, Users, FolderOpen, Archive, Calendar, Target } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Budget, TemporaryBudgetWithCategories } from '@/types'

export default function BudgetListPage() {
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { data: budgets, isLoading: budgetsLoading } = useBudgets()
  const { data: tempBudgets, isLoading: tempLoading } = useTemporaryBudgets()

  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay)
  const hasPartner = !!partner

  // Filter out archived monthly budgets
  const activeBudgets = useMemo(() => {
    return budgets?.filter(b => !b.is_archived) || []
  }, [budgets])

  if (budgetsLoading) {
    return <BudgetListSkeleton />
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-hb-cognac">Budgetar</h1>
          <p className="text-sm text-muted-foreground">Hantera dina budgetar</p>
        </div>
        <Button asChild>
          <Link href="/budget/new">
            <Plus className="w-4 h-4 mr-2" />
            Ny budget
          </Link>
        </Button>
      </motion.div>

      {/* Current Period Highlight */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-0 shadow-sm bg-gradient-to-br from-hb-cognac to-hb-cognac/80 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/70 text-sm">Aktuell period</p>
                <p className="text-xl font-bold capitalize">
                  {formatPeriodDisplay(currentPeriod.period)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
            {activeBudgets.find(b => b.period === currentPeriod.period) ? (
              <Link
                href={`/budget/${activeBudgets.find(b => b.period === currentPeriod.period)?.id}`}
                className="inline-flex items-center text-sm text-white/90 hover:text-white"
              >
                Visa budget
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            ) : (
              <Link
                href={`/budget/new?period=${currentPeriod.period}`}
                className="inline-flex items-center text-sm text-white/90 hover:text-white"
              >
                Skapa budget för denna period
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Monthly Income Card */}
      <IncomeOverviewCard period={currentPeriod.period} />

      {/* Monthly Budget List */}
      {activeBudgets.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-hb-sage/30 flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-hb-cognac" />
              </div>
              <h3 className="font-semibold mb-2">Inga budgetar ännu</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Skapa din första budget för att börja planera din ekonomi
              </p>
              <Button asChild>
                <Link href="/budget/new">Skapa budget</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {activeBudgets.map((budget, index) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              index={index}
              isCurrent={budget.period === currentPeriod.period}
              salaryDay={salaryDay}
              hasPartner={hasPartner}
            />
          ))}
        </div>
      )}

      {/* Project Budgets Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-hb-cognac" />
            <h2 className="text-lg font-semibold text-hb-cognac">Projektbudgetar</h2>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/budget/project/new">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Ny
            </Link>
          </Button>
        </div>

        {!tempBudgets || tempBudgets.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-hb-sand/30 flex items-center justify-center mx-auto mb-3">
                <Target className="w-6 h-6 text-hb-cognac" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Inga projektbudgetar</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Skapa en budget för resor, renoveringar eller andra projekt
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/budget/project/new">Skapa projektbudget</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tempBudgets.map((tb, index) => (
              <TemporaryBudgetCard key={tb.id} budget={tb} index={index} />
            ))}
          </div>
        )}
      </motion.div>

      {/* Archive Link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="pt-2"
      >
        <Link
          href="/budget/archive"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-hb-cognac transition-colors py-3"
        >
          <Archive className="w-4 h-4" />
          Visa arkiv
        </Link>
      </motion.div>
    </div>
  )
}

function BudgetCard({ budget, index, isCurrent, salaryDay, hasPartner }: { budget: Budget; index: number; isCurrent: boolean; salaryDay: number; hasPartner: boolean }) {
  const { data: expenses } = useExpensesByPeriod(budget.period, salaryDay)

  const actualSpent = useMemo(() => {
    if (!expenses) return 0

    if (hasPartner) {
      return expenses.reduce((sum, expense) => {
        return sum + expense.amount
      }, 0)
    }

    return expenses.reduce((sum, expense) => {
      const assignment = expense.cost_assignment || 'personal'

      if (assignment === 'personal') {
        return sum + expense.amount
      } else if (assignment === 'shared') {
        return sum + expense.amount / 2
      }
      return sum
    }, 0)
  }, [expenses, hasPartner])

  const budgetedExpenses = (budget.total_expenses || 0) + (budget.total_savings || 0)

  const spentRatio = budgetedExpenses > 0
    ? (actualSpent / budgetedExpenses) * 100
    : 0

  const remaining = budgetedExpenses - actualSpent

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05 }}
    >
      <Link href={`/budget/${budget.id}`}>
        <Card className={cn(
          "border-0 shadow-sm transition-all hover:shadow-md",
          isCurrent && "ring-2 ring-hb-cognac"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold capitalize">
                  {formatPeriodDisplay(budget.period)}
                </p>
                {isCurrent && (
                  <span className="text-xs text-hb-cognac font-medium">Aktuell</span>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  Förbrukat
                  {hasPartner && <Users className="w-3 h-3 text-hb-tim" />}
                </span>
                <span className="font-medium">
                  {formatCurrency(actualSpent)} / {formatCurrency(budgetedExpenses)}
                </span>
              </div>
              <Progress value={Math.min(spentRatio, 100)} className="h-2" />
            </div>

            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>Sparkvot: {formatPercentage(budget.savings_ratio)}</span>
              <span className={cn(remaining < 0 && "text-destructive")}>
                Kvar: {formatCurrency(remaining)}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

function TemporaryBudgetCard({ budget, index }: { budget: TemporaryBudgetWithCategories; index: number }) {
  const isNonSEK = budget.currency !== 'SEK'
  const currencyInfo = getCurrency(budget.currency)

  const spentRatio = budget.total_budget > 0
    ? (budget.total_spent / budget.total_budget) * 100
    : 0

  const isOverBudget = budget.total_spent > budget.total_budget

  // Calculate days remaining
  const endDate = new Date(budget.end_date)
  const now = new Date()
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  const isExpired = daysRemaining === 0
  const isCompleted = budget.status === 'completed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.05 }}
    >
      <Link href={`/budget/project/${budget.id}`}>
        <Card className={cn(
          "border-0 shadow-sm transition-all hover:shadow-md border-l-4 border-l-hb-sand",
          isCompleted && "opacity-75"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{budget.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {formatDate(budget.start_date)} — {formatDate(budget.end_date)}
                  </span>
                  {isNonSEK && currencyInfo && (
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                      {currencyInfo.code}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Förbrukat</span>
                <span className={cn("font-medium", isOverBudget && "text-destructive")}>
                  {isNonSEK
                    ? `${formatCurrencyAmount(convertFromSEK(budget.total_spent, budget.exchange_rate), budget.currency)} / ${formatCurrencyAmount(convertFromSEK(budget.total_budget, budget.exchange_rate), budget.currency)}`
                    : `${formatCurrency(budget.total_spent)} / ${formatCurrency(budget.total_budget)}`}
                </span>
              </div>
              <Progress
                value={Math.min(spentRatio, 100)}
                className={cn("h-2", isOverBudget && "[&>div]:bg-destructive")}
              />
            </div>

            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <span>
                {isCompleted
                  ? 'Klar'
                  : isExpired
                    ? 'Avslutad'
                    : `${daysRemaining} dagar kvar`}
              </span>
              <span>{budget.temporary_budget_categories.length} kategorier</span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}
