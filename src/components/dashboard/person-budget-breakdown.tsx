'use client'

import { ComponentErrorBoundary } from '@/components/error/component-error-boundary'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

interface PersonBudgetBreakdownProps {
  userName: string
  partnerName: string
  userSpent: number
  partnerSpent: number
  userBudget: number
  partnerBudget: number
}

interface PersonRowProps {
  name: string
  spent: number
  budget: number
  variant: 'user' | 'partner'
}

function PersonRow({ name, spent, budget, variant }: PersonRowProps) {
  const remaining = budget - spent
  const percent = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  const isOver = remaining < 0

  const avBgClass = variant === 'user' ? 'bg-hb-tim-soft text-hb-tim' : 'bg-hb-amanda-soft text-hb-amanda'
  const barBgClass = variant === 'user' ? 'bg-hb-tim' : 'bg-hb-amanda'
  const initial = (name?.[0] || '?').toUpperCase()

  return (
    <div className="px-4 py-3.5 border-b border-border last:border-b-0">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-9 h-9 rounded-full grid place-items-center font-serif text-sm font-semibold flex-shrink-0',
            avBgClass
          )}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium text-sm tracking-tight">{name}</span>
            <span
              className={cn(
                'font-serif text-[15px] font-medium tracking-tight',
                budget > 0 && isOver ? 'text-destructive' : 'text-foreground'
              )}
            >
              {budget > 0 ? formatCurrency(remaining) : formatCurrency(spent)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3 mt-0.5">
            <span className="text-[11px] text-muted-foreground">
              {budget > 0 ? `Spenderat ${formatCurrency(spent)}` : 'spenderat'}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {budget > 0 ? 'kvar' : ''}
            </span>
          </div>
          {budget > 0 && (
            <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', isOver ? 'bg-destructive' : barBgClass)}
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PersonBudgetBreakdownContent({
  userName,
  partnerName,
  userSpent,
  partnerSpent,
  userBudget,
  partnerBudget,
}: PersonBudgetBreakdownProps) {
  return (
    <section>
      <div className="flex items-baseline justify-between pb-3">
        <h2 className="font-serif text-[20px] font-medium tracking-tight">Per person</h2>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <PersonRow name={userName} spent={userSpent} budget={userBudget} variant="user" />
        <PersonRow name={partnerName} spent={partnerSpent} budget={partnerBudget} variant="partner" />
      </div>
    </section>
  )
}

export function PersonBudgetBreakdown(props: PersonBudgetBreakdownProps) {
  return (
    <ComponentErrorBoundary componentName="Per person">
      <PersonBudgetBreakdownContent {...props} />
    </ComponentErrorBoundary>
  )
}
