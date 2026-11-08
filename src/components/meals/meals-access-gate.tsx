'use client'

import { UtensilsCrossed } from 'lucide-react'
import { useFeatureAccess } from '@/hooks/use-feature-access'
import { MealsPageSkeleton } from '@/components/meals/meals-skeleton'

/** Veckomat is in beta: users without access see a short note instead. */
export function MealsAccessGate({ children }: { children: React.ReactNode }) {
  const { data: hasAccess, isLoading } = useFeatureAccess('meals')

  if (isLoading || hasAccess === undefined) return <MealsPageSkeleton />

  if (!hasAccess) {
    return (
      <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 max-w-3xl mx-auto">
        <div className="bg-card rounded-3xl p-8 md:p-12 text-center shadow-sm mt-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-hb-cognac/10 grid place-items-center mb-5">
            <UtensilsCrossed className="w-7 h-7 text-hb-cognac" />
          </div>
          <h2 className="font-serif text-xl font-medium mb-2">Veckomat är inte öppet än</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Funktionen testas just nu och öppnar för fler snart.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
