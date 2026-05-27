'use client'

import { useState } from 'react'
import { ExpenseForm } from '@/components/expenses/expense-form'
import { RecurringExpenseForm } from '@/components/expenses/recurring-expense-form'
import { RecurringExpensesList } from '@/components/expenses/recurring-expenses-list'
import { ExpenseEditDialog } from '@/components/expenses/expense-edit-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { useRecentExpenses } from '@/hooks/use-expenses'
import { useUser } from '@/hooks/use-user'
import { formatCurrency, formatRelativeDate } from '@/lib/utils/formatters'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Clock, Repeat, Users, UserCheck, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { ExpenseWithCategory } from '@/types'

type TabType = 'new' | 'recent' | 'recurring'
type FilterType = 'all' | 'ccm' | 'direct'

const tabs = [
  { id: 'new' as const, label: 'Ny', icon: Plus },
  { id: 'recent' as const, label: 'Senaste', icon: Clock },
  { id: 'recurring' as const, label: 'Återkommande', icon: Repeat },
]

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
}

const subtitles: Record<TabType, string> = {
  new: 'Registrera en ny kostnad',
  recent: 'Dina senaste registrerade',
  recurring: 'Automatiska utgifter',
}

export default function AddExpensePage() {
  const [activeTab, setActiveTab] = useState<TabType>('new')
  const [filter, setFilter] = useState<FilterType>('all')
  const [editExpense, setEditExpense] = useState<ExpenseWithCategory | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const { data: user } = useUser()
  const { data: recentExpenses = [], refetch } = useRecentExpenses(50) // Get more to filter

  // Filter expenses based on selected filter
  const filteredExpenses = recentExpenses.filter(expense => {
    if (filter === 'all') return true
    if (filter === 'ccm') return expense.is_ccm
    if (filter === 'direct') return !expense.is_ccm
    return true
  }).slice(0, 10) // Show max 10

  const handleExpenseAdded = () => {
    refetch()
  }

  const handleEditExpense = (expense: ExpenseWithCategory) => {
    setEditExpense(expense)
    setEditDialogOpen(true)
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-hb-cognac">Utgifter</h1>
        <p className="text-sm text-muted-foreground">{subtitles[activeTab]}</p>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex gap-1 p-1 bg-muted/50 rounded-xl"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 min-h-[44px] rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98]",
              activeTab === tab.id
                ? "bg-white dark:bg-card shadow-sm text-hb-cognac"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'new' && (
          <motion.div
            key="new"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <ExpenseForm onSuccess={handleExpenseAdded} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'recent' && (
          <motion.div
            key="recent"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {/* Filter buttons - only show if CCM is enabled */}
            {user?.ccm_enabled && (
              <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
                <button
                  onClick={() => setFilter('all')}
                  className={cn(
                    "flex-1 py-2.5 px-3 min-h-[44px] rounded-md text-xs font-medium transition-all active:scale-[0.98]",
                    filter === 'all'
                      ? "bg-white dark:bg-card shadow-sm text-hb-cognac"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Alla
                </button>
                <button
                  onClick={() => setFilter('ccm')}
                  className={cn(
                    "flex-1 py-2.5 px-3 min-h-[44px] rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 active:scale-[0.98]",
                    filter === 'ccm'
                      ? "bg-white dark:bg-card shadow-sm text-hb-terracotta"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CreditCard className="w-3 h-3" />
                  Kreditkort
                </button>
                <button
                  onClick={() => setFilter('direct')}
                  className={cn(
                    "flex-1 py-2.5 px-3 min-h-[44px] rounded-md text-xs font-medium transition-all active:scale-[0.98]",
                    filter === 'direct'
                      ? "bg-white dark:bg-card shadow-sm text-hb-cognac"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Direkta
                </button>
              </div>
            )}

            {filteredExpenses.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">
                    {filter === 'ccm' ? 'Inga kreditkortsutgifter' : filter === 'direct' ? 'Inga direkta utgifter' : 'Inga utgifter än'}
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    {filter === 'all' ? 'Lägg till din första utgift under "Ny"' : 'Ändra filter för att se fler'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {filteredExpenses.map((expense, index) => (
                    <motion.button
                      key={expense.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleEditExpense(expense)}
                      className={cn(
                        "flex items-center justify-between p-4 hover:bg-muted/30 active:bg-muted/50 active:scale-[0.99] transition-all w-full text-left",
                        index !== filteredExpenses.length - 1 && "border-b border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-hb-sage/20 flex items-center justify-center text-lg">
                          {categoryIcons[expense.category?.name || ''] || '💰'}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{expense.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {expense.category?.name} • {formatRelativeDate(expense.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Cost assignment indicator */}
                        {expense.cost_assignment === 'shared' && (
                          <div className="w-5 h-5 rounded-full bg-hb-tim/20 flex items-center justify-center" title="Delad utgift">
                            <Users className="w-3 h-3 text-hb-tim" />
                          </div>
                        )}
                        {expense.cost_assignment === 'partner' && (
                          <div className="w-5 h-5 rounded-full bg-hb-terracotta/20 flex items-center justify-center" title="Partnerns utgift">
                            <UserCheck className="w-3 h-3 text-hb-terracotta" />
                          </div>
                        )}
                        <span className={cn(
                          "font-semibold",
                          expense.is_ccm ? "text-hb-tim" : ""
                        )}>
                          -{formatCurrency(expense.amount)}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {activeTab === 'recurring' && (
          <motion.div
            key="recurring"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <RecurringExpenseForm />
              </CardContent>
            </Card>
            <RecurringExpensesList />
          </motion.div>
        )}

      </AnimatePresence>

      {/* Edit Dialog */}
      <ExpenseEditDialog
        expense={editExpense}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  )
}
