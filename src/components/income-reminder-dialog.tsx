'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useUser } from '@/hooks/use-user'
import {
  useHasIncomeForCurrentPeriod,
  useCopyPreviousPeriodIncomes,
} from '@/hooks/use-monthly-incomes'
import { getCurrentBudgetPeriod, formatPeriodDisplay } from '@/lib/utils/budget-period'
import { Banknote, ArrowRight, Copy, Clock } from 'lucide-react'
import { toast } from 'sonner'

const REMINDER_DISMISSED_KEY = 'stacka_income_reminder_dismissed'

export function IncomeReminderDialog() {
  const router = useRouter()
  const { data: user, isLoading: userLoading } = useUser()
  const { data: hasIncome, isLoading: incomeLoading } = useHasIncomeForCurrentPeriod()
  const copyPreviousIncomes = useCopyPreviousPeriodIncomes()

  // Period the reminder was dismissed for this session (sessionStorage).
  const [dismissedPeriod, setDismissedPeriod] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : sessionStorage.getItem(REMINDER_DISMISSED_KEY)
  )
  const [closed, setClosed] = useState(false)
  const [delayPassed, setDelayPassed] = useState(false)

  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay)
  const isDismissed = dismissedPeriod === currentPeriod.period

  // The current budget period always starts on the (weekend-adjusted)
  // salary day, so being in it means the salary has been paid: remind
  // whenever the period has no income, unless dismissed this session.
  const shouldShow = !userLoading && !incomeLoading && hasIncome === false && !isDismissed

  // Small delay to prevent a flash on initial load.
  useEffect(() => {
    if (!shouldShow) return
    const timeout = setTimeout(() => setDelayPassed(true), 1000)
    return () => clearTimeout(timeout)
  }, [shouldShow])

  const isOpen = shouldShow && delayPassed && !closed
  const setIsOpen = (open: boolean) => setClosed(!open)

  const handleDismiss = () => {
    sessionStorage.setItem(REMINDER_DISMISSED_KEY, currentPeriod.period)
    setDismissedPeriod(currentPeriod.period)
    setIsOpen(false)
  }

  const handleGoToIncomePage = () => {
    setIsOpen(false)
    router.push(`/budget/income?period=${currentPeriod.period}`)
  }

  const handleCopyPrevious = async () => {
    try {
      const result = await copyPreviousIncomes.mutateAsync(currentPeriod.period)
      toast.success(`${result.incomes.length} inkomster kopierade från förra månaden`)
      setIsOpen(false)
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Kunde inte kopiera inkomster')
      }
    }
  }

  // Don't render if we shouldn't show
  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="w-16 h-16 rounded-full bg-hb-sage/30 flex items-center justify-center mx-auto mb-4">
            <Banknote className="w-8 h-8 text-hb-cognac" />
          </div>
          <DialogTitle className="text-xl">Lägg till månadens inkomst</DialogTitle>
          <DialogDescription className="text-base">
            Du har inte registrerat inkomst för{' '}
            <span className="font-medium capitalize">{formatPeriodDisplay(currentPeriod.period)}</span> ännu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <Button
            className="w-full h-12"
            onClick={handleGoToIncomePage}
          >
            Lägg till inkomst
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <Button
            variant="outline"
            className="w-full h-12"
            onClick={handleCopyPrevious}
            disabled={copyPreviousIncomes.isPending}
          >
            <Copy className="w-4 h-4 mr-2" />
            {copyPreviousIncomes.isPending ? 'Kopierar...' : 'Samma som förra månaden'}
          </Button>

          <Button
            variant="ghost"
            className="w-full h-10 text-muted-foreground"
            onClick={handleDismiss}
          >
            <Clock className="w-4 h-4 mr-2" />
            Påminn mig senare
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
