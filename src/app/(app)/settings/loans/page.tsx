'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Landmark, Plus, TrendingDown, Percent, Wallet, ChevronDown, Receipt, Loader2 } from 'lucide-react'
import { useAllLoans, useCreateExpensesFromLoans } from '@/hooks/use-loans'
import { useLoanGroups } from '@/hooks/use-loan-groups'
import { useUser } from '@/hooks/use-user'
import { LoanForm, LoanCard } from '@/components/loans'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils/cn'
import { getCurrentBudgetPeriod, formatPeriodDisplay } from '@/lib/utils/budget-period'
import { format } from 'date-fns'
import { toast } from 'sonner'

export default function LoansSettingsPage() {
  const router = useRouter()
  const { data: user } = useUser()

  // Calculate current budget period based on user's salary day
  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay)

  // Initialize expense date to first day of current budget period
  const [addOpen, setAddOpen] = useState(false)
  const [createExpensesOpen, setCreateExpensesOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expenseDate, setExpenseDate] = useState(() => format(currentPeriod.startDate, 'yyyy-MM-dd'))

  const { data: loans, isLoading, ownLoans } = useAllLoans()
  const { data: loanGroups } = useLoanGroups()
  const createExpensesFromLoans = useCreateExpensesFromLoans()

  const handleCreateExpenses = async (mode: 'calculate' | 'register') => {
    if (!ownLoans || ownLoans.length === 0) return

    try {
      const result = await createExpensesFromLoans.mutateAsync({
        loans: ownLoans,
        period: currentPeriod.period,
        date: expenseDate,
        mode,
      })

      setCreateExpensesOpen(false)

      if (mode === 'calculate') {
        toast.success(result.message || 'Belopp omberäknade')
      } else if (result.created === 0) {
        toast.info(result.message || 'Inga nya utgifter skapades')
      } else {
        toast.success(`${result.created} utgifter skapade!${result.loansUpdated && result.loansUpdated > 0 ? ` ${result.loansUpdated} lån uppdaterade.` : ''}`)
      }
    } catch (error) {
      console.error('Failed to create expenses from loans:', error)
      const errorMessage = error instanceof Error ? error.message : 'Kunde inte skapa utgifter från lån'
      toast.error(errorMessage)
    }
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  // Calculate totals
  const totalDebt = loans?.reduce((sum, loan) => sum + loan.current_balance, 0) ?? 0
  const totalMonthlyAmortization = loans?.reduce((sum, loan) => sum + loan.monthly_amortization, 0) ?? 0

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Calculate weighted average interest rate
  const avgInterestRate = loans && loans.length > 0
    ? loans.reduce((sum, loan) => sum + (loan.current_balance * loan.interest_rate), 0) /
      loans.reduce((sum, loan) => sum + loan.current_balance, 0)
    : 0

  // Calculate total monthly interest
  const totalMonthlyInterest = loans?.reduce((sum, loan) => {
    return sum + (loan.current_balance * (loan.interest_rate / 100 / 12))
  }, 0) ?? 0

  const totalMonthlyCost = totalMonthlyAmortization + totalMonthlyInterest

  // Group loans by loan_group name (to merge groups with same name from user and partner)
  const groupedLoans = loans?.reduce((acc, loan) => {
    const groupId = loan.group_id || 'ungrouped'
    if (!acc[groupId]) {
      acc[groupId] = []
    }
    acc[groupId].push(loan)
    return acc
  }, {} as Record<string, typeof loans>)

  // Deduplicate loan groups by name - merge groups with same name
  const uniqueGroups = loanGroups?.reduce((acc, group) => {
    const existingGroup = acc.find(g => g.name.toLowerCase() === group.name.toLowerCase())
    if (!existingGroup) {
      acc.push({ ...group, mergedIds: [group.id] })
    } else {
      existingGroup.mergedIds.push(group.id)
    }
    return acc
  }, [] as Array<(typeof loanGroups)[number] & { mergedIds: string[] }>)

  // Helper to get loans for a merged group
  const getLoansForMergedGroup = (mergedIds: string[]) => {
    return mergedIds.flatMap(id => groupedLoans?.[id] || [])
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-hb-cognac">Lån</h1>
          <p className="text-sm text-muted-foreground">Hantera dina lån och skulder</p>
        </div>
      </motion.div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : loans && loans.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3"
        >
          <Card className="border-0 shadow-sm bg-secondary/40">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-hb-cognac" />
                <span className="text-xs text-muted-foreground">Total skuld</span>
              </div>
              <p className="text-xl font-bold text-hb-cognac">{formatCurrency(totalDebt)}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-secondary/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-hb-terracotta" />
                <span className="text-xs text-muted-foreground">Månadskostnad</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(totalMonthlyCost)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(totalMonthlyAmortization)} amor. + {formatCurrency(Math.round(totalMonthlyInterest))} ränta
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      {/* Average Interest Rate */}
      {loans && loans.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-hb-sage/20 flex items-center justify-center">
                  <Percent className="w-5 h-5 text-hb-cognac" />
                </div>
                <div>
                  <p className="font-medium">Snittränta</p>
                  <p className="text-xs text-muted-foreground">Viktad mot skuldbelopp</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-hb-cognac">{avgInterestRate.toFixed(2)}%</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Create Expenses Button */}
      {ownLoans && ownLoans.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <Button
            variant="outline"
            className="w-full h-12 gap-2 border-hb-cognac/30 hover:bg-hb-sage/20"
            onClick={() => setCreateExpensesOpen(true)}
          >
            <Receipt className="w-5 h-5 text-hb-cognac" />
            Registrera månadskostnader som utgifter
          </Button>
        </motion.div>
      )}

      {/* Loans List */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : loans && loans.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Grouped by loan type - Collapsible */}
          {groupedLoans && uniqueGroups?.map(group => {
            const groupLoans = getLoansForMergedGroup(group.mergedIds)
            if (!groupLoans || groupLoans.length === 0) return null

            const isExpanded = expandedGroups.has(group.id)
            const groupTotal = groupLoans.reduce((sum, loan) => sum + loan.current_balance, 0)
            const groupAmortization = groupLoans.reduce((sum, loan) => sum + loan.monthly_amortization, 0)
            const groupMonthlyInterest = groupLoans.reduce((sum, loan) => {
              return sum + (loan.current_balance * (loan.interest_rate / 100 / 12))
            }, 0)
            const groupTotalMonthlyCost = groupAmortization + groupMonthlyInterest
            const groupAvgRate = groupTotal > 0
              ? groupLoans.reduce((sum, loan) => sum + (loan.current_balance * loan.interest_rate), 0) / groupTotal
              : 0

            return (
              <Card key={group.id} className="border-0 shadow-sm overflow-hidden">
                {/* Collapsible Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <div className="text-left min-w-0">
                      <h2 className="font-semibold text-hb-cognac">{group.name}</h2>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{groupLoans.length} lån</span>
                        <span>{groupAvgRate.toFixed(2)}% snittränta</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        <span>Amor: {formatCurrency(groupAmortization)}/mån</span>
                        <span>Ränta: {formatCurrency(Math.round(groupMonthlyInterest))}/mån</span>
                        <span className="font-medium text-foreground">Totalt: {formatCurrency(Math.round(groupTotalMonthlyCost))}/mån</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-bold text-hb-cognac text-right">
                      {formatCurrency(groupTotal)}
                    </span>
                    <ChevronDown className={cn(
                      "w-5 h-5 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180"
                    )} />
                  </div>
                </button>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 pt-0 space-y-3">
                        {groupLoans.map((loan, index) => (
                          <LoanCard key={loan.id} loan={loan} index={index} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )
          })}

          {/* Ungrouped loans - Collapsible */}
          {groupedLoans?.['ungrouped'] && groupedLoans['ungrouped'].length > 0 && (() => {
            const ungroupedLoans = groupedLoans['ungrouped']
            const isExpanded = expandedGroups.has('ungrouped')
            const groupTotal = ungroupedLoans.reduce((sum, loan) => sum + loan.current_balance, 0)
            const groupAmortization = ungroupedLoans.reduce((sum, loan) => sum + loan.monthly_amortization, 0)
            const groupMonthlyInterest = ungroupedLoans.reduce((sum, loan) => {
              return sum + (loan.current_balance * (loan.interest_rate / 100 / 12))
            }, 0)
            const groupTotalMonthlyCost = groupAmortization + groupMonthlyInterest
            const groupAvgRate = groupTotal > 0
              ? ungroupedLoans.reduce((sum, loan) => sum + (loan.current_balance * loan.interest_rate), 0) / groupTotal
              : 0

            return (
              <Card className="border-0 shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup('ungrouped')}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-4 h-4 rounded-full bg-muted-foreground/30 shrink-0" />
                    <div className="text-left min-w-0">
                      <h2 className="font-semibold text-muted-foreground">Ej kategoriserade</h2>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{ungroupedLoans.length} lån</span>
                        <span>{groupAvgRate.toFixed(2)}% snittränta</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        <span>Amor: {formatCurrency(groupAmortization)}/mån</span>
                        <span>Ränta: {formatCurrency(Math.round(groupMonthlyInterest))}/mån</span>
                        <span className="font-medium text-foreground">Totalt: {formatCurrency(Math.round(groupTotalMonthlyCost))}/mån</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-bold text-right">
                      {formatCurrency(groupTotal)}
                    </span>
                    <ChevronDown className={cn(
                      "w-5 h-5 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180"
                    )} />
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 pt-0 space-y-3">
                        {ungroupedLoans.map((loan, index) => (
                          <LoanCard key={loan.id} loan={loan} index={index} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )
          })()}
        </motion.div>
      ) : (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-hb-sage/30 flex items-center justify-center mx-auto mb-4">
                <Landmark className="w-8 h-8 text-hb-cognac" />
              </div>
              <h3 className="font-semibold mb-2">Inga lån registrerade</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Lägg till dina lån för att spåra skulder och räntor
              </p>
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Lägg till lån
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Floating Add Button */}
      {loans && loans.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="fixed bottom-24 right-4 z-10"
        >
          <Button
            size="lg"
            className="rounded-full shadow-lg h-14 w-14"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-6 h-6" />
          </Button>
        </motion.div>
      )}

      {/* Add Loan Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lägg till lån</DialogTitle>
            <DialogDescription>
              Registrera ett nytt lån för att spåra skuld och ränta
            </DialogDescription>
          </DialogHeader>
          <LoanForm onSuccess={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="border-0 shadow-sm bg-hb-sage/10">
          <CardContent className="p-4">
            <h4 className="font-medium text-sm mb-2">Tips för lånhantering</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Håll koll på ränteändringar och uppdatera här</li>
              <li>• Se amorteringsplan för att förstå din tidslinje</li>
              <li>• Överväg att amortera extra på lån med hög ränta</li>
              <li>• Jämför räntor regelbundet för att hitta bättre villkor</li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>

      {/* Create Expenses Confirmation Dialog */}
      <AlertDialog open={createExpensesOpen} onOpenChange={setCreateExpensesOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-hb-cognac" />
              Skapa utgifter från lån?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  För <strong>{formatPeriodDisplay(currentPeriod.period)}</strong> baserat på dina {ownLoans?.length || 0} lån. Välj vad du vill göra:
                </p>
                <ul className="text-sm space-y-1.5 pl-1">
                  <li>• <strong>Bara beräkna nya belopp</strong> — drar av amorteringen från skulden och räknar om räntan. Skapar inga transaktioner.</li>
                  <li>• <strong>Beräkna + registrera</strong> — gör samma sak och bokför dessutom ränta och amortering som utgifter.</li>
                </ul>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Datum för utgifter (vid registrering)
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Kostnader som redan finns för perioden (även CSV-importerade med kategori Ränta/Amortering) hoppas över så inget dubbelbokas.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              onClick={() => handleCreateExpenses('register')}
              disabled={createExpensesFromLoans.isPending}
              className="w-full bg-hb-cognac hover:bg-hb-cognac/90"
            >
              {createExpensesFromLoans.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Arbetar...
                </>
              ) : (
                'Beräkna + registrera'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleCreateExpenses('calculate')}
              disabled={createExpensesFromLoans.isPending}
              className="w-full"
            >
              Bara beräkna nya belopp
            </Button>
            <AlertDialogCancel className="w-full mt-0">Avbryt</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
