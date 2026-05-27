'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useHouseholdMonthlyIncomes, useMonthlyIncomeTotal } from '@/hooks/use-monthly-incomes'
import { formatCurrency } from '@/lib/utils/formatters'
import { motion } from 'framer-motion'
import { Banknote, ChevronRight, Plus } from 'lucide-react'

interface IncomeOverviewCardProps {
  period: string
}

export function IncomeOverviewCard({ period }: IncomeOverviewCardProps) {
  const { data: incomes, isLoading: incomesLoading } = useHouseholdMonthlyIncomes(period)
  const { data: totals, isLoading: totalsLoading } = useMonthlyIncomeTotal(period)

  const isLoading = incomesLoading || totalsLoading
  const hasIncomes = incomes && incomes.length > 0

  if (isLoading) {
    return <IncomeOverviewCardSkeleton />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-hb-sage/30 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-hb-cognac" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Månadens inkomst</p>
                <p className="text-xl font-bold text-hb-cognac">
                  {formatCurrency(totals?.total_income || 0)}
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/budget/income?period=${period}`}>
                {hasIncomes ? (
                  <>
                    Hantera
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1" />
                    Lägg till
                  </>
                )}
              </Link>
            </Button>
          </div>

          {hasIncomes ? (
            <div className="space-y-2">
              {incomes.slice(0, 3).map((income) => (
                <div
                  key={income.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {income.name}
                    {!income.is_own && (
                      <span className="ml-1 text-xs text-hb-terracotta">
                        ({income.owner_name})
                      </span>
                    )}
                  </span>
                  <span className="font-medium">{formatCurrency(income.amount)}</span>
                </div>
              ))}
              {incomes.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{incomes.length - 3} fler...
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-3">
              <p className="text-sm text-muted-foreground">
                Ingen inkomst registrerad för denna period
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function IncomeOverviewCardSkeleton() {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>
    </Card>
  )
}
