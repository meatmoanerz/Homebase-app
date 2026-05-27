'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MonthlyIncomeForm } from '@/components/budget/monthly-income-form'
import {
  useHouseholdMonthlyIncomes,
  useMonthlyIncomeTotal,
  useDeleteMonthlyIncome,
  useCopyPreviousPeriodIncomes,
} from '@/hooks/use-monthly-incomes'
import { useUser, usePartner } from '@/hooks/use-user'
import { formatCurrency } from '@/lib/utils/formatters'
import { getCurrentBudgetPeriod, getYearToCurrentPeriods, formatPeriodDisplay } from '@/lib/utils/budget-period'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Banknote, Pencil, Trash2, Copy, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from 'sonner'
import type { HouseholdMonthlyIncome } from '@/types'

export default function MonthlyIncomePage() {
  const searchParams = useSearchParams()
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const salaryDay = user?.salary_day || 25

  const currentPeriod = getCurrentBudgetPeriod(salaryDay)
  const periods = getYearToCurrentPeriods(salaryDay)

  const initialPeriod = searchParams.get('period') || currentPeriod.period
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod)
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState<HouseholdMonthlyIncome | null>(null)

  const { data: incomes = [], isLoading } = useHouseholdMonthlyIncomes(selectedPeriod)
  const { data: totals } = useMonthlyIncomeTotal(selectedPeriod)
  const deleteIncome = useDeleteMonthlyIncome()
  const copyPreviousIncomes = useCopyPreviousPeriodIncomes()

  const userIncomes = useMemo(() => incomes.filter(i => i.is_own), [incomes])
  const partnerIncomes = useMemo(() => incomes.filter(i => !i.is_own), [incomes])

  const handleDelete = async (income: HouseholdMonthlyIncome) => {
    try {
      await deleteIncome.mutateAsync({ id: income.id, period: selectedPeriod })
      toast.success(`"${income.name}" borttagen`)
    } catch {
      toast.error('Kunde inte ta bort inkomsten')
    }
  }

  const handleCopyPrevious = async () => {
    try {
      const result = await copyPreviousIncomes.mutateAsync(selectedPeriod)
      toast.success(`${result.incomes.length} inkomster kopierade från förra månaden`)
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Kunde inte kopiera inkomster')
      }
    }
  }

  const handleEditComplete = () => {
    setEditingIncome(null)
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href="/budget">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-hb-cognac">Månadens inkomst</h1>
          <p className="text-sm text-muted-foreground">
            {partner ? 'Registrera inkomster för hushållet' : 'Registrera dina inkomster för perioden'}
          </p>
        </div>
      </motion.div>

      {/* Period Selector */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="relative">
          <button
            onClick={() => setPeriodDropdownOpen(!periodDropdownOpen)}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-muted/50 text-left"
          >
            <div>
              <p className="text-xs text-muted-foreground">Period</p>
              <p className="font-semibold capitalize">{formatPeriodDisplay(selectedPeriod)}</p>
            </div>
            <ChevronDown className={cn(
              "w-5 h-5 text-muted-foreground transition-transform",
              periodDropdownOpen && "rotate-180"
            )} />
          </button>

          <AnimatePresence>
            {periodDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-50 w-full mt-2 bg-white dark:bg-card rounded-xl shadow-lg border border-border overflow-hidden"
              >
                {periods.map((period) => (
                  <button
                    key={period.period}
                    onClick={() => {
                      setSelectedPeriod(period.period)
                      setPeriodDropdownOpen(false)
                    }}
                    className={cn(
                      "w-full px-4 py-3 text-left hover:bg-muted/50 flex items-center justify-between transition-colors capitalize",
                      selectedPeriod === period.period && "bg-muted/30"
                    )}
                  >
                    <span>{period.displayName}</span>
                    {selectedPeriod === period.period && (
                      <Check className="w-4 h-4 text-hb-cognac" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Income Form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <MonthlyIncomeForm
              period={selectedPeriod}
              editingIncome={editingIncome}
              onEditComplete={handleEditComplete}
              hasPartner={!!partner}
              userName={user?.first_name || 'Du'}
              partnerName={partner?.first_name || 'Partner'}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Income List */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-3"
      >
        {/* User's incomes */}
        {userIncomes.length > 0 && (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="px-4 py-3 bg-muted/30 border-b border-border">
                <p className="text-sm font-medium text-muted-foreground">Dina inkomster</p>
              </div>
              {userIncomes.map((income, index) => (
                <IncomeRow
                  key={income.id}
                  income={income}
                  isLast={index === userIncomes.length - 1}
                  onEdit={() => setEditingIncome(income)}
                  onDelete={() => handleDelete(income)}
                  isDeleting={deleteIncome.isPending}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Partner's incomes */}
        {partnerIncomes.length > 0 && (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="px-4 py-3 bg-hb-sand-deep/20 border-b border-border">
                <p className="text-sm font-medium text-muted-foreground">
                  {partnerIncomes[0]?.owner_name}s inkomster
                </p>
              </div>
              {partnerIncomes.map((income, index) => (
                <IncomeRow
                  key={income.id}
                  income={income}
                  isLast={index === partnerIncomes.length - 1}
                  onEdit={() => setEditingIncome(income)}
                  onDelete={() => handleDelete(income)}
                  isDeleting={deleteIncome.isPending}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!isLoading && incomes.length === 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-hb-sage/30 flex items-center justify-center mx-auto mb-4">
                <Banknote className="w-8 h-8 text-hb-cognac" />
              </div>
              <h3 className="font-semibold mb-2">Inga inkomster registrerade</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Lägg till dina inkomster för {formatPeriodDisplay(selectedPeriod)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Total */}
        {incomes.length > 0 && (
          <Card className="border-0 shadow-sm bg-hb-sage/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total hushållsinkomst</span>
                <span className="text-xl font-bold text-hb-cognac">
                  {formatCurrency(totals?.total_income || 0)}
                </span>
              </div>
              {totals && totals.partner_income > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
                  <span>Din del: {formatCurrency(totals.user_income)}</span>
                  <span>Partner: {formatCurrency(totals.partner_income)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Copy from previous period */}
        {userIncomes.length === 0 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleCopyPrevious}
            disabled={copyPreviousIncomes.isPending}
          >
            <Copy className="w-4 h-4 mr-2" />
            {copyPreviousIncomes.isPending ? 'Kopierar...' : 'Kopiera från förra månaden'}
          </Button>
        )}
      </motion.div>
    </div>
  )
}

interface IncomeRowProps {
  income: HouseholdMonthlyIncome
  isLast: boolean
  readonly?: boolean
  onEdit?: () => void
  onDelete?: () => void
  isDeleting?: boolean
}

function IncomeRow({ income, isLast, readonly, onEdit, onDelete, isDeleting }: IncomeRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-4",
        !isLast && "border-b border-border"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-hb-sage/20 flex items-center justify-center">
          <Banknote className="w-5 h-5 text-hb-cognac" />
        </div>
        <div>
          <p className="font-medium">{income.name}</p>
          {!income.is_own && (
            <p className="text-xs text-muted-foreground">{income.owner_name}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold">{formatCurrency(income.amount)}</span>
        {!readonly && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-hb-cognac"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
