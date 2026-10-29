'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeftRight, ChevronRight } from 'lucide-react'
import { useUser, usePartner } from '@/hooks/use-user'
import { useHouseholdSettlement } from '@/hooks/use-household-economy'
import { formatCurrency } from '@/lib/utils/formatters'
import { formatPeriodDisplay, getCurrentBudgetPeriod } from '@/lib/utils/budget-period'

/** "Avräkning november · 1 av 3 klart" while the period has transfers left. */
export function SettlementShortcut() {
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const period = getCurrentBudgetPeriod(user?.salary_day || 25).period
  const { steps } = useHouseholdSettlement(period)

  const next = steps.find((s) => !s.done)
  if (!partner || !next) return null

  const doneCount = steps.filter((s) => s.done).length
  const month = formatPeriodDisplay(period).split(' ')[0]

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
      <Link
        href="/settings/shared-account"
        className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 shadow-sm hover:bg-secondary/40 transition-colors"
      >
        <span className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
          <ArrowLeftRight className="w-4 h-4 text-hb-cognac" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-medium">Avräkning {month}</span>
          <span className="block text-[11px] text-muted-foreground truncate">
            {doneCount} av {steps.length} klart · {next.title} {formatCurrency(next.amount)}
          </span>
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
      </Link>
    </motion.div>
  )
}
