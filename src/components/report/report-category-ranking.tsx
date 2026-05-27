'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters'
import type { ExpenseWithCategory } from '@/types'

interface ReportCategoryRankingProps {
  expenses: ExpenseWithCategory[]
}

export function ReportCategoryRanking({ expenses }: ReportCategoryRankingProps) {
  // Group by category and sum
  const categoryTotals: Record<string, { name: string; total: number }> = {}
  for (const exp of expenses) {
    const catName = exp.category?.name || 'Okategoriserad'
    const catId = exp.category_id || 'unknown'
    if (!categoryTotals[catId]) {
      categoryTotals[catId] = { name: catName, total: 0 }
    }
    categoryTotals[catId].total += exp.amount
  }

  const ranked = Object.values(categoryTotals)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const maxAmount = ranked[0]?.total || 1
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0)

  if (ranked.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Topp kategorier</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Inga utgifter att visa</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Topp kategorier</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ranked.map((cat, i) => {
          const percentage = totalSpent > 0 ? (cat.total / totalSpent) * 100 : 0
          const barWidth = (cat.total / maxAmount) * 100

          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate mr-2">{cat.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground text-xs">
                    {formatPercentage(percentage)}
                  </span>
                  <span className="font-semibold">{formatCurrency(cat.total)}</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-hb-tim rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
