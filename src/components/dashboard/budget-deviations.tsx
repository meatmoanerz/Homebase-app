'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'
import { getBudgetStatus, budgetStatusBarClass, type BudgetStatus } from '@/lib/utils/budget-status'
import { cn } from '@/lib/utils/cn'

export interface CategoryDeviation {
  categoryId: string
  name: string
  budget: number
  actual: number
  /** Projected landing for the running period (variable categories). */
  projected: number | null
}

interface BudgetDeviationsProps {
  items: CategoryDeviation[]
  hasBudget: boolean
}

/**
 * The categories that need attention: over budget, or heading there.
 * Shows at most three; a calm confirmation when everything is on track.
 */
export function BudgetDeviations({ items, hasBudget }: BudgetDeviationsProps) {
  if (!hasBudget) return null

  const ranked = items
    .map((i) => {
      const landing = Math.max(i.actual, i.projected ?? i.actual)
      return { ...i, landing, status: getBudgetStatus(landing, i.budget) as BudgetStatus }
    })
    .filter((i) => i.budget > 0 && (i.status === 'over' || (i.status === 'near' && i.projected != null && i.landing > i.budget * 0.9)))
    .sort((a, b) => b.landing - b.budget - (a.landing - a.budget))
    .slice(0, 3)

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="flex items-baseline justify-between pb-2.5">
        <h2 className="font-serif text-[20px] font-medium tracking-tight">Att hålla koll på</h2>
        <Link href="/budget" className="text-[12px] text-hb-cognac-deep font-medium">Budget</Link>
      </div>
      {ranked.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-hb-green shrink-0" />
          <span className="text-[13px] text-muted-foreground">Alla kategorier ligger inom budget i takt med perioden.</span>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl shadow-sm divide-y divide-border overflow-hidden">
          {ranked.map((i) => {
            const over = i.actual - i.budget
            return (
              <Link key={i.categoryId} href="/analys" className="block px-4 py-3 hover:bg-secondary/40 transition-colors">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium truncate">{i.name}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className={cn('font-serif text-[14px] font-medium', i.actual > i.budget * 1.05 && 'text-destructive')}>
                      {formatCurrency(i.actual)} / {formatCurrency(i.budget)}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', budgetStatusBarClass(getBudgetStatus(i.actual, i.budget)))}
                    style={{ width: `${Math.min(100, (i.actual / i.budget) * 100)}%` }}
                  />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {over > 0
                    ? `${formatCurrency(over)} över budget`
                    : `I takt att landa på ~${formatCurrency(i.landing)} (${formatCurrency(i.landing - i.budget)} över)`}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </motion.section>
  )
}
