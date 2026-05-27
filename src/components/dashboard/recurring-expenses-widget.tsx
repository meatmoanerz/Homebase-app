'use client'

import { Card, CardContent } from '@/components/ui/card'
import { ComponentErrorBoundary } from '@/components/error/component-error-boundary'
import { formatCurrency } from '@/lib/utils/formatters'
import { useActiveRecurringExpenses } from '@/hooks/use-recurring-expenses'
import { RefreshCw, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

function RecurringExpensesWidgetContent() {
  const { data: recurringExpenses = [], isLoading } = useActiveRecurringExpenses()

  // Calculate total monthly recurring expenses
  const totalMonthly = recurringExpenses.reduce((sum, r) => sum + r.amount, 0)
  const activeCount = recurringExpenses.length

  // Find next upcoming recurring expense
  const today = new Date().getDate()
  const sortedByDay = [...recurringExpenses].sort((a, b) => a.day_of_month - b.day_of_month)

  // Find next expense this month or first one next month
  const nextThisMonth = sortedByDay.find(r => r.day_of_month >= today)
  const nextExpense = nextThisMonth || sortedByDay[0]

  // Calculate days until next expense
  const getDaysUntilNext = () => {
    if (!nextExpense) return null

    const now = new Date()
    const currentDay = now.getDate()
    const targetDay = nextExpense.day_of_month

    if (targetDay >= currentDay) {
      // Same month
      return targetDay - currentDay
    } else {
      // Next month - calculate days remaining in current month + target day
      const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      return (daysInCurrentMonth - currentDay) + targetDay
    }
  }

  const daysUntilNext = getDaysUntilNext()

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-6 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activeCount === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Återkommande</p>
                <p className="text-sm text-muted-foreground">Inga aktiva</p>
                <Link
                  href="/expenses?tab=recurring"
                  className="text-xs text-hb-terracotta hover:underline inline-flex items-center gap-1"
                >
                  Lägg till <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Återkommande</p>
              <p className="text-xl font-bold text-hb-cognac">
                {formatCurrency(totalMonthly)}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeCount} {activeCount === 1 ? 'utgift' : 'utgifter'}/mån
              </p>
              {nextExpense && daysUntilNext !== null && (
                <p className="text-xs text-muted-foreground mt-1">
                  Nästa: {nextExpense.description.substring(0, 15)}{nextExpense.description.length > 15 ? '...' : ''}
                  {daysUntilNext === 0
                    ? ' idag'
                    : daysUntilNext === 1
                      ? ' imorgon'
                      : ` om ${daysUntilNext} dagar`}
                </p>
              )}
            </div>
            <Link
              href="/expenses?tab=recurring"
              className="p-2 rounded-lg bg-hb-sage/20 hover:bg-hb-sage/30 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-hb-cognac" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function RecurringExpensesWidget() {
  return (
    <ComponentErrorBoundary componentName="Återkommande utgifter">
      <RecurringExpensesWidgetContent />
    </ComponentErrorBoundary>
  )
}
