'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTemporaryBudget } from '@/hooks/use-temporary-budgets'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { LoadingPage } from '@/components/shared/loading-spinner'
import { TemporaryBudgetSettingsDialog } from '@/components/budget/temporary-budget-settings-dialog'
import { TemporaryBudgetExpenseForm } from '@/components/budget/temporary-budget-expense-form'
import { ExpenseEditDialog } from '@/components/expenses/expense-edit-dialog'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { getCurrency, formatCurrencyAmount, convertFromSEK } from '@/lib/utils/currencies'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Settings,
  Plus,
  Edit2,
  ChevronRight,
  Calendar,
  TrendingDown,
  Target,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { ExpenseWithCategory } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TemporaryBudgetDetailProps {
  id: string
}

export function TemporaryBudgetDetail({ id }: TemporaryBudgetDetailProps) {
  const router = useRouter()
  const { data: budget, isLoading } = useTemporaryBudget(id)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedExpense, setSelectedExpense] = useState<ExpenseWithCategory | null>(null)
  const [expenseEditOpen, setExpenseEditOpen] = useState(false)

  const isNonSEK = budget?.currency !== 'SEK'
  const currencyInfo = budget ? getCurrency(budget.currency) : null

  // Calculate spending per category
  const spendingByCategory = useMemo(() => {
    if (!budget?.expenses) return {}
    return budget.expenses.reduce((acc, expense) => {
      const catId = expense.temporary_budget_category_id
      if (catId) {
        acc[catId] = (acc[catId] || 0) + expense.amount
      }
      return acc
    }, {} as Record<string, number>)
  }, [budget])

  // Calculate uncategorized spending
  const uncategorizedSpending = useMemo(() => {
    if (!budget?.expenses) return 0
    return budget.expenses
      .filter((e) => !e.temporary_budget_category_id)
      .reduce((sum, e) => sum + e.amount, 0)
  }, [budget])

  // Total spent calculation
  const totalSpent = useMemo(() => {
    if (!budget?.expenses) return 0
    return budget.expenses.reduce((sum, e) => sum + e.amount, 0)
  }, [budget])

  // Date calculations
  const dateInfo = useMemo(() => {
    if (!budget) return null
    const start = new Date(budget.start_date)
    const end = new Date(budget.end_date)
    const now = new Date()
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const elapsed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    const remaining = Math.max(0, totalDays - elapsed)
    const progress = Math.min(100, (elapsed / totalDays) * 100)

    return { totalDays, elapsed, remaining, progress, start, end }
  }, [budget])

  // Daily budget suggestion
  const dailyBudget = useMemo(() => {
    if (!budget || !dateInfo || dateInfo.remaining <= 0) return 0
    const remainingBudget = budget.total_budget - totalSpent
    return Math.max(0, Math.round(remainingBudget / dateInfo.remaining))
  }, [budget, totalSpent, dateInfo])

  // Get expenses for a specific category
  const getExpensesForCategory = (categoryId: string | null) => {
    if (!budget?.expenses) return []
    if (categoryId === null) {
      return budget.expenses.filter((e) => !e.temporary_budget_category_id)
    }
    return budget.expenses.filter((e) => e.temporary_budget_category_id === categoryId)
  }

  if (isLoading) return <LoadingPage />

  if (!budget) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Projektbudget hittades inte</p>
        <Button asChild className="mt-4">
          <Link href="/budget">Tillbaka</Link>
        </Button>
      </div>
    )
  }

  const spentRatio = budget.total_budget > 0 ? (totalSpent / budget.total_budget) * 100 : 0
  const isOverBudget = totalSpent > budget.total_budget
  const isCompleted = budget.status === 'completed'

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-hb-cognac truncate">{budget.name}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>
              {formatDate(budget.start_date)} — {formatDate(budget.end_date)}
            </span>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                <CheckCircle2 className="w-3 h-3" /> Klar
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/budget/project/${id}/edit`}>
            <Edit2 className="w-4 h-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
          <Settings className="w-4 h-4" />
        </Button>
      </motion.div>

      {/* Overview Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="border-0 shadow-sm bg-gradient-to-br from-hb-sand/80 to-hb-sand/50 text-hb-cognac">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-hb-cognac/60 text-sm">Spenderat</p>
                <p className={cn('text-3xl font-bold', isOverBudget && 'text-destructive')}>
                  {isNonSEK
                    ? formatCurrencyAmount(
                        convertFromSEK(totalSpent, budget.exchange_rate),
                        budget.currency
                      )
                    : formatCurrency(totalSpent)}
                </p>
                {isNonSEK && (
                  <p className="text-xs text-hb-cognac/50 mt-0.5">
                    {formatCurrency(totalSpent)}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-hb-cognac/60 text-sm">Budget</p>
                <p className="text-xl font-semibold">
                  {isNonSEK
                    ? formatCurrencyAmount(
                        convertFromSEK(budget.total_budget, budget.exchange_rate),
                        budget.currency
                      )
                    : formatCurrency(budget.total_budget)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Progress
                value={Math.min(spentRatio, 100)}
                className={cn('h-2.5 bg-white/40', isOverBudget && '[&>div]:bg-destructive')}
              />
              <div className="flex justify-between text-xs text-hb-cognac/60">
                <span>{Math.round(spentRatio)}% förbrukat</span>
                <span>
                  {isNonSEK
                    ? formatCurrencyAmount(
                        convertFromSEK(
                          Math.max(0, budget.total_budget - totalSpent),
                          budget.exchange_rate
                        ),
                        budget.currency
                      )
                    : formatCurrency(Math.max(0, budget.total_budget - totalSpent))}{' '}
                  kvar
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3"
      >
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Dagar kvar</p>
            <p className="font-semibold text-sm">{dateInfo?.remaining || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Dagsbudget</p>
            <p className="font-semibold text-sm">
              {isNonSEK
                ? formatCurrencyAmount(
                    convertFromSEK(dailyBudget, budget.exchange_rate),
                    budget.currency
                  )
                : formatCurrency(dailyBudget)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Utgifter</p>
            <p className="font-semibold text-sm">{budget.expenses?.length || 0}</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Time Progress */}
      {dateInfo && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Tidsförlopp</span>
                <span className="text-xs text-muted-foreground">
                  Dag {Math.min(dateInfo.elapsed, dateInfo.totalDays)} / {dateInfo.totalDays}
                </span>
              </div>
              <Progress value={dateInfo.progress} className="h-1.5" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Categories */}
      {budget.temporary_budget_categories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-hb-sand/20 flex items-center justify-center">
                  <Target className="w-4 h-4 text-hb-cognac" />
                </div>
                <CardTitle className="text-sm font-medium">Kategorier</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {budget.temporary_budget_categories
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((cat) => {
                  const spent = spendingByCategory[cat.id] || 0
                  const pct = cat.budgeted_amount > 0 ? (spent / cat.budgeted_amount) * 100 : spent > 0 ? 100 : 0
                  const over = spent > cat.budgeted_amount && cat.budgeted_amount > 0

                  return (
                    <div
                      key={cat.id}
                      className="space-y-1 p-2 -mx-2 rounded-lg cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors"
                      onClick={() => setSelectedCategoryId(cat.id)}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{cat.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn('font-medium', over && 'text-destructive')}>
                            {isNonSEK
                              ? `${formatCurrencyAmount(convertFromSEK(spent, budget.exchange_rate), budget.currency)} / ${formatCurrencyAmount(convertFromSEK(cat.budgeted_amount, budget.exchange_rate), budget.currency)}`
                              : `${formatCurrency(spent)} / ${formatCurrency(cat.budgeted_amount)}`}
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      <Progress
                        value={Math.min(pct, 100)}
                        className={cn('h-1.5', over && '[&>div]:bg-destructive')}
                      />
                    </div>
                  )
                })}

              {/* Uncategorized */}
              {uncategorizedSpending > 0 && (
                <div
                  className="space-y-1 p-2 -mx-2 rounded-lg cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors"
                  onClick={() => setSelectedCategoryId('uncategorized')}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground italic">Okategoriserat</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {isNonSEK
                          ? formatCurrencyAmount(
                              convertFromSEK(uncategorizedSpending, budget.exchange_rate),
                              budget.currency
                            )
                          : formatCurrency(uncategorizedSpending)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recent Expenses */}
      {budget.expenses && budget.expenses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-hb-cognac/10 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-hb-cognac" />
                </div>
                <CardTitle className="text-sm font-medium">Senaste utgifter</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {budget.expenses.slice(0, 5).map((expense) => {
                const tbCat = budget.temporary_budget_categories.find(
                  (c) => c.id === expense.temporary_budget_category_id
                )
                return (
                  <div
                    key={expense.id}
                    onClick={() => {
                      setSelectedExpense(expense)
                      setExpenseEditOpen(true)
                    }}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(expense.date)}
                        {tbCat && <span className="ml-2">{tbCat.name}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        {isNonSEK && expense.original_amount ? (
                          <>
                            <span className="font-semibold text-sm">
                              {formatCurrencyAmount(expense.original_amount, budget.currency)}
                            </span>
                            <p className="text-[10px] text-muted-foreground">
                              {formatCurrency(expense.amount)}
                            </p>
                          </>
                        ) : (
                          <span className="font-semibold text-sm">
                            {formatCurrency(expense.amount)}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Add Expense FAB */}
      {!isCompleted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="fixed bottom-20 right-4 z-40"
        >
          <Button
            onClick={() => setAddExpenseOpen(true)}
            className="w-14 h-14 rounded-full bg-hb-cognac hover:bg-hb-cognac/90 shadow-lg shadow-hb-cognac/30"
            size="icon"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </motion.div>
      )}

      {/* Category Drill-down Dialog */}
      <Dialog
        open={selectedCategoryId !== null}
        onOpenChange={(open) => !open && setSelectedCategoryId(null)}
      >
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedCategoryId === 'uncategorized'
                ? 'Okategoriserat'
                : budget.temporary_budget_categories.find((c) => c.id === selectedCategoryId)
                    ?.name || 'Utgifter'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {(() => {
              const expenses = getExpensesForCategory(
                selectedCategoryId === 'uncategorized' ? null : selectedCategoryId
              )
              if (expenses.length === 0) {
                return (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>Inga utgifter i denna kategori</p>
                  </div>
                )
              }
              return (
                <div className="space-y-2 pb-4">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      onClick={() => {
                        setSelectedCategoryId(null)
                        setSelectedExpense(expense)
                        setExpenseEditOpen(true)
                      }}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{expense.description}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(expense.date)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {formatCurrency(expense.amount)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <TemporaryBudgetSettingsDialog
        budget={budget}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      {/* Add Expense Dialog */}
      <TemporaryBudgetExpenseForm
        budget={budget}
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
      />

      {/* Expense Edit Dialog */}
      <ExpenseEditDialog
        expense={selectedExpense}
        open={expenseEditOpen}
        onOpenChange={(open) => {
          setExpenseEditOpen(open)
          if (!open) setSelectedExpense(null)
        }}
      />
    </div>
  )
}
