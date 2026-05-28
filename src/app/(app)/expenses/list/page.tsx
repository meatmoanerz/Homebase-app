'use client'

import { useState } from 'react'
import { useExpenses } from '@/hooks/use-expenses'
import { useUser } from '@/hooks/use-user'
import { ExpenseListSkeleton } from '@/components/expenses/expense-list-skeleton'
import { ExpenseEditDialog } from '@/components/expenses/expense-edit-dialog'
import { AssignmentPill, AmexPill } from '@/components/shared/assignment-pill'
import { PeriodStrip } from '@/components/shared/period-strip'
import { formatCurrency, formatRelativeDate } from '@/lib/utils/formatters'
import { getCurrentBudgetPeriod, formatPeriodDisplay, getRecentPeriods } from '@/lib/utils/budget-period'
import { motion, AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { ExpenseWithCategory, CostType } from '@/types'

const categoryIcons: Record<string, string> = {
  Mat: '🛒',
  Hem: '🏠',
  Kläder: '👕',
  Nöje: '🎬',
  Restaurang: '🍽️',
  Transport: '🚗',
  Kollektivtrafik: '🚌',
  Resor: '✈️',
  El: '⚡',
  Prenumerationer: '📱',
  Streaming: '🎬',
  Hälsa: '💊',
}

const TYPE_FILTERS: Array<{ value: 'all' | CostType; label: string }> = [
  { value: 'all', label: 'Alla' },
  { value: 'Fixed', label: 'Fast' },
  { value: 'Variable', label: 'Rörligt' },
  { value: 'Savings', label: 'Spar' },
]

export default function ExpenseListPage() {
  const { data: user } = useUser()
  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay)

  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod.period)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | CostType>('all')
  const [editExpense, setEditExpense] = useState<ExpenseWithCategory | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const { data: expenses = [], isLoading } = useExpenses({ period: selectedPeriod, salaryDay })
  const recentPeriods = getRecentPeriods(salaryDay, 6)

  const handleEditExpense = (expense: ExpenseWithCategory) => {
    setEditExpense(expense)
    setEditDialogOpen(true)
  }

  const filteredExpenses = expenses.filter((expense) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      expense.description.toLowerCase().includes(q) ||
      expense.category?.name.toLowerCase().includes(q)
    const matchesType = typeFilter === 'all' || expense.category?.cost_type === typeFilter
    return matchesSearch && matchesType
  })

  const groupedExpenses = filteredExpenses.reduce((groups, expense) => {
    const date = expense.date
    if (!groups[date]) groups[date] = []
    groups[date].push(expense)
    return groups
  }, {} as Record<string, ExpenseWithCategory[]>)

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const currentIndex = recentPeriods.findIndex(p => p.period === selectedPeriod)
    if (direction === 'prev' && currentIndex < recentPeriods.length - 1) {
      setSelectedPeriod(recentPeriods[currentIndex + 1].period)
    } else if (direction === 'next' && currentIndex > 0) {
      setSelectedPeriod(recentPeriods[currentIndex - 1].period)
    }
  }

  if (isLoading) {
    return <ExpenseListSkeleton />
  }

  const totalSpent = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0)

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-4">
      {/* Desktop title */}
      <div className="hidden md:block">
        <h1 className="font-serif text-[32px] font-medium tracking-tight">Utgifter</h1>
        <p className="text-sm text-muted-foreground mt-1">Alla transaktioner</p>
      </div>

      {/* Period navigation */}
      <PeriodStrip
        label={formatPeriodDisplay(selectedPeriod)}
        range={`${formatCurrency(totalSpent)} totalt`}
        onPrevious={() => navigatePeriod('prev')}
        onNext={() => navigatePeriod('next')}
        disabledNext={selectedPeriod === currentPeriod.period}
      />

      {/* Inline search */}
      <div className="flex items-center gap-2.5 bg-card border border-border rounded-xl px-3.5 py-2.5">
        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          placeholder="Sök i utgifter…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
      </div>

      {/* Type filter pills */}
      <div className="flex gap-1.5 bg-secondary rounded-full p-1">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={cn(
              'flex-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              typeFilter === f.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Expense list */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-12 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Inga utgifter hittades</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {Object.entries(groupedExpenses)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, dayExpenses]) => (
                <motion.div
                  key={date}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                      {formatRelativeDate(date)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatCurrency(dayExpenses.reduce((s, e) => s + e.amount, 0))}
                    </span>
                  </div>
                  <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    {dayExpenses.map((expense) => (
                      <button
                        key={expense.id}
                        type="button"
                        onClick={() => handleEditExpense(expense)}
                        className="flex items-center justify-between px-4 py-3.5 border-b border-border last:border-b-0 hover:bg-secondary/40 active:bg-secondary transition-colors w-full text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-secondary grid place-items-center text-base flex-shrink-0">
                            {categoryIcons[expense.category?.name ?? ''] || '💰'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm tracking-tight truncate">
                              {expense.description}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-[11px] text-muted-foreground">
                                {expense.category?.name}
                              </span>
                              {expense.is_ccm && <AmexPill />}
                              <AssignmentPill assignment={expense.cost_assignment} />
                            </div>
                          </div>
                        </div>
                        <span className="font-serif text-[16px] font-medium tracking-tight ml-2 flex-shrink-0">
                          {formatCurrency(expense.amount)}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      )}

      <ExpenseEditDialog
        expense={editExpense}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  )
}
