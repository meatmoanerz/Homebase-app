'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ComponentErrorBoundary } from '@/components/error/component-error-boundary'
import { formatCurrency } from '@/lib/utils/formatters'
import { User, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface PersonBudgetBreakdownProps {
  userName: string
  partnerName: string
  userSpent: number
  partnerSpent: number
  userBudget: number
  partnerBudget: number
}

function PersonBudgetBreakdownContent({
  userName,
  partnerName,
  userSpent,
  partnerSpent,
  userBudget,
  partnerBudget,
}: PersonBudgetBreakdownProps) {
  const userRemaining = userBudget - userSpent
  const partnerRemaining = partnerBudget - partnerSpent

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Per person</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* User */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-hb-sage/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-hb-cognac/20 flex items-center justify-center">
              <User className="w-4 h-4 text-hb-cognac" />
            </div>
            <div>
              <p className="font-medium text-sm">{userName}</p>
              <p className="text-xs text-muted-foreground">
                Spenderat: {formatCurrency(userSpent)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn(
              "font-bold text-lg",
              userRemaining >= 0 ? "text-success" : "text-destructive"
            )}>
              {formatCurrency(userRemaining)}
            </p>
            <p className="text-xs text-muted-foreground">kvar</p>
          </div>
        </div>

        {/* Partner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-hb-tim/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-hb-tim/20 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-hb-tim" />
            </div>
            <div>
              <p className="font-medium text-sm">{partnerName}</p>
              <p className="text-xs text-muted-foreground">
                Spenderat: {formatCurrency(partnerSpent)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn(
              "font-bold text-lg",
              partnerRemaining >= 0 ? "text-success" : "text-destructive"
            )}>
              {formatCurrency(partnerRemaining)}
            </p>
            <p className="text-xs text-muted-foreground">kvar</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PersonBudgetBreakdown(props: PersonBudgetBreakdownProps) {
  return (
    <ComponentErrorBoundary componentName="Per person">
      <PersonBudgetBreakdownContent {...props} />
    </ComponentErrorBoundary>
  )
}
