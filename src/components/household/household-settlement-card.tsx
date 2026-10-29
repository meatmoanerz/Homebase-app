'use client'

import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import { formatCurrency } from '@/lib/utils/formatters'

export interface SettlementStep {
  id: string
  title: string
  subtitle: string
  amount: number
  done: boolean
}

interface HouseholdSettlementCardProps {
  monthLabel: string
  steps: SettlementStep[]
  onToggle: (step: SettlementStep) => void
  /** Amount to copy for Swish, when there is an equalization to pay */
  swishAmount?: number
}

/** "Att göra i november": the period's transfers, ticked off by either of you. */
export function HouseholdSettlementCard({ monthLabel, steps, onToggle, swishAmount }: HouseholdSettlementCardProps) {
  const doneCount = steps.filter((s) => s.done).length
  const allDone = steps.length > 0 && doneCount === steps.length

  const copySwishAmount = async () => {
    if (!swishAmount) return
    try {
      await navigator.clipboard.writeText(String(swishAmount))
      toast.success(`${formatCurrency(swishAmount)} kopierat — klistra in i Swish`)
    } catch {
      toast.error('Kunde inte kopiera')
    }
  }

  return (
    <section className="rounded-2xl bg-hb-nav text-hb-nav-foreground p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-hb-nav-foreground/75">Att göra i {monthLabel}</span>
        <span
          className={cn(
            'text-xs font-semibold px-2.5 py-1 rounded-full',
            allDone ? 'bg-hb-sage' : 'bg-hb-nav-foreground'
          )}
          style={{ color: '#2a2420' }}
        >
          {allDone ? 'Avräknat' : `${doneCount} av ${steps.length} klart`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-hb-nav-foreground/20 overflow-hidden" aria-hidden="true">
        <div
          className="h-full rounded-full bg-hb-sage transition-[width] duration-300"
          style={{ width: `${steps.length ? Math.round((doneCount / steps.length) * 100) : 0}%` }}
        />
      </div>

      <ul className="space-y-0.5">
        {steps.map((step) => (
          <li key={step.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={step.done}
              onClick={() => onToggle(step)}
              className="w-full flex items-center gap-3 min-h-13 text-left"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'w-6 h-6 shrink-0 rounded-[7px] border-2 flex items-center justify-center transition-colors',
                  step.done ? 'bg-hb-sage border-hb-sage' : 'border-hb-nav-foreground/55'
                )}
              >
                {step.done && <Check className="w-3.5 h-3.5 text-hb-nav" strokeWidth={3} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className={cn('block font-semibold', step.done && 'line-through opacity-60')}>{step.title}</span>
                <span className="block text-xs text-hb-nav-foreground/70">{step.subtitle}</span>
              </span>
              <span className={cn('font-bold text-base tabular-nums', step.done && 'opacity-60')}>
                {formatCurrency(step.amount)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {swishAmount ? (
        <button
          type="button"
          onClick={copySwishAmount}
          className="w-full h-11 rounded-xl bg-hb-nav-foreground text-hb-nav font-semibold flex items-center justify-center gap-2"
        >
          <Copy className="w-4 h-4" />
          Kopiera {formatCurrency(swishAmount)} till Swish
        </button>
      ) : null}
    </section>
  )
}
