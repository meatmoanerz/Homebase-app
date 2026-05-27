'use client'

import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

interface CashFlowHeroProps {
  /** Total income this period */
  income: number
  /** Total spent — defined per spend tracking: all expenses excluding ones flagged with excludes_from_expense_total */
  spent: number
  /** Optional label override */
  label?: string
}

export function CashFlowHero({ income, spent, label = 'Kassaflöde denna period' }: CashFlowHeroProps) {
  const cashFlow = income - spent
  const positive = cashFlow >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-card border border-border rounded-3xl px-6 py-7 md:px-8 md:py-8 shadow-sm"
    >
      {/* Subtle radial glow in the corner — never strong enough to call attention */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-50"
        style={{
          background: 'radial-gradient(circle, rgba(192,136,80,0.10), transparent 70%)',
        }}
      />

      <div className="relative">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
          {label}
        </div>
        <div
          className={cn(
            'font-serif text-[40px] md:text-[48px] font-normal tracking-tight leading-[1.05] mt-2',
            positive ? 'text-foreground' : 'text-destructive'
          )}
        >
          {positive && '+'}
          {formatCurrency(cashFlow).replace(' kr', '')}
          <span className="font-serif text-[20px] md:text-[24px] text-muted-foreground ml-1">kr</span>
        </div>

        <div className="mt-4 pt-3.5 border-t border-dashed border-border flex justify-between items-end">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
              Inkomst
            </div>
            <div className="font-serif text-[18px] md:text-[22px] font-medium tracking-tight mt-0.5">
              {formatCurrency(income).replace(' kr', '')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
              Ut just nu
            </div>
            <div className="font-serif text-[18px] md:text-[22px] font-medium tracking-tight mt-0.5">
              {formatCurrency(spent).replace(' kr', '')}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
