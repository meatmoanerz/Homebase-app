'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters'
import { Users } from 'lucide-react'
import type { ExpenseWithCategory } from '@/types'

interface ReportPartnerSpendingProps {
  expenses: ExpenseWithCategory[]
  userName: string
  partnerName: string
  userIncome: number
  partnerIncome: number
}

export function ReportPartnerSpending({
  expenses,
  userName,
  partnerName,
  userIncome,
  partnerIncome,
}: ReportPartnerSpendingProps) {
  // Calculate per-person totals based on cost_assignment
  let userTotal = 0
  let partnerTotal = 0

  for (const exp of expenses) {
    const assignment = exp.cost_assignment || 'personal'
    if (assignment === 'shared') {
      userTotal += exp.amount / 2
      partnerTotal += exp.amount / 2
    } else if (assignment === 'partner') {
      partnerTotal += exp.amount
    } else {
      userTotal += exp.amount
    }
  }

  const userPct = userIncome > 0 ? (userTotal / userIncome) * 100 : 0
  const partnerPct = partnerIncome > 0 ? (partnerTotal / partnerIncome) * 100 : 0

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-hb-cognac" />
          <CardTitle className="text-base">Utgifter per person</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-xl p-3 text-center space-y-1">
            <p className="text-xs text-muted-foreground">{userName}</p>
            <p className="text-lg font-bold text-hb-cognac">{formatCurrency(userTotal)}</p>
            {userIncome > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatPercentage(userPct)} av inkomst
              </p>
            )}
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center space-y-1">
            <p className="text-xs text-muted-foreground">{partnerName}</p>
            <p className="text-lg font-bold text-hb-cognac">{formatCurrency(partnerTotal)}</p>
            {partnerIncome > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatPercentage(partnerPct)} av inkomst
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
