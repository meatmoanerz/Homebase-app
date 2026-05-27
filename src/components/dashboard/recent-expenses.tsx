'use client'

import Link from 'next/link'
import { formatCurrency, formatRelativeDate } from '@/lib/utils/formatters'
import { Receipt } from 'lucide-react'
import { motion } from 'framer-motion'
import { AssignmentPill, AmexPill } from '@/components/shared/assignment-pill'
import type { ExpenseWithCategory } from '@/types'

interface RecentExpensesProps {
  expenses: ExpenseWithCategory[]
}

const categoryIcons: Record<string, string> = {
  Mat: '🛒',
  Hem: '🏠',
  Kläder: '👕',
  Nöje: '🎬',
  Restaurang: '🍽️',
  Transport: '🚗',
  Kollektivtrafik: '🚌',
  Resor: '✈️',
  El: '⚡',
  Prenumerationer: '📱',
  Hälsa: '💊',
  Streaming: '🎬',
}

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  if (expenses.length === 0) {
    return (
      <section>
        <div className="flex items-baseline justify-between pb-3">
          <h2 className="font-serif text-[20px] font-medium tracking-tight">Senaste</h2>
        </div>
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-xl bg-hb-cognac/10 grid place-items-center mb-3">
            <Receipt className="w-6 h-6 text-hb-cognac" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Inga utgifter ännu denna period
          </p>
          <Link
            href="/expenses"
            className="inline-flex items-center px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Lägg till utgift
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-baseline justify-between pb-3">
        <h2 className="font-serif text-[20px] font-medium tracking-tight">Senaste</h2>
        <Link
          href="/expenses/list"
          className="text-xs text-hb-cognac-deep font-medium tracking-wide hover:underline"
        >
          Alla →
        </Link>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {expenses.map((expense, index) => (
          <motion.div
            key={expense.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="flex items-center justify-between px-4 py-3.5 border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-secondary grid place-items-center text-base flex-shrink-0">
                {categoryIcons[expense.category?.name ?? ''] || '💰'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm tracking-tight truncate">
                  {expense.description}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">
                    {expense.category?.name} · {formatRelativeDate(expense.date)}
                  </span>
                  {expense.is_ccm && <AmexPill />}
                  <AssignmentPill assignment={expense.cost_assignment} />
                </div>
              </div>
            </div>
            <div className="font-serif text-[16px] font-medium tracking-tight text-foreground ml-2 flex-shrink-0">
              {formatCurrency(expense.amount)}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
