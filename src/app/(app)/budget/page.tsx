'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useBudgets, type BudgetListEntry } from '@/hooks/use-budgets'
import { useTemporaryBudgets } from '@/hooks/use-temporary-budgets'
import { useExpensesByPeriod } from '@/hooks/use-expenses'
import { useUser, usePartner } from '@/hooks/use-user'
import { BudgetListSkeleton } from '@/components/budget/budget-list-skeleton'
import { IncomeOverviewCard } from '@/components/budget/income-overview-card'
import { formatCurrency, formatPercentage, formatDate } from '@/lib/utils/formatters'
import { formatPeriodDisplay, getCurrentBudgetPeriod } from '@/lib/utils/budget-period'
import { getCurrency, formatCurrencyAmount, convertFromSEK } from '@/lib/utils/currencies'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, ChevronRight, ChevronDown, Calendar, Target, Archive, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TemporaryBudgetWithCategories } from '@/types'
import { sumBudgetSplit } from '@/lib/utils/budget-split'

export default function BudgetListPage() {
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { data: budgets, isLoading: budgetsLoading } = useBudgets()
  const { data: tempBudgets } = useTemporaryBudgets()

  const salaryDay = user?.salary_day || 25
  const currentPeriod = getCurrentBudgetPeriod(salaryDay)
  const hasPartner = !!partner

  const activeBudgets = useMemo(() => {
    return budgets?.filter(b => !b.is_archived) || []
  }, [budgets])

  if (budgetsLoading) {
    return <BudgetListSkeleton />
  }

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-5">
      {/* Desktop title */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="hidden md:flex items-baseline justify-between"
      >
        <div>
          <h1 className="font-serif text-[32px] font-medium tracking-tight">Budget</h1>
          <p className="text-sm text-muted-foreground mt-1">Plan och utfall</p>
        </div>
        <Link
          href="/budget/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-hb-nav text-hb-nav-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Ny budget
        </Link>
      </motion.div>

      {/* Mobile "ny budget" small pill */}
      <div className="md:hidden flex justify-end -mt-2">
        <Link
          href="/budget/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-hb-nav text-hb-nav-foreground text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Ny budget
        </Link>
      </div>

      {/* Monthly income */}
      <IncomeOverviewCard period={currentPeriod.period} />

      {/* Monthly budgets */}
      {activeBudgets.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-2xl py-10 text-center shadow-sm"
        >
          <div className="w-12 h-12 mx-auto rounded-xl bg-hb-cognac/10 grid place-items-center mb-3">
            <Calendar className="w-6 h-6 text-hb-cognac" />
          </div>
          <h3 className="font-serif text-lg font-medium mb-1">Inga budgetar ännu</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
            Skapa din första månadsbudget för att börja planera
          </p>
          <Link
            href="/budget/new"
            className="inline-flex px-4 py-2 rounded-full bg-hb-nav text-hb-nav-foreground text-sm font-medium"
          >
            Skapa budget
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-2.5">
          <h2 className="font-serif text-[20px] font-medium tracking-tight pb-1">
            Månadsbudgetar
          </h2>
          {activeBudgets.map((budget, index) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              index={index}
              isCurrent={budget.period === currentPeriod.period}
              salaryDay={salaryDay}
              hasPartner={hasPartner}
              userName={user?.first_name || 'Du'}
              partnerName={partner?.first_name || 'Partner'}
              userId={user?.id}
              partnerId={partner?.id}
            />
          ))}
        </div>
      )}

      {/* Projektbudgetar */}
      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between pt-2">
          <h2 className="font-serif text-[20px] font-medium tracking-tight flex items-center gap-2">
            <FolderOpen className="w-[18px] h-[18px] text-hb-cognac" />
            Projektbudgetar
          </h2>
          <Link
            href="/budget/project/new"
            className="text-xs text-hb-cognac-deep font-medium tracking-wide hover:underline"
          >
            Ny →
          </Link>
        </div>

        {!tempBudgets || tempBudgets.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl py-8 text-center shadow-sm">
            <div className="w-10 h-10 mx-auto rounded-xl bg-hb-cognac/10 grid place-items-center mb-3">
              <Target className="w-5 h-5 text-hb-cognac" />
            </div>
            <h3 className="font-medium text-sm mb-1">Inga projektbudgetar</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto px-4">
              Skapa en budget för resor, renoveringar eller andra projekt
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tempBudgets.map((tb, index) => (
              <TemporaryBudgetCard key={tb.id} budget={tb} index={index} />
            ))}
          </div>
        )}
      </section>

      <Link
        href="/budget/archive"
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-3"
      >
        <Archive className="w-4 h-4" />
        Visa arkiv
      </Link>
    </div>
  )
}

interface BudgetCardProps {
  budget: BudgetListEntry
  index: number
  isCurrent: boolean
  salaryDay: number
  hasPartner: boolean
  userName: string
  partnerName: string
  userId?: string
  partnerId?: string | null
}

function BudgetCard({ budget, index, isCurrent, salaryDay, hasPartner, userName, partnerName, userId, partnerId }: BudgetCardProps) {
  const { data: expenses } = useExpensesByPeriod(budget.period, salaryDay)
  const [expanded, setExpanded] = useState(false)

  const { totalSpent, userSpent, partnerSpent } = useMemo(() => {
    if (!expenses) return { totalSpent: 0, userSpent: 0, partnerSpent: 0 }
    let total = 0, u = 0, p = 0
    for (const e of expenses) {
      total += e.amount
      const a = e.cost_assignment || 'personal'
      if (a === 'personal') u += e.amount
      else if (a === 'partner') p += e.amount
      else { u += e.amount / 2; p += e.amount / 2 }
    }
    return { totalSpent: total, userSpent: u, partnerSpent: p }
  }, [expenses])

  const budgetedExpenses = (budget.total_expenses || 0) + (budget.total_savings || 0)
  // Per-person budget from explicit budget_item_assignments (50/50 fallback per item)
  const { userBudget, partnerBudget } = useMemo(() => {
    const items = budget.budget_items || []
    if (items.length === 0) {
      return { userBudget: budgetedExpenses / 2, partnerBudget: budgetedExpenses / 2 }
    }
    const split = sumBudgetSplit(items, userId, partnerId)
    return { userBudget: split.user, partnerBudget: split.partner }
  }, [budget.budget_items, budgetedExpenses, userId, partnerId])
  const spentRatio = budgetedExpenses > 0 ? (totalSpent / budgetedExpenses) * 100 : 0
  const remaining = budgetedExpenses - totalSpent
  const isOver = remaining < 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04 }}
      className={cn(
        'bg-card border border-border rounded-2xl shadow-sm overflow-hidden',
        isCurrent && 'ring-1 ring-hb-cognac/40'
      )}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-[18px] font-medium tracking-tight capitalize">
                {formatPeriodDisplay(budget.period)}
              </span>
              {isCurrent && (
                <span className="text-[10px] uppercase tracking-[0.08em] text-hb-cognac-deep font-semibold px-1.5 py-0.5 bg-hb-cognac/10 rounded-full">
                  Aktuell
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Sparkvot {formatPercentage(budget.savings_ratio)}
            </div>
          </div>
          <div className="text-right">
            <div className="font-serif text-[16px] font-medium tracking-tight">
              {formatCurrency(totalSpent)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              av {formatCurrency(budgetedExpenses)}
            </div>
          </div>
        </div>

        <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isOver ? 'bg-destructive' : spentRatio > 80 ? 'bg-hb-amber' : 'bg-hb-olive'
            )}
            style={{ width: `${Math.min(spentRatio, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-3">
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[11px] text-muted-foreground font-medium tracking-wide flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {hasPartner ? (expanded ? 'Dölj fördelning' : 'Per person') : (expanded ? 'Dölj' : 'Mer')}
            <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
          </button>
          <Link
            href={`/budget/${budget.id}`}
            className="text-[11px] text-hb-cognac-deep font-medium tracking-wide flex items-center gap-0.5 hover:underline"
          >
            Öppna
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border bg-secondary/30"
          >
            <div className="px-4 py-3 space-y-3">
              {hasPartner ? (
                <>
                  <PersonRow name={userName} spent={userSpent} budget={userBudget} variant="user" />
                  <PersonRow name={partnerName} spent={partnerSpent} budget={partnerBudget} variant="partner" />
                </>
              ) : (
                <div className="flex justify-between text-[12px] text-muted-foreground">
                  <span>Kvar att spendera</span>
                  <span className={cn('font-serif text-[15px] font-medium', isOver && 'text-destructive')}>
                    {formatCurrency(remaining)}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function PersonRow({
  name,
  spent,
  budget,
  variant,
}: {
  name: string
  spent: number
  budget: number
  variant: 'user' | 'partner'
}) {
  const percent = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  const remaining = budget - spent
  const isOver = remaining < 0
  const avClass = variant === 'user' ? 'bg-hb-tim-soft text-hb-tim' : 'bg-hb-amanda-soft text-hb-amanda'
  const barClass = variant === 'user' ? 'bg-hb-tim' : 'bg-hb-amanda'
  const initial = (name?.[0] || '?').toUpperCase()

  return (
    <div className="flex items-center gap-3">
      <div className={cn('w-7 h-7 rounded-full grid place-items-center font-serif text-xs font-semibold flex-shrink-0', avClass)}>
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-medium">{name}</span>
          <span className={cn('font-serif text-[13px] font-medium', isOver && 'text-destructive')}>
            {formatCurrency(spent)} / {formatCurrency(budget)}
          </span>
        </div>
        <div className="mt-1 h-1 bg-secondary rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', isOver ? 'bg-destructive' : barClass)} style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  )
}

function TemporaryBudgetCard({ budget, index }: { budget: TemporaryBudgetWithCategories; index: number }) {
  const isNonSEK = budget.currency !== 'SEK'
  const currencyInfo = getCurrency(budget.currency)
  const spentRatio = budget.total_budget > 0 ? (budget.total_spent / budget.total_budget) * 100 : 0
  const isOverBudget = budget.total_spent > budget.total_budget

  const endDate = new Date(budget.end_date)
  const now = new Date()
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  const isExpired = daysRemaining === 0
  const isCompleted = budget.status === 'completed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.04 }}
    >
      <Link
        href={`/budget/project/${budget.id}`}
        className={cn(
          'block bg-card border border-border rounded-2xl px-4 py-3.5 shadow-sm hover:bg-secondary/30 transition-colors',
          isCompleted && 'opacity-70'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-serif text-[16px] font-medium tracking-tight truncate">{budget.name}</div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
              <span>{formatDate(budget.start_date)} – {formatDate(budget.end_date)}</span>
              {isNonSEK && currencyInfo && (
                <span className="px-1.5 py-0.5 rounded bg-secondary font-semibold tracking-wide">
                  {currencyInfo.code}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/70 flex-shrink-0" />
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Förbrukat</span>
          <span className={cn('font-serif text-[14px] font-medium', isOverBudget && 'text-destructive')}>
            {isNonSEK
              ? `${formatCurrencyAmount(convertFromSEK(budget.total_spent, budget.exchange_rate), budget.currency)} / ${formatCurrencyAmount(convertFromSEK(budget.total_budget, budget.exchange_rate), budget.currency)}`
              : `${formatCurrency(budget.total_spent)} / ${formatCurrency(budget.total_budget)}`}
          </span>
        </div>

        <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', isOverBudget ? 'bg-destructive' : 'bg-hb-olive')}
            style={{ width: `${Math.min(spentRatio, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
          <span>
            {isCompleted ? 'Klar' : isExpired ? 'Avslutad' : `${daysRemaining} dagar kvar`}
          </span>
          <span>{budget.temporary_budget_categories.length} kategorier</span>
        </div>
      </Link>
    </motion.div>
  )
}
