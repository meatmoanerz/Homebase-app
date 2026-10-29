'use client'

import { cn } from '@/lib/utils/cn'
import { HOUSEHOLD_MODEL_LABELS, type HouseholdModel } from '@/lib/household/economy'

const MODEL_ORDER: HouseholdModel[] = ['budget', 'income', 'equal']

const MODEL_DESCRIPTIONS: Record<HouseholdModel, string> = {
  budget: 'Var och en behåller sin inkomst. Kostnaderna delas så som ni fördelat dem i budgeten.',
  income: 'Var och en behåller sin inkomst. Valda kostnader delas i procent efter hur mycket var och en tjänar.',
  equal: 'Ni delar lika på inkomsten. Den som tjänar mer swishar mellanskillnaden. Kostnaderna delas enligt budgeten.',
}

interface HouseholdModelPickerProps {
  value: HouseholdModel
  onChange: (model: HouseholdModel) => void
  /** One concrete example per model, shown as a chip under its description */
  examples: Record<HouseholdModel, string>
  disabled?: boolean
}

/** Three selectable cards, one per household economy model. */
export function HouseholdModelPicker({ value, onChange, examples, disabled }: HouseholdModelPickerProps) {
  return (
    <div role="radiogroup" aria-label="Så delar ni ekonomin" className="space-y-2">
      {MODEL_ORDER.map((model) => {
        const selected = model === value
        return (
          <button
            key={model}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(model)}
            className={cn(
              'w-full flex items-start gap-3 p-3.5 rounded-xl text-left transition-colors disabled:opacity-60',
              selected
                ? 'border-2 border-hb-cognac-deep bg-hb-sand'
                : 'border border-border bg-card hover:bg-muted/40 m-px'
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center',
                selected ? 'border-hb-cognac-deep' : 'border-muted-foreground/60'
              )}
            >
              {selected && <span className="w-2.5 h-2.5 rounded-full bg-hb-cognac-deep" />}
            </span>
            <span className="flex-1 min-w-0 space-y-1">
              <span className="block font-semibold text-[15px]">{HOUSEHOLD_MODEL_LABELS[model]}</span>
              <span className="block text-[13px] leading-snug text-muted-foreground">{MODEL_DESCRIPTIONS[model]}</span>
              {examples[model] && (
                <span className="inline-block mt-1 text-xs font-semibold px-2 py-1 rounded-full bg-muted text-foreground/80">
                  {examples[model]}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Examples for when there is no household data yet (onboarding). */
export const GENERIC_MODEL_EXAMPLES: Record<HouseholdModel, string> = {
  budget: 'Hyran 10 000 kr: 5 000 kr var om ni delar den lika',
  income: 'Lön 30 000 och 20 000 kr: hyran delas 6 000/4 000',
  equal: 'Lön 30 000 och 20 000 kr: 5 000 kr swishas',
}
