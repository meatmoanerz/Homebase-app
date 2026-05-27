'use client'

import { useState, useMemo } from 'react'
import { useUser, usePartner } from '@/hooks/use-user'
import { useExpensesByPeriod } from '@/hooks/use-expenses'
import { useBudgetByPeriod } from '@/hooks/use-budgets'
import { useMonthlyIncomeTotal } from '@/hooks/use-monthly-incomes'
import { useReportHistory, getAdjacentPeriod } from '@/hooks/use-report-data'
import { getCurrentBudgetPeriod, getPeriodProgress } from '@/lib/utils/budget-period'
import { ReportHeader } from '@/components/report/report-header'
import { ReportHeroCard } from '@/components/report/report-hero-card'
import { ReportHistoryChart } from '@/components/report/report-history-chart'
import { ReportCategoryRanking } from '@/components/report/report-category-ranking'
import { ReportBudgetVariance } from '@/components/report/report-budget-variance'
import { ReportHouseholdCosts } from '@/components/report/report-household-costs'
import { ReportPartnerSpending } from '@/components/report/report-partner-spending'
import { ReportSavingsProgress } from '@/components/report/report-savings-progress'
import { ReportKpiInsights } from '@/components/report/report-kpi-insights'
import { ReportSkeleton } from '@/components/report/report-skeleton'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ReportPage() {
  const router = useRouter()
  const { data: user, isLoading: userLoading } = useUser()
  const { data: partner } = usePartner()
  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay)

  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod.period)
  const isCurrentPeriod = selectedPeriod === currentPeriod.period

  // Data for selected period
  const { data: expenses = [], isLoading: expLoading } = useExpensesByPeriod(selectedPeriod, salaryDay)
  const { data: budget } = useBudgetByPeriod(selectedPeriod)
  const { data: incomeTotal } = useMonthlyIncomeTotal(selectedPeriod)
  const { data: historySummaries = [] } = useReportHistory(salaryDay)

  // Filter out CCM expenses to avoid double counting (they come in via CC invoice next period)
  const cashflowExpenses = useMemo(() => expenses.filter(exp => !exp.is_ccm), [expenses])

  const totalIncome = incomeTotal?.total_income ?? 0
  const totalSpent = cashflowExpenses.reduce((sum, exp) => sum + exp.amount, 0)
  const periodProgress = isCurrentPeriod ? getPeriodProgress(salaryDay) : 100

  if (userLoading || expLoading) {
    return <ReportSkeleton />
  }

  const handlePrev = () => setSelectedPeriod(getAdjacentPeriod(selectedPeriod, 'prev'))
  const handleNext = () => {
    if (!isCurrentPeriod) setSelectedPeriod(getAdjacentPeriod(selectedPeriod, 'next'))
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Back button + title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-hb-cognac">Månadsrapport</h1>
      </motion.div>

      {/* Period navigation */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <ReportHeader
          period={selectedPeriod}
          onPrev={handlePrev}
          onNext={handleNext}
          isCurrentPeriod={isCurrentPeriod}
        />
      </motion.div>

      {/* Hero: Income vs Spend */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <ReportHeroCard totalIncome={totalIncome} totalSpent={totalSpent} />
      </motion.div>

      {/* 12-month history chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <ReportHistoryChart data={historySummaries} />
      </motion.div>

      {/* Top spending categories */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <ReportCategoryRanking expenses={cashflowExpenses} />
      </motion.div>

      {/* Budget vs Actual */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <ReportBudgetVariance expenses={cashflowExpenses} budget={budget ?? null} />
      </motion.div>

      {/* Household costs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <ReportHouseholdCosts
          expenses={cashflowExpenses}
          hasPartner={!!partner}
          userName={user?.first_name || 'Du'}
          partnerName={partner?.first_name || 'Partner'}
        />
      </motion.div>

      {/* Partner spending breakdown */}
      {!!partner && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <ReportPartnerSpending
            expenses={cashflowExpenses}
            userName={user?.first_name || 'Du'}
            partnerName={partner?.first_name || 'Partner'}
            userIncome={incomeTotal?.user_income ?? 0}
            partnerIncome={incomeTotal?.partner_income ?? 0}
          />
        </motion.div>
      )}

      {/* Savings progress */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <ReportSavingsProgress expenses={cashflowExpenses} selectedPeriod={selectedPeriod} />
      </motion.div>

      {/* KPI Insights */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <ReportKpiInsights
          expenses={cashflowExpenses}
          budget={budget ?? null}
          totalIncome={totalIncome}
          totalSpent={totalSpent}
          periodProgress={periodProgress}
          historySummaries={historySummaries}
          currentPeriod={selectedPeriod}
        />
      </motion.div>
    </div>
  )
}
