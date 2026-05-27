'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { calculateAmortizationPlan, calculateLoanSummary } from '@/hooks/use-loans'
import { format, addMonths } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ChevronDown, ChevronUp, Calendar, Coins, Info } from 'lucide-react'
import type { LoanWithGroup } from '@/types'

interface AmortizationPlanDialogProps {
  loan: LoanWithGroup
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AmortizationPlanDialog({ loan, open, onOpenChange }: AmortizationPlanDialogProps) {
  const [showAll, setShowAll] = useState(false)
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('yearly')

  const plan = useMemo(() => calculateAmortizationPlan(loan, 600), [loan])
  const summary = calculateLoanSummary(loan)

  // Group by year for yearly view
  const yearlyPlan = useMemo(() => {
    const years: {
      year: number
      payments: number
      totalPayment: number
      totalPrincipal: number
      totalInterest: number
      endBalance: number
    }[] = []

    const startDate = new Date()
    let currentYear = startDate.getFullYear()
    let yearData = {
      year: currentYear,
      payments: 0,
      totalPayment: 0,
      totalPrincipal: 0,
      totalInterest: 0,
      endBalance: loan.current_balance,
    }

    plan.forEach((month, index) => {
      const monthDate = addMonths(startDate, index)
      const monthYear = monthDate.getFullYear()

      if (monthYear !== currentYear) {
        years.push(yearData)
        currentYear = monthYear
        yearData = {
          year: currentYear,
          payments: 0,
          totalPayment: 0,
          totalPrincipal: 0,
          totalInterest: 0,
          endBalance: month.balance,
        }
      }

      yearData.payments++
      yearData.totalPayment += month.payment
      yearData.totalPrincipal += month.principal
      yearData.totalInterest += month.interest
      yearData.endBalance = month.balance
    })

    // Push last year
    if (yearData.payments > 0) {
      years.push(yearData)
    }

    return years
  }, [plan, loan.current_balance])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const displayPlan = showAll ? plan : plan.slice(0, 12)
  const displayYearlyPlan = showAll ? yearlyPlan : yearlyPlan.slice(0, 5)

  const startDate = new Date()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Amorteringsplan</DialogTitle>
          <DialogDescription>
            {loan.name} - {formatCurrency(loan.current_balance)} kvar
          </DialogDescription>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="border-0 shadow-sm bg-hb-sage/10">
            <CardContent className="p-3 text-center">
              <Calendar className="w-5 h-5 mx-auto mb-1 text-hb-cognac" />
              <p className="text-lg font-bold">{summary.yearsRemaining} år</p>
              <p className="text-xs text-muted-foreground">
                ({summary.monthsRemaining} månader)
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-hb-sand-deep/10">
            <CardContent className="p-3 text-center">
              <Coins className="w-5 h-5 mx-auto mb-1 text-hb-terracotta" />
              <p className="text-lg font-bold">{formatCurrency(summary.totalInterest)}</p>
              <p className="text-xs text-muted-foreground">Total räntekostnad</p>
            </CardContent>
          </Card>
        </div>

        {/* Info box */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm mb-4">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            Beräknat med {loan.interest_rate}% ränta och {formatCurrency(loan.monthly_amortization)} i månadsamortering.
            Faktisk avbetalning kan variera beroende på ränteändringar.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={viewMode === 'yearly' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('yearly')}
            className="flex-1"
          >
            Per år
          </Button>
          <Button
            variant={viewMode === 'monthly' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('monthly')}
            className="flex-1"
          >
            Per månad
          </Button>
        </div>

        {/* Amortization Table */}
        {viewMode === 'yearly' ? (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>År</span>
              <span className="text-right">Amortering</span>
              <span className="text-right">Ränta</span>
              <span className="text-right">Skuld kvar</span>
            </div>

            {/* Rows */}
            {displayYearlyPlan.map((year) => (
              <div
                key={year.year}
                className="grid grid-cols-4 gap-2 px-3 py-3 rounded-lg bg-muted/30 text-sm"
              >
                <span className="font-medium">{year.year}</span>
                <span className="text-right text-hb-cognac">
                  {formatCurrency(year.totalPrincipal)}
                </span>
                <span className="text-right text-muted-foreground">
                  {formatCurrency(year.totalInterest)}
                </span>
                <span className="text-right font-medium">
                  {formatCurrency(year.endBalance)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Månad</span>
              <span className="text-right">Amortering</span>
              <span className="text-right">Ränta</span>
              <span className="text-right">Skuld kvar</span>
            </div>

            {/* Rows */}
            {displayPlan.map((month) => {
              const monthDate = addMonths(startDate, month.month - 1)
              return (
                <div
                  key={month.month}
                  className="grid grid-cols-4 gap-2 px-3 py-3 rounded-lg bg-muted/30 text-sm"
                >
                  <span className="font-medium">
                    {format(monthDate, 'MMM yyyy', { locale: sv })}
                  </span>
                  <span className="text-right text-hb-cognac">
                    {formatCurrency(month.principal)}
                  </span>
                  <span className="text-right text-muted-foreground">
                    {formatCurrency(month.interest)}
                  </span>
                  <span className="text-right font-medium">
                    {formatCurrency(month.balance)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Show More/Less Button */}
        {((viewMode === 'yearly' && yearlyPlan.length > 5) ||
          (viewMode === 'monthly' && plan.length > 12)) && (
          <Button
            variant="ghost"
            className="w-full mt-2"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                Visa mindre
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                Visa hela planen ({viewMode === 'yearly' ? yearlyPlan.length : plan.length} {viewMode === 'yearly' ? 'år' : 'månader'})
              </>
            )}
          </Button>
        )}

        {/* Total Summary */}
        <div className="mt-4 pt-4 border-t space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Totalt amorterat</span>
            <span className="font-medium">{formatCurrency(loan.current_balance)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total räntekostnad</span>
            <span className="font-medium text-hb-terracotta">{formatCurrency(summary.totalInterest)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span>Totalt att betala</span>
            <span>{formatCurrency(loan.current_balance + summary.totalInterest)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
