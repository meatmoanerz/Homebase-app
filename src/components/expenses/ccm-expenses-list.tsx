'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCCMExpenses, groupExpensesByInvoicePeriod } from '@/hooks/use-expenses'
import { useUser } from '@/hooks/use-user'
import { useDeleteExpense } from '@/hooks/use-expenses'
import { ExpenseEditDialog } from '@/components/expenses/expense-edit-dialog'
import { formatCurrency, formatRelativeDate } from '@/lib/utils/formatters'
import { motion } from 'framer-motion'
import { CreditCard, Trash2, Users, UserCheck, ChevronRight, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import Link from 'next/link'
import type { ExpenseWithCategory } from '@/types'

const categoryIcons: Record<string, string> = {
  Mat: '🛒',
  Hem: '🏠',
  Kläder: '👕',
  Nöje: '🎬',
  Restaurang: '🍽️',
  Transport: '🚗',
  Kollektivtrafik: '🚌',
  Resor: '✈️',
  El: '⚡',
  Prenumerationer: '📱',
}

function formatInvoicePeriod(period: string): string {
  const [year, month] = period.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return format(date, 'MMMM yyyy', { locale: sv })
}

function getInvoiceStatus(period: string): 'current' | 'upcoming' | 'past' {
  const now = new Date()
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  if (period === currentPeriod) return 'current'
  if (period > currentPeriod) return 'upcoming'
  return 'past'
}

export function CCMExpensesList() {
  const { data: user } = useUser()
  const invoiceBreakDate = user?.ccm_invoice_break_date || 1
  const { data: ccmExpenses = [], isLoading } = useCCMExpenses(invoiceBreakDate)
  const deleteExpense = useDeleteExpense()
  const [editExpense, setEditExpense] = useState<ExpenseWithCategory | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const handleEditExpense = (expense: ExpenseWithCategory) => {
    setEditExpense(expense)
    setEditDialogOpen(true)
  }

  const groupedExpenses = useMemo(() => {
    return groupExpensesByInvoicePeriod(ccmExpenses, invoiceBreakDate)
  }, [ccmExpenses, invoiceBreakDate])

  const handleDelete = async (id: string, description: string) => {
    try {
      await deleteExpense.mutateAsync(id)
      toast.success(`"${description}" borttagen`)
    } catch {
      toast.error('Kunde inte ta bort')
    }
  }

  if (!user?.ccm_enabled) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center">
          <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">CCM är inte aktiverat</p>
          <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
            Aktivera kreditkortshanteraren för att spåra kreditkortsutgifter
          </p>
          <Link href="/settings/ccm">
            <Button variant="outline" size="sm">
              <CreditCard className="w-4 h-4 mr-2" />
              Aktivera CCM
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (ccmExpenses.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center">
          <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Inga kreditkortsutgifter</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Markera utgifter med "Betald med kreditkort" när du registrerar dem
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalCCM = ccmExpenses.reduce((sum, exp) => sum + exp.amount, 0)

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-0 shadow-sm bg-secondary/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Totalt på kreditkort</p>
                <p className="text-2xl font-bold text-hb-terracotta">{formatCurrency(totalCCM)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {ccmExpenses.length} {ccmExpenses.length === 1 ? 'utgift' : 'utgifter'}
                </p>
              </div>
              <div className="p-3 rounded-full bg-hb-terracotta/20">
                <CreditCard className="w-6 h-6 text-hb-terracotta" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Invoice Break Date Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>Brytdatum: den {invoiceBreakDate}:e varje månad</span>
          <Link href="/settings/ccm" className="text-hb-terracotta hover:underline ml-auto">
            Ändra
          </Link>
        </div>
      </motion.div>

      {/* Grouped by Invoice Period */}
      {Array.from(groupedExpenses.entries()).map(([period, expenses], groupIndex) => {
        const periodTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0)
        const status = getInvoiceStatus(period)

        return (
          <motion.div
            key={period}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + groupIndex * 0.05 }}
          >
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold capitalize">
                      {formatInvoicePeriod(period)}
                    </CardTitle>
                    {status === 'current' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-hb-terracotta/20 text-hb-terracotta font-medium">
                        Pågående
                      </span>
                    )}
                    {status === 'upcoming' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-hb-tim/20 text-hb-tim font-medium">
                        Kommande
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-hb-terracotta">
                    {formatCurrency(periodTotal)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {expenses.map((expense, index) => (
                  <button
                    key={expense.id}
                    type="button"
                    onClick={() => handleEditExpense(expense)}
                    className={cn(
                      "flex items-center justify-between p-4 hover:bg-muted/30 active:bg-muted/50 active:scale-[0.99] transition-all w-full text-left cursor-pointer",
                      index !== expenses.length - 1 && "border-b border-border"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-hb-terracotta/10 flex items-center justify-center text-lg">
                        {categoryIcons[expense.category?.name || ''] || '💳'}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{expense.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {expense.category?.name} • {formatRelativeDate(expense.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {expense.cost_assignment === 'shared' && (
                        <div className="w-5 h-5 rounded-full bg-hb-tim/20 flex items-center justify-center" title="Delad utgift">
                          <Users className="w-3 h-3 text-hb-tim" />
                        </div>
                      )}
                      {expense.cost_assignment === 'partner' && (
                        <div className="w-5 h-5 rounded-full bg-hb-terracotta/20 flex items-center justify-center" title="Partnerns utgift">
                          <UserCheck className="w-3 h-3 text-hb-terracotta" />
                        </div>
                      )}
                      <span className="font-semibold text-hb-terracotta">
                        -{formatCurrency(expense.amount)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(expense.id, expense.description)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )
      })}

      <ExpenseEditDialog
        expense={editExpense}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  )
}
