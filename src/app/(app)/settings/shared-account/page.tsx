'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, ChevronRight, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsPageSkeleton } from '@/components/shared/page-skeletons'
import { HouseholdSettlementCard } from '@/components/household/household-settlement-card'
import { HouseholdIncomeCard } from '@/components/household/household-income-card'
import { HouseholdSummaryCard } from '@/components/household/household-summary-card'
import { useBudgets } from '@/hooks/use-budgets'
import { useUser, usePartner } from '@/hooks/use-user'
import { useHouseholdSettlement, useToggleSettlementCheck } from '@/hooks/use-household-economy'
import { HOUSEHOLD_MODEL_LABELS } from '@/lib/household/economy'
import { formatPeriodDisplay, getCurrentBudgetPeriod, getNextPeriods, getRecentPeriods } from '@/lib/utils/budget-period'

export default function SharedAccountPage() {
  const { data: user, isLoading: userLoading } = useUser()
  const { isLoading: budgetsLoading } = useBudgets()
  // Wait for the salary day (default period) and the budgets, so the page
  // never opens on the wrong period or flashes "Ingen budget finns".
  if (userLoading || budgetsLoading || !user) return <SettingsPageSkeleton />
  return <SharedAccountView />
}

function SharedAccountView() {
  const router = useRouter()
  const { data: user } = useUser()
  const { data: partner } = usePartner()

  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay).period
  // Next period first: its budget is usually made before payday
  const periods = useMemo(() => {
    const next = getNextPeriods(salaryDay, 2)[1]
    return [next, ...getRecentPeriods(salaryDay, 6)]
  }, [salaryDay])
  const [period, setPeriod] = useState(currentPeriod)

  const { settings, incomes, incomeSplit, hasPartner, budget, budgetLoading, summary, steps } = useHouseholdSettlement(period)
  const toggleCheck = useToggleSettlementCheck()

  const userName = user?.first_name || 'Du'
  const partnerName = partner?.first_name || 'Partner'
  const monthLabel = formatPeriodDisplay(period).split(' ')[0]

  const countedIncomeNames = useMemo(() => {
    const names = new Set(incomes.filter((i) => !settings.excludedIncomeNames.has(i.name)).map((i) => i.name))
    return Array.from(names).join(' · ')
  }, [incomes, settings.excludedIncomeNames])

  const periodTitle = formatPeriodDisplay(period)
  const imageSubtitle = `${periodTitle.charAt(0).toUpperCase()}${periodTitle.slice(1)}${hasPartner ? ` · ${HOUSEHOLD_MODEL_LABELS[settings.model]}` : ''}`

  return (
    <div className="p-4 space-y-4">
      {/* Header (mobile shows title + back in the app header) */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="hidden md:flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Tillbaka">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-hb-cognac">Gemensam ekonomi</h1>
          <p className="text-sm text-muted-foreground">Månadens överföringar</p>
        </div>
      </motion.div>

      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="w-full h-11">
          <SelectValue placeholder="Välj period" />
        </SelectTrigger>
        <SelectContent>
          {periods.map((p) => (
            <SelectItem key={p.period} value={p.period}>
              <span className="capitalize">{formatPeriodDisplay(p.period)}</span>
              {p.period === currentPeriod && <span className="ml-2 text-xs text-hb-cognac">(aktuell)</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasPartner && (
        <Link
          href="/settings/partner"
          className="flex items-center gap-2 text-[13px] text-muted-foreground -mt-1"
        >
          Ni delar <span className="font-semibold text-foreground">{HOUSEHOLD_MODEL_LABELS[settings.model].toLowerCase()}</span>
          <span className="ml-auto flex items-center font-semibold text-hb-cognac-deep">Ändra <ChevronRight className="w-4 h-4" /></span>
        </Link>
      )}

      {!budgetLoading && !budget && (
        <Card className="border-0 shadow-sm bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-amber-800 dark:text-amber-300">Ingen budget finns för {periodTitle}.</p>
            <Button
              variant="link"
              className="text-amber-800 dark:text-amber-300 p-0 h-auto mt-1"
              onClick={() => router.push(`/budget/new?period=${period}`)}
            >
              Skapa budget
            </Button>
          </CardContent>
        </Card>
      )}

      {steps.length > 0 && (
        <HouseholdSettlementCard
          monthLabel={monthLabel}
          steps={steps}
          swishAmount={steps.find((s) => s.id === 'equalize')?.amount}
          onToggle={(step) => toggleCheck.mutate({ period, step: step.id, done: !step.done })}
        />
      )}

      {hasPartner && (
        <HouseholdIncomeCard
          model={settings.model}
          split={incomeSplit}
          userName={userName}
          partnerName={partnerName}
          monthLabel={monthLabel}
          incomeNames={countedIncomeNames}
        />
      )}

      {budget && (
        <HouseholdSummaryCard
          summary={summary}
          transfers={steps.map((s) => ({ label: s.title, amount: s.amount }))}
          userName={userName}
          partnerName={partnerName}
          hasPartner={hasPartner}
          imageSubtitle={imageSubtitle}
          fileName={`gemensam-ekonomi-${period}.png`}
        />
      )}

      {!hasPartner && (
        <Card className="border-0 shadow-sm bg-hb-sage/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-hb-cognac shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Koppla en partner för att dela upp gemensamma kostnader och välja hur ni delar ekonomin.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
