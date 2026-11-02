'use client'

import { useMemo, useState } from 'react'
import { Archive, ChevronDown, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MealsAccessGate } from '@/components/meals/meals-access-gate'
import { MealPlanCard } from '@/components/meals/meal-plan-card'
import { MealPromptCard } from '@/components/meals/meal-prompt-card'
import { MealsPageSkeleton } from '@/components/meals/meals-skeleton'
import { useMealPlans, useSetMealPlansArchived } from '@/hooks/use-meals'
import { compareWeeks, isoWeekOf, planningWeek } from '@/lib/meals/week'
import { cn } from '@/lib/utils/cn'

// "Inte nu" on the archive question is a per-device convenience: it hides the
// banner until a newer list arrives.
const DISMISS_KEY = 'meals-archive-dismissed-for'

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY)
  } catch {
    return null
  }
}

export default function MealsPage() {
  return (
    <MealsAccessGate>
      <MealsOverview />
    </MealsAccessGate>
  )
}

function MealsOverview() {
  const { data: plans = [], isLoading } = useMealPlans()
  const setArchived = useSetMealPlansArchived()
  const [showArchive, setShowArchive] = useState(false)
  const [dismissedFor, setDismissedFor] = useState<string | null>(readDismissed)
  // "Today" captured once per visit so render stays pure.
  const [today] = useState(() => new Date())

  const visible = useMemo(() => plans.filter((p) => p.status === 'visible'), [plans])
  const archived = useMemo(() => plans.filter((p) => p.status === 'archived'), [plans])
  const newestId = visible[0]?.id ?? null

  // Visible lists from weeks that have passed.
  const thisWeek = useMemo(() => isoWeekOf(today), [today])
  const stale = useMemo(
    () => visible.filter((p) => compareWeeks({ year: p.year, week: p.iso_week }, thisWeek) < 0),
    [visible, thisWeek]
  )
  const showArchiveQuestion = stale.length > 0 && dismissedFor !== newestId

  function dismiss() {
    setDismissedFor(newestId)
    try {
      if (newestId) localStorage.setItem(DISMISS_KEY, newestId)
    } catch {
      // Private mode: the banner simply comes back next visit.
    }
  }

  if (isLoading) return <MealsPageSkeleton />

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-4 max-w-3xl mx-auto">
      <div className="hidden md:block">
        <h1 className="font-serif text-[32px] font-medium tracking-tight">Veckomat</h1>
        <p className="text-sm text-muted-foreground mt-1">Veckans middagar, recept och inköpslista utifrån erbjudandena</p>
      </div>

      <MealPromptCard week={planningWeek(today)} />

      {showArchiveQuestion && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-hb-cognac/30 bg-hb-cognac/8 px-4 py-3">
          <p className="text-[14px]">
            {stale.length === 1 ? '1 äldre lista' : `${stale.length} äldre listor`} ({stale.map((p) => p.name).join(', ')}). Arkivera?
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Inte nu
            </Button>
            <Button
              size="sm"
              onClick={() => setArchived.mutate({ ids: stale.map((p) => p.id), archived: true })}
              disabled={setArchived.isPending}
            >
              <Archive />
              Arkivera
            </Button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-card border border-border rounded-3xl p-8 md:p-12 text-center shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-hb-cognac/10 grid place-items-center mb-5">
            <UtensilsCrossed className="w-7 h-7 text-hb-cognac" />
          </div>
          <h2 className="font-serif text-xl font-medium mb-2">Ingen matsedel just nu</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Kopiera startprompten ovan och klistra in den i Claude-chatten i Homebase-projektet. Matsedeln dyker upp här
            när den är klar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((plan) => (
            <MealPlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            aria-expanded={showArchive}
            className="flex w-full items-center justify-between px-1 py-2 text-[14px] font-medium text-muted-foreground hover:text-foreground"
          >
            <span>Arkiv ({archived.length})</span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', showArchive && 'rotate-180')} />
          </button>
          {showArchive && (
            <div className="space-y-2 mt-1">
              {archived.map((plan) => (
                <MealPlanCard key={plan.id} plan={plan} muted />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
