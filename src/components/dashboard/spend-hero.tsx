'use client'

import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

interface SpendHeroProps {
  /** Spend tracking total this period (excl. credit-card invoice category) */
  spent: number
  /** Budget for expenses this period (0 if none set) */
  budget: number
  /** Income that landed on the account this period */
  income: number
  /** Direct withdrawals (excl. credit-card purchases) */
  cashOut: number
  hasBudget: boolean
}

/**
 * Main hero on the dashboard.
 *
 * PRIMARY (big number): spend tracking vs budget — "kvar att spendera".
 * This is the honest total: adding credit-card purchases makes it move,
 * so you always see how much you've really spent.
 *
 * SECONDARY (small row): cash flow — income minus direct withdrawals.
 * Shown for context but never as the headline, to avoid the false
 * comfort of credit-card purchases not moving the big number.
 */
export function SpendHero({ spent, budget, income, cashOut, hasBudget }: SpendHeroProps) {
  const remaining = budget - spent
  const overBudget = hasBudget && remaining < 0
  const spentRatio = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  const cashFlow = income - cashOut

  // Primary number: remaining to spend (if budget) else just spent
  const primaryValue = hasBudget ? remaining : spent
  const primaryLabel = hasBudget ? 'Kvar att spendera' : 'Spenderat denna period'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-card border border-border rounded-3xl px-6 py-7 md:px-8 md:py-8 shadow-sm"
    >
      <div
        className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-50"
        style={{ background: 'radial-gradient(circle, rgba(192,136,80,0.10), transparent 70%)' }}
      />

      <div className="relative">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
          {primaryLabel}
        </div>
        <div
          className={cn(
            'font-serif text-[40px] md:text-[48px] font-normal tracking-tight leading-[1.05] mt-2',
            overBudget ? 'text-destructive' : 'text-foreground'
          )}
        >
          {formatCurrency(primaryValue).replace(' kr', '')}
          <span className="font-serif text-[20px] md:text-[24px] text-muted-foreground ml-1">kr</span>
        </div>

        {hasBudget && (
          <>
            <div className="mt-4 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  overBudget ? 'bg-destructive' : spentRatio > 80 ? 'bg-hb-amber' : 'bg-hb-olive'
                )}
                style={{ width: `${spentRatio}%` }}
              />
            </div>
            <div className="mt-1.5 text-[12px] text-muted-foreground">
              {formatCurrency(spent)} av {formatCurrency(budget)} spenderat
            </div>
          </>
        )}

        {/* Secondary: cash flow */}
        <div className="mt-4 pt-3.5 border-t border-dashed border-border flex justify-between items-end">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
              Kassaflöde
            </div>
            <div className={cn(
              'font-serif text-[18px] md:text-[22px] font-medium tracking-tight mt-0.5',
              cashFlow < 0 ? 'text-destructive' : 'text-foreground'
            )}>
              {cashFlow >= 0 && '+'}
              {formatCurrency(cashFlow).replace(' kr', '')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
              Dras från konto
            </div>
            <div className="font-serif text-[18px] md:text-[22px] font-medium tracking-tight mt-0.5">
              {formatCurrency(cashOut).replace(' kr', '')}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
