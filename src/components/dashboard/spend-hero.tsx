'use client'

import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'
import { Telescope, ChevronRight, CreditCard } from 'lucide-react'
import { getBudgetStatus, budgetStatusBarClass } from '@/lib/utils/budget-status'

interface SpendHeroProps {
  /** Consumption this period: every purchase once, credit-card invoice line excluded */
  spent: number
  /** Consumption budget this period, Kreditkort row excluded (0 if none set) */
  budget: number
  /** Income that landed on the account this period */
  income: number
  /** Direct withdrawals (excl. credit-card purchases) */
  cashOut: number
  hasBudget: boolean
  /** Projected consumption for the running period (null when not the current period). */
  forecast?: { spend: number; low: number; high: number } | null
  /** Projected money leaving the account this period, invoices included. */
  cashOutForecast?: number | null
  /** Credit-card invoice drawn next period: total and what is already on the card. */
  nextInvoice?: { value: number; registered: number } | null
  /** Days left until next salary (running period only). */
  daysLeft?: number | null
  /** e.g. "Tims andel" when the perspective is a single person. */
  scopeLabel?: string | null
}

/**
 * Main hero on the dashboard.
 *
 * PRIMARY (big number): consumption vs budget — "kvar att spendera".
 * Every purchase counts once when it is made, card purchases included,
 * so the number moves the moment you buy something.
 *
 * SECONDARY (small row): cash flow — income minus what leaves the account,
 * so far and projected at next salary, and the card invoice that follows
 * next period (the purchases pushed forward).
 */
export function SpendHero({ spent, budget, income, cashOut, hasBudget, forecast, cashOutForecast, nextInvoice, daysLeft, scopeLabel }: SpendHeroProps) {
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
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="label-caps text-muted-foreground">{primaryLabel}</div>
          {scopeLabel && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{scopeLabel}</span>
          )}
        </div>
        <div
          className={cn(
            'font-serif-hero text-[40px] md:text-[48px] leading-[1.05] mt-2',
            overBudget ? 'text-destructive' : 'text-foreground'
          )}
        >
          {formatCurrency(primaryValue)}
        </div>

        {hasBudget && (
          <>
            <div className="mt-4 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  budgetStatusBarClass(getBudgetStatus(spent, budget))
                )}
                style={{ width: `${spentRatio}%` }}
              />
            </div>
            <div className="mt-1.5 text-[12px] text-muted-foreground">
              {formatCurrency(spent)} av {formatCurrency(budget)} spenderat
              {daysLeft != null && ` · ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagar'} till lön`}
            </div>
          </>
        )}

        {forecast && (
          <Link
            href="/analys?view=forecast"
            className="mt-3 flex items-center gap-2.5 rounded-2xl bg-secondary/50 hover:bg-secondary px-3 py-2.5 transition-colors"
          >
            <Telescope className="w-4 h-4 text-hb-cognac-deep shrink-0" />
            <span className="flex-1 text-[13px]">
              Landar på <span className="font-semibold">~{formatCurrency(forecast.spend)}</span>
              {hasBudget && (
                <span className={cn('ml-1', forecast.spend > budget * 1.05 ? 'text-destructive' : 'text-muted-foreground')}>
                  {forecast.spend <= budget
                    ? `· ~${formatCurrency(budget - forecast.spend)} kvar`
                    : `· ~${formatCurrency(forecast.spend - budget)} över`}
                </span>
              )}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
          </Link>
        )}

        {/* Secondary: cash flow */}
        <div className="mt-4 pt-3.5 border-t border-dashed border-border flex justify-between items-end">
          <div>
            <div className="label-caps text-muted-foreground">
              Kassaflöde hittills
            </div>
            <div className={cn(
              'font-serif-kpi text-[18px] md:text-[22px] mt-1',
              cashFlow < 0 ? 'text-destructive' : 'text-foreground'
            )}>
              {cashFlow >= 0 && '+'}
              {formatCurrency(cashFlow)}
            </div>
          </div>
          <div className="text-right">
            <div className="label-caps text-muted-foreground">
              Dras från konto
            </div>
            <div className="font-serif-kpi text-[18px] md:text-[22px] mt-1">
              {formatCurrency(cashOut)}
            </div>
          </div>
        </div>

        {(cashOutForecast != null && income > 0) || nextInvoice ? (
          <div className="mt-2.5 space-y-1 text-[12px] text-muted-foreground">
            {cashOutForecast != null && income > 0 && (
              <div className="flex justify-between gap-3">
                <span>Kassaflöde vid lön</span>
                <span className={cn('font-medium', income - cashOutForecast < 0 ? 'text-destructive' : 'text-foreground')}>
                  ~{income - cashOutForecast >= 0 && '+'}{formatCurrency(income - cashOutForecast)}
                </span>
              </div>
            )}
            {nextInvoice && (
              <div className="flex justify-between items-start gap-3">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  Kortfaktura nästa period
                </span>
                <span className="text-right">
                  <span className="font-medium text-foreground">~{formatCurrency(nextInvoice.value)}</span>
                  {nextInvoice.value - nextInvoice.registered >= 1 && (
                    <span className="block text-[11px]">{formatCurrency(nextInvoice.registered)} redan på kortet</span>
                  )}
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}
