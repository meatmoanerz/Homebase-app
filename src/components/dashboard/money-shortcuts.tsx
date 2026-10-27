'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Target, Landmark, ChevronRight } from 'lucide-react'
import { useSavingsGoals } from '@/hooks/use-savings-goals'
import { useAllLoans } from '@/hooks/use-loans'
import { formatCurrency } from '@/lib/utils/formatters'

/** Two small cards linking to Sparmål and Lån with their headline numbers. */
export function MoneyShortcuts() {
  const { data: goals = [] } = useSavingsGoals()
  const { data: loans = [] } = useAllLoans()

  const active = goals.filter((g) => g.status !== 'completed')
  const saved = active.reduce(
    (s, g) => s + (g.is_shared ? g.starting_balance_user1 + g.starting_balance_user2 : g.starting_balance),
    0
  )
  const target = active.reduce((s, g) => s + (g.target_amount || 0), 0)
  const debt = loans.reduce((s, l) => s + Number(l.current_balance), 0)
  const monthlyLoanCost = loans.reduce(
    (s, l) => s + (Number(l.current_balance) * Number(l.interest_rate)) / 100 / 12 + Number(l.monthly_amortization || 0),
    0
  )

  if (active.length === 0 && loans.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="grid grid-cols-2 gap-2.5"
    >
      <Link href="/savings" className="bg-card border border-border rounded-2xl px-4 py-3.5 shadow-sm hover:bg-secondary/40 transition-colors">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] font-medium">
            <Target className="w-4 h-4 text-hb-cognac" />
            Sparmål
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
        </div>
        <div className="font-serif-kpi text-[18px] mt-2">{formatCurrency(saved)}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {active.length === 0
            ? 'Inga aktiva mål'
            : target > 0
              ? `${Math.round((saved / target) * 100)} % av ${formatCurrency(target)}`
              : `${active.length} aktiva mål`}
        </div>
        {target > 0 && (
          <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-hb-green" style={{ width: `${Math.min(100, (saved / target) * 100)}%` }} />
          </div>
        )}
      </Link>
      <Link href="/settings/loans" className="bg-card border border-border rounded-2xl px-4 py-3.5 shadow-sm hover:bg-secondary/40 transition-colors">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] font-medium">
            <Landmark className="w-4 h-4 text-hb-cognac" />
            Lån
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
        </div>
        <div className="font-serif-kpi text-[18px] mt-2">{formatCurrency(debt)}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {loans.length === 0 ? 'Inga lån' : `~${formatCurrency(monthlyLoanCost)}/mån ränta + amortering`}
        </div>
      </Link>
    </motion.div>
  )
}
