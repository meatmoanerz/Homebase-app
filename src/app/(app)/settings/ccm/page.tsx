'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, usePartner } from '@/hooks/use-user'
import { useCCMExpenses, groupExpensesByInvoicePeriod } from '@/hooks/use-expenses'
import { useCCMInvoices, useUpsertCCMInvoice, useSetCCMPeriodPaid, type CCMInvoice } from '@/hooks/use-ccm-invoices'
import { useDeleteExpense } from '@/hooks/use-expenses'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingPage } from '@/components/shared/loading-spinner'
import { motion, AnimatePresence } from 'framer-motion'
import { ExpenseEditDialog } from '@/components/expenses/expense-edit-dialog'
import { ArrowLeft, CreditCard, Settings, AlertTriangle, Users, UserCheck, Trash2, ChevronDown, ChevronUp, Calendar, Check, CheckCircle2, Undo2, Receipt, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatRelativeDate } from '@/lib/utils/formatters'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'
import type { ExpenseWithCategory } from '@/types'
import { GroupPurchaseWizard } from '@/components/ccm/group-purchase-wizard'
import { calculatePaymentSplit } from '@/lib/utils/ccm-split'

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

interface InvoicePeriodCardProps {
  period: string
  expenses: ExpenseWithCategory[]
  invoice: CCMInvoice | undefined
  user: { id: string; first_name: string | null }
  partner: { id: string; first_name: string | null } | null
  onDelete: (id: string, description: string) => void
  onEdit: (expense: ExpenseWithCategory) => void
  onUpdateInvoice: (period: string, amount: number) => void
  onTogglePaid: (period: string, paid: boolean, actualAmount: number) => void
}

function InvoicePeriodCard({ period, expenses, invoice, user, partner, onDelete, onEdit, onUpdateInvoice, onTogglePaid }: InvoicePeriodCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editingAmount, setEditingAmount] = useState(false)
  const [invoiceInput, setInvoiceInput] = useState(invoice?.actual_amount?.toString() || '')

  const periodTotal = expenses.reduce((sum, exp) => {
    if (exp.is_group_purchase) return sum + (exp.group_purchase_total || exp.amount)
    return sum + exp.amount
  }, 0)
  const status = getInvoiceStatus(period)
  const actualAmount = invoice?.actual_amount || 0

  const paymentSplit = useMemo(() => {
    return calculatePaymentSplit(expenses, actualAmount, user.id, partner?.id || null)
  }, [expenses, actualAmount, user.id, partner?.id])

  const handleSaveInvoice = () => {
    const amount = parseFloat(invoiceInput) || 0
    onUpdateInvoice(period, amount)
    setEditingAmount(false)
  }

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader
        className="py-3 px-4 bg-muted/30 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
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
            {invoice?.paid_at && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/20 text-success font-medium inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Betald
              </span>
            )}
            {paymentSplit.hasWarning && (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-hb-terracotta">
              {formatCurrency(periodTotal)}
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="p-0">
              {/* Invoice Amount Input */}
              <div className="p-4 bg-hb-sand-deep/10 border-b">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-hb-terracotta" />
                    <span className="text-sm font-medium">Faktiskt fakturabelopp</span>
                  </div>
                  {!editingAmount && actualAmount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingAmount(true)
                        setInvoiceInput(actualAmount.toString())
                      }}
                    >
                      Ändra
                    </Button>
                  )}
                </div>

                {editingAmount || actualAmount === 0 ? (
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={invoiceInput}
                        onChange={(e) => setInvoiceInput(e.target.value)}
                        placeholder="Ange belopp från fakturan"
                        className="w-full h-10 px-3 rounded-lg bg-white dark:bg-input text-sm border border-border"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kr</span>
                    </div>
                    <Button
                      size="sm"
                      className="h-10"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSaveInvoice()
                      }}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-lg font-bold text-hb-terracotta">{formatCurrency(actualAmount)}</p>
                )}

                {/* Warning if registered > actual */}
                {paymentSplit.hasWarning && (
                  <div className="mt-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800 dark:text-amber-200">
                      <p className="font-medium">Registrerat mer än fakturan</p>
                      <p>Du har registrerat {formatCurrency(paymentSplit.registeredTotal)} men fakturan är {formatCurrency(actualAmount)}. Kontrollera om något är dubbelregistrerat eller har fel datum.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Split */}
              {partner && actualAmount > 0 && (
                <div className="p-4 bg-hb-tim/5 border-b">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Betalningsfördelning</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-white dark:bg-card shadow-sm">
                      <p className="text-xs text-muted-foreground">{user.first_name || 'Du'}</p>
                      <p className="text-lg font-bold text-hb-cognac">{formatCurrency(paymentSplit.userAmount)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-card shadow-sm">
                      <p className="text-xs text-muted-foreground">{partner.first_name || 'Partner'}</p>
                      <p className="text-lg font-bold text-hb-cognac">{formatCurrency(paymentSplit.partnerAmount)}</p>
                    </div>
                  </div>
                  {paymentSplit.unregisteredDifference > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      * Inkluderar {formatCurrency(paymentSplit.unregisteredDifference / 2)} var för oregistrerade utgifter
                    </p>
                  )}
                </div>
              )}

              {/* Expense List */}
              {expenses.length === 0 ? (
                <div className="p-8 text-center">
                  <CreditCard className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Inga utgifter denna period</p>
                </div>
              ) : (
                expenses.map((expense, index) => (
                  <div
                    key={expense.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onEdit(expense)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(expense) } }}
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
                      {expense.is_group_purchase && (
                        <div className="w-5 h-5 rounded-full bg-hb-sand/30 flex items-center justify-center" title="Gruppköp">
                          <Users className="w-3 h-3 text-hb-cognac" />
                        </div>
                      )}
                      {expense.cost_assignment === 'shared' && !expense.is_group_purchase && (
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
                        -{formatCurrency(expense.is_group_purchase ? (expense.group_purchase_total || expense.amount) : expense.amount)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(expense.id, expense.description)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}

              {/* Paid toggle */}
              <div className="p-3 border-t border-border bg-muted/20">
                {invoice?.paid_at ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      onTogglePaid(period, false, invoice?.actual_amount || 0)
                    }}
                  >
                    <Undo2 className="w-4 h-4 mr-2" />
                    Markera som obetald
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-success border-success/30 hover:bg-success/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      onTogglePaid(period, true, invoice?.actual_amount || 0)
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Markera som betald
                  </Button>
                )}
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

export default function CCMDashboardPage() {
  const router = useRouter()
  const { data: user, isLoading: userLoading } = useUser()
  const { data: partner } = usePartner()
  const invoiceBreakDate = user?.ccm_invoice_break_date || 1
  const { data: ccmExpenses = [], isLoading: expensesLoading } = useCCMExpenses(invoiceBreakDate)
  const { data: invoices = [] } = useCCMInvoices()
  const deleteExpense = useDeleteExpense()
  const upsertInvoice = useUpsertCCMInvoice()
  const setPeriodPaid = useSetCCMPeriodPaid()
  const [groupPurchaseOpen, setGroupPurchaseOpen] = useState(false)
  const [showPaidPeriods, setShowPaidPeriods] = useState(false)
  const [editExpense, setEditExpense] = useState<ExpenseWithCategory | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editGroupPurchase, setEditGroupPurchase] = useState<ExpenseWithCategory | null>(null)
  const [editGroupPurchaseOpen, setEditGroupPurchaseOpen] = useState(false)

  const handleEditExpense = (expense: ExpenseWithCategory) => {
    if (expense.is_group_purchase) {
      setEditGroupPurchase(expense)
      setEditGroupPurchaseOpen(true)
    } else {
      setEditExpense(expense)
      setEditDialogOpen(true)
    }
  }

  const groupedExpenses = useMemo(() => {
    return groupExpensesByInvoicePeriod(ccmExpenses, invoiceBreakDate)
  }, [ccmExpenses, invoiceBreakDate])

  const invoiceMap = useMemo(() => {
    const map = new Map<string, CCMInvoice>()
    invoices.forEach((inv) => map.set(inv.period, inv))
    return map
  }, [invoices])

  const handleDelete = async (id: string, description: string) => {
    try {
      await deleteExpense.mutateAsync(id)
      toast.success(`"${description}" borttagen`)
    } catch {
      toast.error('Kunde inte ta bort')
    }
  }

  const handleUpdateInvoice = async (period: string, amount: number) => {
    try {
      await upsertInvoice.mutateAsync({ period, actual_amount: amount })
      toast.success('Fakturabelopp sparat')
    } catch {
      toast.error('Kunde inte spara fakturabelopp')
    }
  }

  const handleTogglePaid = async (period: string, paid: boolean, actualAmount: number) => {
    try {
      await setPeriodPaid.mutateAsync({ period, paid, actualAmount })
      toast.success(paid ? 'Period markerad som betald' : 'Period markerad som obetald')
    } catch {
      toast.error('Kunde inte uppdatera perioden')
    }
  }

  if (userLoading || expensesLoading) {
    return <LoadingPage />
  }

  if (!user?.ccm_enabled) {
    return (
      <div className="p-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-hb-cognac">Kreditkortshanterare</h1>
            <p className="text-sm text-muted-foreground">CCM</p>
          </div>
        </motion.div>

        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">CCM är inte aktiverat</p>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
              Aktivera kreditkortshanteraren för att spåra kreditkortsutgifter
            </p>
            <Link href="/settings/ccm/settings">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Aktivera CCM
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalCCM = ccmExpenses.reduce((sum, exp) => {
    if (exp.is_group_purchase) return sum + (exp.group_purchase_total || exp.amount)
    return sum + exp.amount
  }, 0)

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-hb-cognac">Kreditkortshanterare</h1>
            <p className="text-sm text-muted-foreground">CCM-översikt</p>
          </div>
        </div>
        <Link href="/settings/ccm/settings">
          <Button variant="ghost" size="icon">
            <Settings className="w-5 h-5" />
          </Button>
        </Link>
      </motion.div>

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
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
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>Brytdatum: den {invoiceBreakDate}:e varje månad</span>
          <Link href="/settings/ccm/settings" className="text-hb-terracotta hover:underline ml-auto">
            Ändra
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <Button
          variant="outline"
          onClick={() => setGroupPurchaseOpen(true)}
          className="w-full text-hb-cognac border-hb-cognac/30 hover:bg-hb-cognac/10"
        >
          <Plus className="w-4 h-4 mr-2" />
          Gruppköp
        </Button>
      </motion.div>

      {/* Invoice Periods */}
      {ccmExpenses.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Inga kreditkortsutgifter</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Markera utgifter med "Betald med kreditkort" när du registrerar dem
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Unpaid periods */}
          <div className="space-y-3">
            {Array.from(groupedExpenses.entries())
              .filter(([period]) => !invoiceMap.get(period)?.paid_at)
              .map(([period, expenses], index) => (
                <motion.div
                  key={period}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + index * 0.05 }}
                >
                  <InvoicePeriodCard
                    period={period}
                    expenses={expenses}
                    invoice={invoiceMap.get(period)}
                    user={{ id: user.id, first_name: user.first_name }}
                    partner={partner ? { id: partner.id, first_name: partner.first_name } : null}
                    onDelete={handleDelete}
                    onEdit={handleEditExpense}
                    onUpdateInvoice={handleUpdateInvoice}
                    onTogglePaid={handleTogglePaid}
                  />
                </motion.div>
              ))}
          </div>

          {/* Paid periods — collapsed archive so the list stays short */}
          {(() => {
            const paidPeriods = Array.from(groupedExpenses.entries())
              .filter(([period]) => !!invoiceMap.get(period)?.paid_at)
            if (paidPeriods.length === 0) return null
            return (
              <div className="space-y-3">
                <button
                  onClick={() => setShowPaidPeriods(v => !v)}
                  className="w-full flex items-center justify-between px-1 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    Betalda perioder ({paidPeriods.length})
                  </span>
                  <ChevronDown className={cn('w-4 h-4 transition-transform', showPaidPeriods && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {showPaidPeriods && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      {paidPeriods.map(([period, expenses]) => (
                        <InvoicePeriodCard
                          key={period}
                          period={period}
                          expenses={expenses}
                          invoice={invoiceMap.get(period)}
                          user={{ id: user.id, first_name: user.first_name }}
                          partner={partner ? { id: partner.id, first_name: partner.first_name } : null}
                          onDelete={handleDelete}
                          onEdit={handleEditExpense}
                          onUpdateInvoice={handleUpdateInvoice}
                          onTogglePaid={handleTogglePaid}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })()}
        </>
      )}

      <GroupPurchaseWizard
        open={groupPurchaseOpen}
        onOpenChange={setGroupPurchaseOpen}
      />

      <GroupPurchaseWizard
        open={editGroupPurchaseOpen}
        onOpenChange={(open) => {
          setEditGroupPurchaseOpen(open)
          if (!open) setEditGroupPurchase(null)
        }}
        editExpense={editGroupPurchase}
      />

      <ExpenseEditDialog
        expense={editExpense}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  )
}
