'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatPercentage, formatDate } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { Zap, TrendingUp, Receipt, PieChart as PieIcon, Shield } from 'lucide-react'
import type { ExpenseWithCategory, BudgetWithItems } from '@/types'
import type { PeriodSummary } from '@/hooks/use-report-data'

interface ReportKpiInsightsProps {
  expenses: ExpenseWithCategory[]
  budget: BudgetWithItems | null
  totalIncome: number
  totalSpent: number
  periodProgress: number
  historySummaries: PeriodSummary[]
  currentPeriod: string
}

const DONUT_COLORS = {
  Fixed: '#F3C3B2',    // hb-terracotta
  Variable: '#99CDD8', // hb-tim
}

export function ReportKpiInsights({
  expenses,
  budget,
  totalIncome,
  totalSpent,
  periodProgress,
  historySummaries,
  currentPeriod,
}: ReportKpiInsightsProps) {
  // 1. Spending velocity
  const daysElapsed = Math.max(1, Math.ceil(periodProgress / 100 * 30))
  const dailySpend = totalSpent / daysElapsed
  const budgetTotal = budget?.budget_items?.reduce((s, i) => s + i.amount, 0) || totalIncome
  const dailyBudgetPace = budgetTotal / 30
  const velocityStatus = dailySpend <= dailyBudgetPace ? 'good' : 'warning'

  // 2. Month-over-month
  const currentIndex = historySummaries.findIndex(s => s.period === currentPeriod)
  const previousSummary = currentIndex > 0 ? historySummaries[currentIndex - 1] : null
  const momChange = previousSummary && previousSummary.totalExpenses > 0
    ? ((totalSpent - previousSummary.totalExpenses) / previousSummary.totalExpenses) * 100
    : null

  // 3. Largest expense
  const largestExpense = expenses.length > 0
    ? expenses.reduce((max, exp) => exp.amount > max.amount ? exp : max, expenses[0])
    : null

  // 4. Fixed vs Variable ratio
  const fixedTotal = expenses
    .filter(e => e.category?.cost_type === 'Fixed')
    .reduce((s, e) => s + e.amount, 0)
  const variableTotal = expenses
    .filter(e => e.category?.cost_type === 'Variable' || e.category?.cost_type === 'Savings')
    .reduce((s, e) => s + e.amount, 0)
  const donutData = [
    { name: 'Fasta', value: fixedTotal, color: DONUT_COLORS.Fixed },
    { name: 'Rörliga', value: variableTotal, color: DONUT_COLORS.Variable },
  ].filter(d => d.value > 0)

  // 5. Budget adherence
  const budgetItems = budget?.budget_items?.filter(i => i.amount > 0) || []
  const spentByCategory: Record<string, number> = {}
  for (const exp of expenses) {
    const catId = exp.category_id || 'unknown'
    spentByCategory[catId] = (spentByCategory[catId] || 0) + exp.amount
  }
  const withinBudgetCount = budgetItems.filter(item => {
    const spent = spentByCategory[item.category_id || ''] || 0
    return spent <= item.amount
  }).length

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-hb-cognac px-1">Insikter</h2>

      {/* Row 1: Velocity + MoM */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className={cn('w-4 h-4', velocityStatus === 'good' ? 'text-green-600' : 'text-amber-500')} />
              <span className="text-xs text-muted-foreground">Utgiftstakt</span>
            </div>
            <p className="text-lg font-bold">{formatCurrency(dailySpend)}<span className="text-xs font-normal text-muted-foreground">/dag</span></p>
            <p className="text-xs text-muted-foreground">
              Budget: {formatCurrency(dailyBudgetPace)}/dag
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-hb-cognac" />
              <span className="text-xs text-muted-foreground">vs förra månaden</span>
            </div>
            {momChange !== null ? (
              <>
                <p className={cn(
                  'text-lg font-bold',
                  momChange > 0 ? 'text-red-500' : 'text-green-600'
                )}>
                  {momChange > 0 ? '+' : ''}{formatPercentage(momChange, 1)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {momChange > 0 ? 'Mer' : 'Mindre'} än föregående
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Ingen jämförelse</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Largest expense */}
      {largestExpense && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-hb-cognac" />
              <span className="text-xs text-muted-foreground">Största enskilda utgift</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{largestExpense.description || largestExpense.category?.name || 'Okänd'}</p>
                <p className="text-xs text-muted-foreground">
                  {largestExpense.category?.name} - {formatDate(largestExpense.date, 'medium')}
                </p>
              </div>
              <p className="text-lg font-bold text-hb-cognac">{formatCurrency(largestExpense.amount)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row 3: Fixed vs Variable donut + Budget adherence */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <PieIcon className="w-4 h-4 text-hb-cognac" />
              <span className="text-xs text-muted-foreground">Fast vs Rörligt</span>
            </div>
            {donutData.length > 0 ? (
              <>
                <div className="h-[80px] w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={35}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1">
                  {donutData.map(d => (
                    <div key={d.name} className="flex items-center gap-1 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Ingen data</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-hb-cognac" />
              <span className="text-xs text-muted-foreground">Budgetföljsamhet</span>
            </div>
            {budgetItems.length > 0 ? (
              <>
                <p className="text-2xl font-bold text-hb-cognac">
                  {withinBudgetCount}/{budgetItems.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  kategorier inom budget
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Ingen budget</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
