'use client'

import { use, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBudget, useDeleteBudget } from '@/hooks/use-budgets'
import { useArchiveMonthlyBudget } from '@/hooks/use-temporary-budgets'
import { useExpensesByPeriod } from '@/hooks/use-expenses'
import { useUser, usePartner } from '@/hooks/use-user'
import { useHouseholdMonthlyIncomes, useMonthlyIncomeTotal } from '@/hooks/use-monthly-incomes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { LoadingPage } from '@/components/shared/loading-spinner'
import { formatCurrency, formatPercentage, formatDate } from '@/lib/utils/formatters'
import { formatPeriodDisplay, getCurrentBudgetPeriod } from '@/lib/utils/budget-period'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Archive,
  PiggyBank,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Users,
  User,
  UserCheck,
  ChevronRight,
  ChevronDown,
  Banknote
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { BudgetItem, Category, ExpenseWithCategory } from '@/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ExpenseEditDialog } from '@/components/expenses/expense-edit-dialog'

type BudgetViewMode = 'total' | 'mine' | 'partner'

export default function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { data: budget, isLoading } = useBudget(id)
  const deleteBudget = useDeleteBudget()
  const archiveBudget = useArchiveMonthlyBudget()
  const [viewMode, setViewMode] = useState<BudgetViewMode>('total')
  const [selectedCategory, setSelectedCategory] = useState<BudgetItem | null>(null)
  const [selectedExpense, setSelectedExpense] = useState<ExpenseWithCategory | null>(null)
  const [expenseEditOpen, setExpenseEditOpen] = useState(false)

  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay)
  const { data: expenses } = useExpensesByPeriod(budget?.period || '', salaryDay)
  const { data: householdIncomes } = useHouseholdMonthlyIncomes(budget?.period)
  const { data: incomeTotal } = useMonthlyIncomeTotal(budget?.period)
  const hasPartner = !!partner
  const [incomeExpanded, setIncomeExpanded] = useState(false)

  // Group budget items by type
  const groupedItems = useMemo(() => {
    if (!budget?.budget_items) return { fixed: [], variable: [], savings: [] }
    
    return {
      fixed: budget.budget_items.filter(item => item.type === 'fixedExpense'),
      variable: budget.budget_items.filter(item => item.type === 'variableExpense'),
      savings: budget.budget_items.filter(item => item.type === 'savings'),
    }
  }, [budget])

  // Calculate cashflow: budgeted expenses excluding credit card items
  const cashflow = useMemo(() => {
    if (!budget?.budget_items) return 0
    const budgetMultiplier = viewMode === 'total' ? 1 : 0.5
    return budget.budget_items
      .filter(item => !item.is_ccm && (item.type === 'fixedExpense' || item.type === 'variableExpense'))
      .reduce((sum, item) => sum + (item.amount * budgetMultiplier), 0)
  }, [budget, viewMode])

  // Calculate actual spending per category based on view mode
  // - total: all expenses at full amount (household view)
  // - mine: personal (100%) + shared (50%) + partner (0%)
  // - partner: partner (100%) + shared (50%) + personal (0%)
  const actualSpending = useMemo(() => {
    if (!expenses) return {}

    return expenses.reduce((acc, expense) => {
      const categoryId = expense.category_id
      if (!categoryId) return acc
      const assignment = expense.cost_assignment || 'personal'

      let amount = 0

      if (viewMode === 'total') {
        // Total view: count all expenses at full amount
        amount = expense.amount
      } else if (viewMode === 'mine') {
        // My view: personal (100%), shared (50%), partner (0%)
        if (assignment === 'personal') {
          amount = expense.amount
        } else if (assignment === 'shared') {
          amount = expense.amount / 2
        }
        // partner = 0
      } else if (viewMode === 'partner') {
        // Partner view: partner (100%), shared (50%), personal (0%)
        if (assignment === 'partner') {
          amount = expense.amount
        } else if (assignment === 'shared') {
          amount = expense.amount / 2
        }
        // personal = 0
      }

      if (!acc[categoryId]) acc[categoryId] = 0
      acc[categoryId] += amount
      return acc
    }, {} as Record<string, number>)
  }, [expenses, viewMode])

  // Find expenses with categories not in the budget
  const unbudgetedByCategory = useMemo(() => {
    if (!expenses || !budget?.budget_items) return {} as Record<string, { category: Category; expenses: ExpenseWithCategory[] }>

    const budgetedCategoryIds = new Set(
      budget.budget_items.map(item => item.category_id).filter(Boolean)
    )

    const unbudgeted = expenses.filter(expense =>
      expense.category_id && !budgetedCategoryIds.has(expense.category_id)
    )

    return unbudgeted.reduce((acc, expense) => {
      const categoryId = expense.category_id
      if (!categoryId || !expense.category) return acc
      if (!acc[categoryId]) {
        acc[categoryId] = {
          category: expense.category,
          expenses: [],
        }
      }
      acc[categoryId].expenses.push(expense)
      return acc
    }, {} as Record<string, { category: Category; expenses: ExpenseWithCategory[] }>)
  }, [expenses, budget])

  // Enhanced grouped items: include unbudgeted categories as zero-budget items in the main list
  const enhancedGroupedItems = useMemo(() => {
    const syntheticItems: BudgetItem[] = Object.entries(unbudgetedByCategory).map(
      ([categoryId, { category }]) => ({
        id: `unbudgeted-${categoryId}`,
        budget_id: budget?.id || '',
        category_id: categoryId,
        name: category?.name || 'Okänd kategori',
        type: category?.cost_type === 'Fixed' ? 'fixedExpense' : 'variableExpense',
        amount: 0,
        is_ccm: false,
        created_at: '',
      } as BudgetItem)
    )

    return {
      fixed: [...groupedItems.fixed, ...syntheticItems.filter(item => item.type === 'fixedExpense')],
      variable: [...groupedItems.variable, ...syntheticItems.filter(item => item.type === 'variableExpense')],
      savings: groupedItems.savings,
    }
  }, [groupedItems, unbudgetedByCategory, budget])

  // Calculate totals based on view mode
  // When viewing individual user, split the budget amount 50/50
  const totals = useMemo(() => {
    // Helper to get budget amount based on view mode
    const budgetMultiplier = viewMode === 'total' ? 1 : 0.5

    const fixedBudgeted = enhancedGroupedItems.fixed.reduce((sum, item) => sum + (item.amount * budgetMultiplier), 0)
    const variableBudgeted = enhancedGroupedItems.variable.reduce((sum, item) => sum + (item.amount * budgetMultiplier), 0)
    const savingsBudgeted = enhancedGroupedItems.savings.reduce((sum, item) => sum + (item.amount * budgetMultiplier), 0)

    const fixedActual = enhancedGroupedItems.fixed.reduce((sum, item) => sum + (actualSpending[item.category_id || ''] || 0), 0)
    const variableActual = enhancedGroupedItems.variable.reduce((sum, item) => sum + (actualSpending[item.category_id || ''] || 0), 0)
    const savingsActual = enhancedGroupedItems.savings.reduce((sum, item) => sum + (actualSpending[item.category_id || ''] || 0), 0)

    return {
      fixedBudgeted,
      variableBudgeted,
      savingsBudgeted,
      fixedActual,
      variableActual,
      savingsActual,
      totalBudgeted: fixedBudgeted + variableBudgeted + savingsBudgeted,
      totalActual: fixedActual + variableActual,
    }
  }, [enhancedGroupedItems, actualSpending, viewMode])

  // Get expenses filtered by category and view mode
  const getExpensesForCategory = (categoryId: string) => {
    if (!expenses) return []

    return expenses.filter(expense => {
      // Filter by category
      if (expense.category_id !== categoryId) return false

      // Filter by view mode
      const assignment = expense.cost_assignment || 'personal'
      if (viewMode === 'total') return true
      if (viewMode === 'mine') {
        return assignment === 'personal' || assignment === 'shared'
      }
      if (viewMode === 'partner') {
        return assignment === 'partner' || assignment === 'shared'
      }
      return true
    })
  }

  // Handle category click for drill-down
  const handleCategoryClick = (item: BudgetItem) => {
    setSelectedCategory(item)
  }

  // Handle expense click for editing
  const handleExpenseClick = (expense: ExpenseWithCategory) => {
    setSelectedExpense(expense)
    setExpenseEditOpen(true)
  }

  async function handleArchive() {
    try {
      await archiveBudget.mutateAsync(id)
      toast.success('Budget arkiverad')
      router.push('/budget')
    } catch {
      toast.error('Kunde inte arkivera budgeten')
    }
  }

  async function handleDelete() {
    try {
      await deleteBudget.mutateAsync(id)
      toast.success('Budget borttagen')
      router.push('/budget')
    } catch (error) {
      console.error('Delete budget error:', error)
      toast.error('Kunde inte ta bort budgeten')
    }
  }

  if (isLoading) {
    return <LoadingPage />
  }

  if (!budget) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Budget hittades inte</p>
        <Button asChild className="mt-4">
          <Link href="/budget">Tillbaka</Link>
        </Button>
      </div>
    )
  }

  const isCurrent = budget.period === currentPeriod.period
  // Income also follows view mode - split 50/50 for individual views
  const displayIncome = viewMode === 'total' ? budget.total_income : budget.total_income / 2
  // Calculate remaining: Total budgeted (fixed + variable + savings) - Actual spent
  // All money going out should be counted - both expenses and savings
  const remaining = totals.totalBudgeted - totals.totalActual
  // Calculate savings rate based on view mode
  const displaySavingsRate = displayIncome > 0 ? (totals.savingsBudgeted / displayIncome) * 100 : 0

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-hb-cognac capitalize">
            {formatPeriodDisplay(budget.period)}
          </h1>
          {isCurrent && (
            <span className="text-xs text-hb-cognac bg-hb-sage/30 px-2 py-0.5 rounded-full">
              Aktuell period
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/budget/${id}/edit`}>
            <Edit2 className="w-4 h-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleArchive}
          disabled={archiveBudget.isPending}
          title="Arkivera"
        >
          <Archive className="w-4 h-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ta bort budget?</AlertDialogTitle>
              <AlertDialogDescription>
                Är du säker på att du vill ta bort denna budget? Detta går inte att ångra.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Ta bort
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>

      {/* View Mode Toggle - only show when partner exists */}
      {hasPartner && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="flex justify-center"
        >
          <div className="inline-flex rounded-lg bg-muted p-1">
            <button
              onClick={() => setViewMode('total')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                viewMode === 'total'
                  ? "bg-white dark:bg-card text-hb-cognac shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Total
            </button>
            <button
              onClick={() => setViewMode('mine')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                viewMode === 'mine'
                  ? "bg-white dark:bg-card text-hb-cognac shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <User className="w-3.5 h-3.5" />
              {user?.first_name || 'Du'}
            </button>
            <button
              onClick={() => setViewMode('partner')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                viewMode === 'partner'
                  ? "bg-white dark:bg-card text-hb-cognac shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <UserCheck className="w-3.5 h-3.5" />
              {partner?.first_name || 'Partner'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Overview Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="border-0 shadow-sm bg-gradient-to-br from-hb-cognac to-hb-cognac/80 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/70 text-sm">Kvar att spendera</p>
                <p className={cn(
                  "text-3xl font-bold",
                  remaining < 0 && "text-hb-terracotta"
                )}>
                  {formatCurrency(remaining)}
                </p>
              </div>
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <Wallet className="w-7 h-7" />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-white/80">
                <span>Spenderat</span>
                <span>{formatCurrency(totals.totalActual)} / {formatCurrency(totals.totalBudgeted)}</span>
              </div>
              <Progress
                value={Math.min(100, (totals.totalActual / totals.totalBudgeted) * 100)}
                className="h-2 bg-white/20"
              />
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
            <p className="text-xs text-muted-foreground">Kassaflöde</p>
            <p className="font-semibold text-sm">{formatCurrency(cashflow)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Budgeterat</p>
            <p className="font-semibold text-sm">{formatCurrency(totals.totalBudgeted)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-success/10">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Sparkvot</p>
            <p className="font-semibold text-sm text-success">{formatPercentage(displaySavingsRate)}</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Expandable Income Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <Card className="border-0 shadow-sm">
          <CardHeader
            className="pb-2 cursor-pointer"
            onClick={() => setIncomeExpanded(!incomeExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-hb-sage/20 flex items-center justify-center">
                  <Banknote className="w-4 h-4 text-hb-cognac" />
                </div>
                <CardTitle className="text-sm font-medium">Inkomst</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">
                  {formatCurrency(incomeTotal?.total_income || budget.total_income)}
                </p>
                <ChevronDown className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  incomeExpanded && "rotate-180"
                )} />
              </div>
            </div>
          </CardHeader>
          <AnimatePresence>
            {incomeExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-0 space-y-2">
                  {householdIncomes && householdIncomes.length > 0 ? (
                    <>
                      {/* Group incomes by person */}
                      {(() => {
                        const grouped = householdIncomes.reduce((acc, income) => {
                          const key = income.owner_name
                          if (!acc[key]) acc[key] = { incomes: [], total: 0, isOwn: income.is_own }
                          acc[key].incomes.push(income)
                          acc[key].total += income.amount
                          return acc
                        }, {} as Record<string, { incomes: typeof householdIncomes; total: number; isOwn: boolean }>)

                        return Object.entries(grouped).map(([name, { incomes, total, isOwn }]) => (
                          <div key={name} className="p-3 rounded-xl bg-muted/50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center",
                                  isOwn ? "bg-hb-cognac/20" : "bg-hb-tim/20"
                                )}>
                                  {isOwn ? (
                                    <User className="w-3 h-3 text-hb-cognac" />
                                  ) : (
                                    <UserCheck className="w-3 h-3 text-hb-tim" />
                                  )}
                                </div>
                                <span className="text-sm font-medium">{name}</span>
                              </div>
                              <span className="text-sm font-semibold">{formatCurrency(total)}</span>
                            </div>
                            {incomes.map((income) => (
                              <div key={income.id} className="flex items-center justify-between text-xs text-muted-foreground ml-8">
                                <span>{income.name}</span>
                                <span>{formatCurrency(income.amount)}</span>
                              </div>
                            ))}
                          </div>
                        ))
                      })()}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Ingen inkomst registrerad
                    </p>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* Fixed Expenses */}
      {enhancedGroupedItems.fixed.length > 0 && (
        <BudgetSection
          title="Fasta kostnader"
          icon={<TrendingDown className="w-4 h-4" />}
          items={enhancedGroupedItems.fixed}
          actualSpending={actualSpending}
          budgetedTotal={totals.fixedBudgeted}
          actualTotal={totals.fixedActual}
          delay={0.15}
          onCategoryClick={handleCategoryClick}
          viewMode={viewMode}
        />
      )}

      {/* Variable Expenses */}
      {enhancedGroupedItems.variable.length > 0 && (
        <BudgetSection
          title="Rörliga kostnader"
          icon={<TrendingDown className="w-4 h-4" />}
          items={enhancedGroupedItems.variable}
          actualSpending={actualSpending}
          budgetedTotal={totals.variableBudgeted}
          actualTotal={totals.variableActual}
          delay={0.2}
          onCategoryClick={handleCategoryClick}
          viewMode={viewMode}
        />
      )}

      {/* Savings */}
      {enhancedGroupedItems.savings.length > 0 && (
        <BudgetSection
          title="Sparande"
          icon={<PiggyBank className="w-4 h-4" />}
          items={enhancedGroupedItems.savings}
          actualSpending={actualSpending}
          budgetedTotal={totals.savingsBudgeted}
          actualTotal={totals.savingsActual}
          delay={0.25}
          accentColor="success"
          onCategoryClick={handleCategoryClick}
          viewMode={viewMode}
        />
      )}

      {/* Category Drill-down Dialog */}
      <Dialog open={!!selectedCategory} onOpenChange={(open) => !open && setSelectedCategory(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedCategory?.name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {selectedCategory && formatCurrency(actualSpending[selectedCategory.category_id || ''] || 0)}
                {selectedCategory && selectedCategory.amount > 0
                  ? ` / ${formatCurrency(selectedCategory.amount)}`
                  : ' (ej budgeterat)'}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {selectedCategory && (() => {
              const categoryExpenses = getExpensesForCategory(selectedCategory.category_id || '')
              if (categoryExpenses.length === 0) {
                return (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>Inga utgifter i denna kategori</p>
                    <p className="text-xs mt-1">
                      {viewMode !== 'total' && '(för vald vy)'}
                    </p>
                  </div>
                )
              }
              return (
                <div className="space-y-2 pb-4">
                  {categoryExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      onClick={() => handleExpenseClick(expense)}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{expense.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(expense.date)}
                          {expense.cost_assignment === 'shared' && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <Users className="w-3 h-3" /> Delad
                            </span>
                          )}
                          {expense.cost_assignment === 'partner' && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <UserCheck className="w-3 h-3" /> {partner?.first_name || 'Partner'}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {formatCurrency(
                            viewMode === 'total'
                              ? expense.amount
                              : expense.cost_assignment === 'shared'
                                ? expense.amount / 2
                                : expense.amount
                          )}
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

interface BudgetSectionProps {
  title: string
  icon: React.ReactNode
  items: BudgetItem[]
  actualSpending: Record<string, number>
  budgetedTotal: number
  actualTotal: number
  delay: number
  accentColor?: 'default' | 'success'
  onCategoryClick?: (item: BudgetItem) => void
  viewMode?: BudgetViewMode
}

function BudgetSection({
  title,
  icon,
  items,
  actualSpending,
  budgetedTotal,
  actualTotal,
  delay,
  accentColor = 'default',
  onCategoryClick,
  viewMode = 'total',
}: BudgetSectionProps) {
  const isOverBudget = actualTotal > budgetedTotal

  // Helper function to get budget amount based on view mode
  const getItemBudget = (amount: number) => {
    if (viewMode === 'total') return amount
    return amount / 2 // 50/50 split for individual views
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                accentColor === 'success' ? "bg-success/10 text-success" : "bg-hb-cognac/10 text-hb-cognac"
              )}>
                {icon}
              </div>
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </div>
            <div className="text-right">
              <p className={cn(
                "text-sm font-semibold",
                isOverBudget && "text-destructive"
              )}>
                {formatCurrency(actualTotal)} / {formatCurrency(budgetedTotal)}
              </p>
              {isOverBudget && (
                <p className="text-xs text-destructive flex items-center gap-1 justify-end">
                  <AlertTriangle className="w-3 h-3" />
                  Över budget
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map(item => {
            const actual = actualSpending[item.category_id || ''] || 0
            const budgeted = getItemBudget(item.amount)
            const itemPercentage = budgeted > 0 ? (actual / budgeted) * 100 : (actual > 0 ? 100 : 0)
            const itemOverBudget = actual > budgeted

            return (
              <div
                key={item.id}
                className={cn(
                  "space-y-1 p-2 -mx-2 rounded-lg transition-colors",
                  onCategoryClick && "cursor-pointer hover:bg-muted/50 active:bg-muted"
                )}
                onClick={() => onCategoryClick?.(item)}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-medium",
                      itemOverBudget && "text-destructive"
                    )}>
                      {formatCurrency(actual)} / {formatCurrency(budgeted)}
                    </span>
                    {onCategoryClick && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <Progress
                  value={Math.min(itemPercentage, 100)}
                  className={cn(
                    "h-1.5",
                    itemOverBudget && "[&>div]:bg-destructive"
                  )}
                />
              </div>
            )
          })}
        </CardContent>
      </Card>
    </motion.div>
  )
}

