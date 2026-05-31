'use client'

import { formatCurrency, formatPercentage } from '@/lib/utils/formatters'
import { getDaysUntilSalary } from '@/lib/utils/budget-period'
import { cn } from '@/lib/utils/cn'

interface KPICardsProps {
  totalBudget: number
  totalSpent: number
  savingsRate: number
  salaryDay: number
  hasBudget: boolean
  totalIncome: number
  actualSavings: number
}

export function KPICards({
  totalBudget,
  totalSpent,
  savingsRate,
  salaryDay,
  hasBudget,
  totalIncome,
  actualSavings,
}: KPICardsProps) {
  const remaining = totalBudget - totalSpent
  const daysUntilSalary = getDaysUntilSalary(salaryDay)
  const dailyBudget = daysUntilSalary > 0 && totalBudget > 0 ? remaining / daysUntilSalary : 0
  const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
  const actualSavingsRate = totalIncome > 0 ? (actualSavings / totalIncome) * 100 : 0
  const noBudget = totalBudget === 0

  const cards: Array<{
    label: string
    value: string
    subtext: string
    valueClass?: string
  }> = [
    {
      label: 'Kvar att spendera',
      value: noBudget ? '–' : formatCurrency(remaining),
      subtext: noBudget
        ? 'Ingen budget satt'
        : daysUntilSalary > 0
          ? `${formatCurrency(dailyBudget)}/dag`
          : 'Ny period idag',
      valueClass: noBudget
        ? 'text-muted-foreground'
        : remaining >= 0
          ? 'text-success'
          : 'text-destructive',
    },
    {
      label: 'Förbrukat',
      value: formatCurrency(totalSpent),
      subtext: noBudget ? '–' : `${formatPercentage(spentPercentage)} av budget`,
      valueClass: 'text-foreground',
    },
    {
      label: 'Dagar till lön',
      value: daysUntilSalary === 0 ? 'Idag!' : daysUntilSalary.toString(),
      subtext: daysUntilSalary === 0 ? 'Löning 🥳' : daysUntilSalary === 1 ? 'dag kvar' : 'dagar kvar',
      valueClass: 'text-hb-tim',
    },
    {
      label: 'Sparkvot',
      value: formatPercentage(actualSavingsRate),
      subtext: hasBudget ? `Budget: ${formatPercentage(savingsRate)}` : 'Faktisk',
      valueClass:
        actualSavingsRate >= 10
          ? 'text-success'
          : actualSavingsRate >= 0
            ? 'text-foreground'
            : 'text-destructive',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      {cards.map((card, index) => (
        <div key={card.label} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="label-caps text-muted-foreground">
            {card.label}
          </div>
          <div
            className={cn(
              'font-serif-kpi text-[26px] leading-tight mt-1.5',
              card.valueClass
            )}
          >
            {card.value}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">{card.subtext}</div>
        </div>
      ))}
    </div>
  )
}
