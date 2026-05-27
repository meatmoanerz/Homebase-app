'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/formatters'
import { Home } from 'lucide-react'
import { useHouseholdCategories } from '@/hooks/use-household-categories'
import type { ExpenseWithCategory } from '@/types'
import Link from 'next/link'

interface ReportHouseholdCostsProps {
  expenses: ExpenseWithCategory[]
  hasPartner: boolean
  userName: string
  partnerName: string
}

export function ReportHouseholdCosts({ expenses, hasPartner, userName, partnerName }: ReportHouseholdCostsProps) {
  const { data: householdCategories = [] } = useHouseholdCategories()
  const householdCategoryIds = new Set(householdCategories.map(hc => hc.category_id))

  if (householdCategoryIds.size === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4 text-hb-cognac" />
            <CardTitle className="text-base">Hushållskostnader</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            Inga hushållskategorier valda.
          </p>
          <Link href="/settings/household-categories" className="text-sm text-hb-cognac font-medium underline">
            Välj kategorier
          </Link>
        </CardContent>
      </Card>
    )
  }

  // Filter expenses to household categories
  const householdExpenses = expenses.filter(exp => householdCategoryIds.has(exp.category_id || ''))
  const total = householdExpenses.reduce((sum, exp) => sum + exp.amount, 0)

  // Per-person split based on cost_assignment
  let userTotal = 0
  let partnerTotal = 0
  for (const exp of householdExpenses) {
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

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="w-4 h-4 text-hb-cognac" />
            <CardTitle className="text-base">Hushållskostnader</CardTitle>
          </div>
          <span className="text-lg font-bold text-hb-cognac">{formatCurrency(total)}</span>
        </div>
      </CardHeader>
      {hasPartner && (
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">{userName}</p>
              <p className="font-semibold">{formatCurrency(userTotal)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">{partnerName}</p>
              <p className="font-semibold">{formatCurrency(partnerTotal)}</p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
