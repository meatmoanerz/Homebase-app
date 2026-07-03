'use client'

import { useState } from 'react'
import { SavingsGoalForm } from '@/components/savings/savings-goal-form'
import { SavingsGoalCard } from '@/components/savings/savings-goal-card'
import { Card, CardContent } from '@/components/ui/card'
import { useSavingsGoals } from '@/hooks/use-savings-goals'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { SavingsGoalWithCategory } from '@/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Target, CheckCircle2, PiggyBank, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type TabType = 'new' | 'active' | 'completed'

const tabs = [
  { id: 'new' as const, label: 'Nytt', icon: Plus },
  { id: 'active' as const, label: 'Aktiva', icon: Target },
  { id: 'completed' as const, label: 'Uppnådda', icon: CheckCircle2 },
]

const subtitles: Record<TabType, string> = {
  new: 'Skapa ett nytt sparmål',
  active: 'Dina pågående sparmål',
  completed: 'Mål du har uppnått',
}

export default function SavingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const [editingGoal, setEditingGoal] = useState<SavingsGoalWithCategory | null>(null)
  const { data: savingsGoals = [], isLoading } = useSavingsGoals()

  // Separate active and completed goals (null status counts as active)
  const activeGoals = savingsGoals.filter(g => g.status === 'active' || !g.status)
  const completedGoals = savingsGoals.filter(g => g.status === 'completed')

  // Calculate totals - for shared goals, use user amounts; for personal goals, use starting_balance
  const totalSaved = savingsGoals.reduce((sum, goal) => {
    const goalAmount = goal.is_shared
      ? goal.starting_balance_user1 + goal.starting_balance_user2
      : goal.starting_balance
    return sum + goalAmount
  }, 0)
  const totalTarget = activeGoals.reduce((sum, goal) => sum + (goal.target_amount || 0), 0)
  const totalMonthlySavings = activeGoals
    .filter(g => g.monthly_savings_enabled)
    .reduce((sum, goal) => sum + goal.monthly_savings_amount, 0)

  const handleGoalCreated = () => {
    setActiveTab('active')
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-hb-cognac">Sparmål</h1>
        <p className="text-sm text-muted-foreground">{subtitles[activeTab]}</p>
      </motion.div>

      {/* Summary Cards */}
      {activeGoals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-3"
        >
          <Card className="border-0 shadow-sm bg-hb-sage/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <PiggyBank className="w-4 h-4 text-hb-cognac" />
                <span className="text-xs text-muted-foreground">Totalt sparat</span>
              </div>
              <p className="text-xl font-bold text-hb-cognac">{formatCurrency(totalSaved)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-hb-sand-deep/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-hb-terracotta" />
                <span className="text-xs text-muted-foreground">Månadssparande</span>
              </div>
              <p className="text-xl font-bold text-hb-terracotta">{formatCurrency(totalMonthlySavings)}/mån</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-1 p-1 bg-muted/50 rounded-xl"
      >
        {tabs.map((tab) => {
          const count = tab.id === 'active' ? activeGoals.length :
                       tab.id === 'completed' ? completedGoals.length : null
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === tab.id
                  ? "bg-white dark:bg-card shadow-sm text-hb-cognac"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {count !== null && count > 0 && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id ? "bg-hb-sage/20" : "bg-muted"
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
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
                <SavingsGoalForm onSuccess={handleGoalCreated} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'active' && (
          <motion.div
            key="active"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {isLoading ? (
              // Loading skeleton
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Card key={i} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className="animate-pulse space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted" />
                          <div className="space-y-2 flex-1">
                            <div className="h-4 bg-muted rounded w-1/3" />
                            <div className="h-3 bg-muted rounded w-1/4" />
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : activeGoals.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center">
                  <Target className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Inga aktiva sparmål</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Skapa ditt första sparmål under "Nytt"
                  </p>
                </CardContent>
              </Card>
            ) : (
              activeGoals.map((goal, index) => (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <SavingsGoalCard goal={goal} onEdit={setEditingGoal} />
                </motion.div>
              ))
            )}

            {/* Overall progress if there are goals */}
            {activeGoals.length > 0 && totalTarget > 0 && (
              <Card className="border-0 shadow-sm bg-secondary/40">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Total progress</span>
                    <span className="text-sm text-muted-foreground">
                      {((totalSaved / totalTarget) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/50 dark:bg-card/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-hb-cognac rounded-full transition-all"
                      style={{ width: `${Math.min((totalSaved / totalTarget) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatCurrency(totalSaved)} av {formatCurrency(totalTarget)} totalt
                  </p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {activeTab === 'completed' && (
          <motion.div
            key="completed"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {completedGoals.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Inga uppnådda mål ännu</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Dina slutförda mål visas här
                  </p>
                </CardContent>
              </Card>
            ) : (
              completedGoals.map((goal, index) => (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <SavingsGoalCard goal={goal} onEdit={setEditingGoal} />
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit goal dialog */}
      <Dialog open={!!editingGoal} onOpenChange={(open) => !open && setEditingGoal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Redigera sparmål</DialogTitle>
          </DialogHeader>
          {editingGoal && (
            <SavingsGoalForm
              goal={editingGoal}
              onSuccess={() => setEditingGoal(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
