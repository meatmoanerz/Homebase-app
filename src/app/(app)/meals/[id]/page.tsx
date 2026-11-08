'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Archive, ArchiveRestore, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MealsAccessGate } from '@/components/meals/meals-access-gate'
import { MealsPageSkeleton } from '@/components/meals/meals-skeleton'
import { RecipeSheet } from '@/components/meals/recipe-sheet'
import { ShoppingList } from '@/components/meals/shopping-list'
import {
  useMarkMealPlanSeen,
  useMealPlan,
  useSetMealPlansArchived,
  useShoppingListRealtime,
} from '@/hooks/use-meals'
import { formatCurrency } from '@/lib/utils/formatters'
import type { MealPlan, MealPlanDish } from '@/types/meals'

export default function MealPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <MealsAccessGate>
      <MealPlanView id={id} />
    </MealsAccessGate>
  )
}

function MealPlanView({ id }: { id: string }) {
  const { data: plan, isLoading } = useMealPlan(id)
  const markSeen = useMarkMealPlanSeen()
  const setArchived = useSetMealPlansArchived()
  const [openDishId, setOpenDishId] = useState<string | null>(null)
  useShoppingListRealtime(id)

  const isNew = plan?.is_new
  const { mutate: markSeenMutate } = markSeen
  useEffect(() => {
    if (isNew) markSeenMutate(id)
  }, [isNew, id, markSeenMutate])

  if (isLoading) return <MealsPageSkeleton />

  if (!plan) {
    return (
      <div className="px-4 md:px-8 pt-4 pb-4 max-w-3xl mx-auto text-center">
        <p className="text-sm text-muted-foreground">Listan finns inte längre.</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/meals">Till Veckomat</Link>
        </Button>
      </div>
    )
  }

  const openDish = plan.dishes.find((d) => d.id === openDishId) ?? null
  const archived = plan.status === 'archived'

  return (
    <div className="px-4 md:px-8 pt-2 md:pt-4 pb-4 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/meals">
            <ArrowLeft />
            Veckomat
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setArchived.mutate({ ids: [plan.id], archived: !archived })}
          disabled={setArchived.isPending}
        >
          {archived ? <ArchiveRestore /> : <Archive />}
          {archived ? 'Återställ' : 'Arkivera'}
        </Button>
      </div>

      <Summary plan={plan} />

      <section className="space-y-2">
        <h2 className="text-[13px] font-medium px-1">Middagar</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {plan.dishes.map((dish) => (
            <DishCard key={dish.id} dish={dish} onOpen={() => setOpenDishId(dish.id)} />
          ))}
        </div>
      </section>

      <ShoppingList plan={plan} />

      {plan.leftovers.length > 0 && (
        <p className="text-[13px] text-muted-foreground px-1">
          <span className="font-medium text-foreground">Blir över:</span> {plan.leftovers.join(', ')}. Föreslås under Har hemma
          inför nästa vecka.
        </p>
      )}

      {plan.notes && <p className="text-[13px] text-muted-foreground px-1 leading-relaxed">{plan.notes}</p>}

      <RecipeSheet dish={openDish} onOpenChange={(open) => !open && setOpenDishId(null)} />
    </div>
  )
}

function Summary({ plan }: { plan: MealPlan }) {
  const dinners = plan.dishes.length
  const boxes = plan.dishes.reduce((s, d) => s + Number(d.lunchbox_portions), 0)
  return (
    <section className="bg-card rounded-3xl px-5 py-5 md:px-6 shadow-sm">
      <div className="label-caps text-muted-foreground">
        {[plan.store?.name, `vecka ${plan.iso_week}`].filter(Boolean).join(' · ')}
      </div>
      <h1 className="text-[30px] md:text-[36px] font-semibold leading-[1.1] tracking-tight mt-1 text-balance">
        {dinners} middagar{boxes > 0 ? `, ${boxes} matlådor` : ''}
      </h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <Tile label="hela handlingen" value={plan.total_cost_est != null ? `ca ${formatCurrency(Number(plan.total_cost_est))}` : '–'} />
        <Tile label="per vuxenportion" value={plan.cost_per_portion_est != null ? `ca ${formatCurrency(Number(plan.cost_per_portion_est))}` : '–'} />
        <Tile label="portioner totalt" value={plan.portions_total != null ? Number(plan.portions_total).toLocaleString('sv-SE') : '–'} />
        <Tile label="kcal per vuxenportion" value={plan.kcal_min && plan.kcal_max ? `${plan.kcal_min}–${plan.kcal_max}` : '–'} />
      </div>
    </section>
  )
}

function DishCard({ dish, onOpen }: { dish: MealPlanDish; onOpen: () => void }) {
  const portions = Number(dish.dinner_portions) + Number(dish.lunchbox_portions)
  const perPortion = dish.cost_est != null && portions > 0 ? Math.round(Number(dish.cost_est) / portions) : null
  const boxes = Number(dish.lunchbox_portions)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left bg-card border border-border rounded-3xl p-4 shadow-sm hover:border-hb-cognac/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <h3 className="font-serif text-[16px] font-medium leading-snug">{dish.recipe.name}</h3>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {dish.recipe.kcal_per_portion && <Chip>ca {dish.recipe.kcal_per_portion} kcal</Chip>}
        {perPortion != null && <Chip>ca {perPortion} kr/portion</Chip>}
        {boxes > 0 && <Chip accent>{boxes} matlådor</Chip>}
      </div>
      <span className="block text-[13px] font-medium text-hb-cognac-deep mt-2">Visa recept →</span>
    </button>
  )
}

function Chip({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={
        accent
          ? 'rounded-full bg-hb-cognac/15 text-hb-cognac-deep px-2 py-0.5 text-[12px] font-semibold tabular-nums'
          : 'rounded-full bg-hb-sage/20 px-2 py-0.5 text-[12px] font-medium tabular-nums'
      }
    >
      {children}
    </span>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/50 rounded-2xl px-3 py-2.5">
      <div className="font-serif-kpi text-[15px]">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}
