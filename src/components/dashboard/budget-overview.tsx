'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ComponentErrorBoundary } from '@/components/error/component-error-boundary'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import type { ExpenseWithCategory } from '@/types'

interface BudgetOverviewProps {
  expenses: ExpenseWithCategory[]
  budgetItems: {
    fixed: number
    variable: number
    savings: number
  }
}

function BudgetOverviewContent({ expenses, budgetItems }: BudgetOverviewProps) {
  // Calculate spent by category type (TOTAL household expenses)
  // When partners are connected, show total expenses, not user's portion
  const spentByType = expenses.reduce((acc, expense) => {
    const type = expense.category?.cost_type || 'Variable'
    acc[type] = (acc[type] || 0) + expense.amount
    return acc
  }, {} as Record<string, number>)

  const categories = [
    {
      label: 'Fasta kostnader',
      budget: budgetItems.fixed,
      spent: spentByType['Fixed'] || 0,
      color: 'bg-hb-terracotta',
    },
    {
      label: 'Rörliga kostnader',
      budget: budgetItems.variable,
      spent: spentByType['Variable'] || 0,
      color: 'bg-hb-tim',
    },
    {
      label: 'Sparande',
      budget: budgetItems.savings,
      spent: spentByType['Savings'] || 0,
      color: 'bg-success',
    },
  ]

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Budgetöversikt</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.map((cat) => {
          const percentage = cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0
          const isOverBudget = percentage > 100

          return (
            <div key={cat.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{cat.label}</span>
                <span className={cn(
                  "font-medium",
                  isOverBudget ? "text-destructive" : "text-foreground"
                )}>
                  {formatCurrency(cat.spent)} / {formatCurrency(cat.budget)}
                </span>
              </div>
              <Progress
                value={Math.min(percentage, 100)}
                className="h-2"
                indicatorClassName={cn(
                  cat.color,
                  isOverBudget && "bg-destructive"
                )}
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export function BudgetOverview({ expenses, budgetItems }: BudgetOverviewProps) {
  return (
    <ComponentErrorBoundary componentName="Budgetöversikt">
      <BudgetOverviewContent expenses={expenses} budgetItems={budgetItems} />
    </ComponentErrorBoundary>
  )
}
