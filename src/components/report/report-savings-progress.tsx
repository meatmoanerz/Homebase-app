'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters'
import { Target } from 'lucide-react'
import { useSavingsGoals } from '@/hooks/use-savings-goals'
import { differenceInMonths } from 'date-fns'
import type { ExpenseWithCategory } from '@/types'

interface ReportSavingsProgressProps {
  expenses?: ExpenseWithCategory[]
  selectedPeriod?: string
}

export function ReportSavingsProgress({ expenses = [], selectedPeriod }: ReportSavingsProgressProps) {
  const { data: goals = [] } = useSavingsGoals()
  const activeGoals = goals.filter(g => g.status === 'active')

  if (activeGoals.length === 0) {
    return null
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-hb-cognac" />
          <CardTitle className="text-base">Sparmål</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeGoals.map(goal => {
          const current = goal.is_shared
            ? goal.starting_balance_user1 + goal.starting_balance_user2
            : goal.starting_balance
          const target = goal.target_amount || 1
          const pct = Math.min((current / target) * 100, 100)

          // Calculate period savings from expenses in the goal's linked category
          const categoryId = goal.category_id
          const periodSavings = categoryId
            ? expenses
                .filter(exp => exp.category_id === categoryId)
                .reduce((sum, exp) => sum + exp.amount, 0)
            : 0

          // Calculate monthly needed to reach target
          let monthlyNeeded: number | null = null
          if (goal.target_amount && goal.target_date) {
            const remaining = goal.target_amount - current
            if (remaining > 0) {
              const monthsLeft = differenceInMonths(new Date(goal.target_date), new Date())
              if (monthsLeft > 0) {
                monthlyNeeded = remaining / monthsLeft
              }
            }
          }

          return (
            <div key={goal.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate mr-2">{goal.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatPercentage(pct)}
                </span>
              </div>
              <Progress value={pct} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatCurrency(current)}</span>
                <span>{formatCurrency(target)}</span>
              </div>
              {(periodSavings > 0 || monthlyNeeded !== null) && (
                <div className="flex justify-between text-xs pt-0.5">
                  {periodSavings > 0 && (
                    <span className="text-hb-cognac font-medium">
                      Sparat denna period: {formatCurrency(periodSavings)}
                    </span>
                  )}
                  {monthlyNeeded !== null && (
                    <span className="text-muted-foreground ml-auto">
                      Behöver: {formatCurrency(monthlyNeeded)}/mån
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
