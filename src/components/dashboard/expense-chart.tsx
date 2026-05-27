'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ComponentErrorBoundary } from '@/components/error/component-error-boundary'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/formatters'
import type { ExpenseWithCategory } from '@/types'

interface ExpenseChartProps {
  expenses: ExpenseWithCategory[]
}

const COLORS = {
  Fixed: '#F3C3B2',    // hb-terracotta
  Variable: '#99CDD8', // hb-tim
  Savings: '#4CAF50',  // success
}

function ExpenseChartContent({ expenses }: ExpenseChartProps) {
  // Group expenses by cost type
  const dataByType = expenses.reduce((acc, expense) => {
    const type = expense.category?.cost_type || 'Variable'
    acc[type] = (acc[type] || 0) + expense.amount
    return acc
  }, {} as Record<string, number>)

  const chartData = [
    { name: 'Fasta', value: dataByType['Fixed'] || 0, color: COLORS.Fixed },
    { name: 'Rörliga', value: dataByType['Variable'] || 0, color: COLORS.Variable },
    { name: 'Sparande', value: dataByType['Savings'] || 0, color: COLORS.Savings },
  ].filter(item => item.value > 0)

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  if (chartData.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Fördelning</CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Inga utgifter att visa</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Fördelning</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[180px] min-h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2 mt-2">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground">{item.name}</span>
              </div>
              <span className="font-medium">{formatCurrency(item.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <span className="font-medium">Totalt</span>
            <span className="font-bold">{formatCurrency(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ExpenseChart({ expenses }: ExpenseChartProps) {
  return (
    <ComponentErrorBoundary componentName="Fördelning">
      <ExpenseChartContent expenses={expenses} />
    </ComponentErrorBoundary>
  )
}