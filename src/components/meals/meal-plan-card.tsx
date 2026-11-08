'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import type { MealPlanSummary } from '@/types/meals'

export function MealPlanCard({ plan, muted = false }: { plan: MealPlanSummary; muted?: boolean }) {
  const total = plan.items.length
  const done = plan.items.filter((i) => i.checked).length
  const facts = [
    plan.store?.name,
    plan.portions_total != null ? `${Number(plan.portions_total).toLocaleString('sv-SE')} portioner` : null,
    plan.kcal_min && plan.kcal_max ? `${plan.kcal_min}–${plan.kcal_max} kcal` : null,
  ].filter(Boolean)

  return (
    <Link
      href={`/meals/${plan.id}`}
      className={cn(
        'block bg-card rounded-3xl p-4 md:p-5 shadow-sm hover:border-hb-cognac/50 transition-colors',
        muted && 'bg-card/60 shadow-none'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-medium">{plan.name}</h3>
            {plan.is_new && !muted && (
              <span className="rounded-full bg-hb-cognac/15 text-hb-cognac-deep px-2 py-0.5 text-[11px] font-semibold">Ny</span>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{facts.join(' · ')}</p>
        </div>
        <div className="text-right shrink-0 flex items-center gap-1">
          <div>
            <div className="font-serif-kpi text-[18px]">{plan.total_cost_est != null ? formatCurrency(Number(plan.total_cost_est)) : '–'}</div>
            {plan.cost_per_portion_est != null && (
              <div className="text-[11px] text-muted-foreground">{formatCurrency(Number(plan.cost_per_portion_est))}/portion</div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
        </div>
      </div>
      {total > 0 && (
        <div className="mt-3">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-hb-cognac transition-all" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {done === total ? 'Allt handlat' : `${done} av ${total} i korgen`}
          </div>
        </div>
      )}
    </Link>
  )
}
