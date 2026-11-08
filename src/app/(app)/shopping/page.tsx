'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ShoppingDraft } from '@/components/shopping/shopping-draft'
import { ShoppingListCard } from '@/components/shopping/shopping-list-card'
import { ShoppingPageSkeleton } from '@/components/shopping/shopping-skeleton'
import { useMealPlans } from '@/hooks/use-meals'
import { useModules } from '@/hooks/use-modules'
import { useShoppingLists } from '@/hooks/use-shopping'
import { useUser } from '@/hooks/use-user'
import { cn } from '@/lib/utils/cn'

function createdLabel(iso: string): string {
  return `Skapad ${new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(new Date(iso)).replace('.', '')}`
}

export default function ShoppingPage() {
  const { data: user, isLoading: userLoading } = useUser()
  const { data: lists = [], isLoading: listsLoading } = useShoppingLists()
  const { data: plans = [] } = useMealPlans()
  const { isEnabled } = useModules()
  const [showArchive, setShowArchive] = useState(false)

  const openLists = useMemo(() => lists.filter((l) => !l.archived_at), [lists])
  const archived = useMemo(() => lists.filter((l) => l.archived_at), [lists])
  const mealPlans = useMemo(
    () => (isEnabled('meals') ? plans.filter((p) => p.status === 'visible') : []),
    [plans, isEnabled]
  )

  if (userLoading || !user || listsLoading) return <ShoppingPageSkeleton />

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-4 max-w-3xl mx-auto">
      <div className="hidden md:block">
        <h1 className="font-serif text-[32px] font-medium tracking-tight">Inköpslista</h1>
        <p className="text-sm text-muted-foreground mt-1">Skriv in det ni ska handla och lägg det i en lista</p>
      </div>

      <ShoppingDraft userId={user.id} />

      {(openLists.length > 0 || mealPlans.length > 0) && (
        <section className="space-y-2">
          <h2 className="font-serif text-[19px] font-medium tracking-tight px-1">Listor</h2>
          <div className="space-y-2">
            {openLists.map((list) => (
              <ShoppingListCard
                key={list.id}
                href={`/shopping/${list.id}`}
                name={list.name}
                subtitle={createdLabel(list.created_at)}
                items={list.items}
              />
            ))}
            {mealPlans.map((plan) => (
              <ShoppingListCard
                key={plan.id}
                href={`/meals/${plan.id}`}
                name={plan.name}
                subtitle={['Veckomat', plan.store?.name].filter(Boolean).join(' · ')}
                items={plan.items}
              />
            ))}
          </div>
        </section>
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
              {archived.map((list) => (
                <ShoppingListCard
                  key={list.id}
                  href={`/shopping/${list.id}`}
                  name={list.name}
                  subtitle={createdLabel(list.created_at)}
                  items={list.items}
                  muted
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
