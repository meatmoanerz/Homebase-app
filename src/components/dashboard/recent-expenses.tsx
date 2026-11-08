'use client'

import Link from 'next/link'
import { formatRelativeDate } from '@/lib/utils/formatters'
import { Amount } from '@/components/shared/amount'
import { Receipt } from 'lucide-react'
import { AssignmentPill, CreditCardPill } from '@/components/shared/assignment-pill'
import type { ExpenseWithCategory } from '@/types'

interface RecentExpensesProps {
  expenses: ExpenseWithCategory[]
}


export function RecentExpenses({ expenses }: RecentExpensesProps) {
  if (expenses.length === 0) {
    return (
      <section>
        <div className="flex items-baseline justify-between pb-2 pr-1">
          <h2 className="px-1 text-[13px] font-medium">Senaste</h2>
        </div>
        <div className="rounded-[24px] bg-surface p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-hb-cognac/10 grid place-items-center mb-3">
            <Receipt className="w-6 h-6 text-hb-cognac" aria-hidden="true" />
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
      <div className="flex items-baseline justify-between pb-2 pr-1">
        <h2 className="px-1 text-[13px] font-medium">Senaste</h2>
        <Link
          href="/analys"
          className="text-xs text-hb-cognac-deep font-medium tracking-wide hover:underline"
        >
          Alla →
        </Link>
      </div>

      <div className="rounded-[24px] bg-surface overflow-hidden">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="flex items-center justify-between px-4 py-3 border-b border-surface-line last:border-b-0"
          >
            <div className="min-w-0 flex-1">
                <div className="font-medium text-sm tracking-tight truncate">
                  {expense.description}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">
                    {expense.category?.name} · {formatRelativeDate(expense.date)}
                  </span>
                  {expense.is_ccm && <CreditCardPill cardId={expense.credit_card_id} />}
                  <AssignmentPill assignment={expense.cost_assignment} />
                </div>
            </div>
            <Amount value={expense.amount} className="text-[14px] ml-3 flex-shrink-0" />
          </div>
        ))}
      </div>
    </section>
  )
}
