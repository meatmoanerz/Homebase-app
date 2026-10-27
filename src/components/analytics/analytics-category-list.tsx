'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'
import { formatChange } from '@/lib/analytics/format'
import { relativeChange, type CategoryGroup, type CategoryTotal } from '@/lib/analytics/analytics'
import { cn } from '@/lib/utils/cn'

const TABS: Array<{ value: CategoryGroup; label: string }> = [
  { value: 'Variable', label: 'Rörliga' },
  { value: 'Fixed', label: 'Fasta' },
  { value: 'Savings', label: 'Sparande' },
  { value: 'all', label: 'Alla' },
]

const COLLAPSED_COUNT = 6

interface AnalyticsCategoryListProps {
  categories: CategoryTotal[]
  comparisonLabel: string
  onSelect: (categoryId: string) => void
}

/**
 * Category ranking. The credit-card invoice line is never part of this list
 * (its purchases already sit in their own categories), so the top spot is
 * a real spending category.
 */
export function AnalyticsCategoryList({ categories, comparisonLabel, onSelect }: AnalyticsCategoryListProps) {
  const [tab, setTab] = useState<CategoryGroup>('Variable')
  const [expanded, setExpanded] = useState(false)

  const visible = categories.filter((c) => c.total > 0 && (tab === 'all' || c.costType === tab))
  const groupTotal = visible.reduce((s, c) => s + c.total, 0)
  const max = visible[0]?.total ?? 0
  const shown = expanded ? visible : visible.slice(0, COLLAPSED_COUNT)

  return (
    <section className="bg-card border border-border rounded-3xl p-4 md:p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-[19px] font-medium tracking-tight">Kategorier</h2>
        <span className="text-xs text-muted-foreground">{formatCurrency(groupTotal)}</span>
      </div>

      <div className="flex gap-1 bg-secondary rounded-full p-1 mt-3">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => {
              setTab(t.value)
              setExpanded(false)
            }}
            className={cn(
              'flex-1 py-1.5 rounded-full text-xs font-medium transition-all',
              tab === t.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Inga utgifter här under perioden.</p>
      ) : (
        <ul className="mt-3 -mx-1">
          {shown.map((c) => {
            const change = comparisonLabel ? relativeChange(c.total, c.previous) : null
            const share = groupTotal > 0 ? (c.total / groupTotal) * 100 : 0
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="w-full text-left px-1 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors group"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-medium truncate">{c.name}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="font-serif text-[15px] font-medium">{formatCurrency(c.total)}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-muted-foreground" />
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-chart-spend"
                      style={{ width: `${max > 0 ? Math.max(2, (c.total / max) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                    <span>
                      {Math.round(share)} % · {c.count} köp
                    </span>
                    {change != null && (
                      <span className={cn(change > 0.05 && 'text-destructive', change < -0.05 && 'text-hb-green')}>
                        {formatChange(change)} vs {comparisonLabel}
                      </span>
                    )}
                    {change == null && comparisonLabel && c.previous === 0 && <span>ny</span>}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {visible.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full mt-1 py-2 text-xs font-medium text-hb-cognac-deep"
        >
          {expanded ? 'Visa färre' : `Visa alla ${visible.length}`}
        </button>
      )}
    </section>
  )
}
