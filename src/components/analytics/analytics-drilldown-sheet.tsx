'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { BottomSheet } from '@/components/shared/bottom-sheet'
import { ExpenseEditDialog } from '@/components/expenses/expense-edit-dialog'
import { AssignmentPill } from '@/components/shared/assignment-pill'
import { AnalyticsTrendChart, type TrendPoint } from '@/components/analytics/analytics-trend-chart'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { formatChange, formatPeriodShort } from '@/lib/analytics/format'
import { relativeChange, type AnalyticsRow } from '@/lib/analytics/analytics'
import { getBudgetStatus, budgetStatusBarClass } from '@/lib/utils/budget-status'
import { cn } from '@/lib/utils/cn'
import type { ExpenseWithCategory } from '@/types'

export interface DrilldownData {
  title: string
  subtitle: string
  rows: AnalyticsRow[]
  trend: TrendPoint[]
  periodCount: number
  previousTotal: number | null
  comparisonLabel: string
  budget: number | null
  /** Spend within the periods that have a budget (what the budget is compared with). */
  budgetSpent: number
  /** True when amounts are one person's share (shared rows count 50 %). */
  isShare: boolean
}

interface AnalyticsDrilldownSheetProps {
  data: DrilldownData | null
  onOpenChange: (open: boolean) => void
  onSelectPeriod?: (period: string) => void
}

export function AnalyticsDrilldownSheet({ data, onOpenChange, onSelectPeriod }: AnalyticsDrilldownSheetProps) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'date' | 'amount'>('date')
  const [editExpense, setEditExpense] = useState<ExpenseWithCategory | null>(null)
  const [title, setTitle] = useState<string | null>(null)

  // Reset search when a different drilldown opens.
  if ((data?.title ?? null) !== title) {
    setTitle(data?.title ?? null)
    setQuery('')
    setSort('date')
  }

  const stats = useMemo(() => {
    if (!data) return null
    const total = data.rows.reduce((s, r) => s + r.value, 0)
    return {
      total,
      count: data.rows.length,
      perPeriod: data.periodCount > 0 ? total / data.periodCount : total,
      change: data.previousTotal != null ? relativeChange(total, data.previousTotal) : null,
    }
  }, [data])

  const groups = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    const visible = data.rows.filter(
      (r) => !q || r.expense.description.toLowerCase().includes(q) || r.expense.category?.name.toLowerCase().includes(q)
    )
    if (sort === 'amount') {
      return [{ period: null as string | null, rows: [...visible].sort((a, b) => b.value - a.value), total: 0 }]
    }
    const map = new Map<string, AnalyticsRow[]>()
    for (const r of visible) {
      const list = map.get(r.period) || []
      list.push(r)
      map.set(r.period, list)
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([period, rows]) => ({
        period: period as string | null,
        rows: rows.sort((a, b) => b.expense.date.localeCompare(a.expense.date)),
        total: rows.reduce((s, r) => s + r.value, 0),
      }))
  }, [data, query, sort])

  const status = data?.budget ? getBudgetStatus(data.budgetSpent, data.budget) : null

  return (
    <>
      <BottomSheet
        open={!!data}
        onOpenChange={onOpenChange}
        title={data?.title}
        subtitle={data?.subtitle}
      >
        {data && stats && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label={data.isShare ? 'Din andel totalt' : 'Totalt'} value={formatCurrency(stats.total)} strong />
              <MiniStat
                label={data.comparisonLabel ? `vs ${data.comparisonLabel}` : 'Antal köp'}
                value={data.comparisonLabel ? formatChange(stats.change) : String(stats.count)}
                tone={stats.change == null ? undefined : stats.change > 0 ? 'up' : 'down'}
              />
              <MiniStat label="Antal köp" value={String(stats.count)} />
              <MiniStat
                label={data.periodCount > 1 ? 'Snitt per månad' : 'Snitt per köp'}
                value={formatCurrency(data.periodCount > 1 ? stats.perPeriod : stats.count ? stats.total / stats.count : 0)}
              />
            </div>

            {data.budget != null && data.budget > 0 && status && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Budget {formatCurrency(data.budget)}</span>
                  <span>{Math.round((data.budgetSpent / data.budget) * 100)} % använt</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', budgetStatusBarClass(status))}
                    style={{ width: `${Math.min(100, (data.budgetSpent / data.budget) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div>
              <div className="label-caps text-muted-foreground mb-2">Utveckling</div>
              <AnalyticsTrendChart data={data.trend} height={150} onSelectPeriod={onSelectPeriod} />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="label-caps text-muted-foreground">Transaktioner</div>
                <div className="flex gap-0.5 bg-secondary rounded-full p-0.5 text-[11px]">
                  {(['date', 'amount'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSort(s)}
                      className={cn(
                        'px-2.5 py-1 rounded-full transition-colors',
                        sort === s ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'
                      )}
                    >
                      {s === 'date' ? 'Datum' : 'Belopp'}
                    </button>
                  ))}
                </div>
              </div>
              {data.rows.length > 6 && (
                <div className="flex items-center gap-2.5 bg-secondary/60 rounded-xl px-3 py-2 mb-2">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Sök transaktion…"
                    className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                  />
                </div>
              )}
              <div className="space-y-3">
                {groups.map((g) => (
                  <div key={g.period ?? 'all'}>
                    {g.period && (
                      <div className="flex justify-between text-[11px] text-muted-foreground px-1 mb-1">
                        <span className="capitalize">{formatPeriodShort(g.period, true)}</span>
                        <span>{formatCurrency(g.total)}</span>
                      </div>
                    )}
                    <div className="bg-secondary/30 rounded-2xl divide-y divide-border/60 overflow-hidden">
                      {g.rows.map((r) => (
                        <button
                          key={r.expense.id}
                          type="button"
                          onClick={() => setEditExpense(r.expense)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/60 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium truncate">{r.expense.description}</div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                              <span>{formatDate(r.expense.date, 'short')}</span>
                              {r.expense.category && <span className="truncate">· {r.expense.category.name}</span>}
                              <AssignmentPill assignment={r.expense.cost_assignment} />
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-serif text-[14px] font-medium">{formatCurrency(r.value)}</div>
                            {r.value !== r.expense.amount && (
                              <div className="text-[10px] text-muted-foreground">av {formatCurrency(r.expense.amount)}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {groups.every((g) => g.rows.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-6">Inga transaktioner.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
      <ExpenseEditDialog
        expense={editExpense}
        open={!!editExpense}
        onOpenChange={(open) => !open && setEditExpense(null)}
      />
    </>
  )
}

function MiniStat({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'up' | 'down' }) {
  return (
    <div className="bg-secondary/40 rounded-2xl px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground truncate">{label}</div>
      <div
        className={cn(
          'font-serif-kpi mt-0.5',
          strong ? 'text-[20px]' : 'text-[16px]',
          tone === 'up' && 'text-destructive',
          tone === 'down' && 'text-hb-green'
        )}
      >
        {value}
      </div>
    </div>
  )
}
