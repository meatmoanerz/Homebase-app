'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDeleteLoan, calculateLoanSummary } from '@/hooks/use-loans'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Edit2, Trash2, TrendingDown, Percent, Calendar, ChevronRight, Users } from 'lucide-react'
import type { LoanWithGroup } from '@/types'
import { LoanForm } from './loan-form'
import { AmortizationPlanDialog } from './amortization-plan'

interface LoanCardProps {
  loan: LoanWithGroup & {
    is_partner_loan?: boolean
    owner_name?: string
  }
  index?: number
}

export function LoanCard({ loan, index = 0 }: LoanCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [amortizationOpen, setAmortizationOpen] = useState(false)
  const deleteLoan = useDeleteLoan()

  const summary = calculateLoanSummary(loan)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const handleDelete = async () => {
    try {
      await deleteLoan.mutateAsync(loan.id)
      toast.success('Lån borttaget')
      setDeleteOpen(false)
    } catch {
      toast.error('Kunde inte ta bort lån')
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        <Card className="border-0 shadow-sm overflow-hidden">
          {/* Color bar from group */}
          {loan.loan_group && (
            <div
              className="h-1"
              style={{ backgroundColor: loan.loan_group.color }}
            />
          )}

          <CardContent className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {loan.loan_group && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${loan.loan_group.color}20`,
                        color: loan.loan_group.color,
                      }}
                    >
                      {loan.loan_group.name}
                    </span>
                  )}
                  {/* Shared indicator */}
                  {(loan.is_shared || loan.is_partner_loan) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-hb-tim/20 text-hb-tim flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {loan.is_partner_loan ? loan.owner_name : 'Delat'}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-hb-cognac truncate">{loan.name}</h3>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditOpen(true)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Balance & Progress */}
            <div className="mb-4">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl font-bold tabular-nums">
                  {formatCurrency(loan.current_balance)}
                </span>
                <span className="text-sm text-muted-foreground">
                  av {formatCurrency(loan.original_amount)}
                </span>
              </div>
              <Progress value={100 - summary.progressPercent} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {summary.progressPercent.toFixed(1)}% avbetalt ({formatCurrency(summary.paidOff)})
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <Percent className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm font-medium">{loan.interest_rate}%</p>
                <p className="text-xs text-muted-foreground">Ränta</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <TrendingDown className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm font-medium">{formatCurrency(loan.monthly_amortization)}</p>
                <p className="text-xs text-muted-foreground">Amortering</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <Calendar className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm font-medium">{summary.yearsRemaining} år</p>
                <p className="text-xs text-muted-foreground">Kvar</p>
              </div>
            </div>

            {/* Monthly Cost Summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-hb-sage/10 mb-3">
              <div>
                <p className="text-sm font-medium">Månadskostnad</p>
                <p className="text-xs text-muted-foreground">Amortering + ränta</p>
              </div>
              <p className="text-lg font-bold text-hb-cognac">
                {formatCurrency(summary.totalMonthlyCost)}
              </p>
            </div>

            {/* View Amortization Plan Button */}
            <Button
              variant="ghost"
              className="w-full justify-between text-hb-cognac hover:text-hb-cognac"
              onClick={() => setAmortizationOpen(true)}
            >
              <span>Visa amorteringsplan</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Redigera lån</DialogTitle>
            <DialogDescription>
              Uppdatera information om ditt lån
            </DialogDescription>
          </DialogHeader>
          <LoanForm loan={loan} onSuccess={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort lån?</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort &quot;{loan.name}&quot;? Detta går inte att ångra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Amortization Plan Dialog */}
      <AmortizationPlanDialog
        loan={loan}
        open={amortizationOpen}
        onOpenChange={setAmortizationOpen}
      />
    </>
  )
}
