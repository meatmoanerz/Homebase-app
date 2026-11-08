'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { useToggleShoppingItems } from '@/hooks/use-meals'
import { groupBySection } from '@/lib/shopping/sections'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import type { MealPlan, PriceSource, ShoppingListItem } from '@/types/meals'

/** "89,90 kr", "40 kr": öre only when the price has them. */
function formatKr(amount: number): string {
  const hasOre = Math.round(amount * 100) % 100 !== 0
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: hasOre ? 2 : 0,
    maximumFractionDigits: hasOre ? 2 : 0,
  }).format(amount)
}

const PRICE_SOURCE_LABEL: Record<PriceSource, string> = {
  offer: 'Erbjudande',
  store_ordinary: 'Ordinarie pris',
  receipt: 'Senaste kvitto',
  estimate: 'Uppskattat',
}

/** Shopping list per store section, checked off together in real time. */
export function ShoppingList({ plan }: { plan: MealPlan }) {
  const toggle = useToggleShoppingItems(plan.id)

  const dishNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of plan.dishes) map.set(d.id, d.recipe.name.split(' med ')[0])
    return map
  }, [plan.dishes])

  // In store order; rows added on the shopping page join their section.
  const sections = useMemo(() => groupBySection<ShoppingListItem>(plan.items), [plan.items])

  const total = plan.items.reduce((s, i) => s + Number(i.price_est || 0), 0)
  const done = plan.items.filter((i) => i.checked).length
  const checkedIds = plan.items.filter((i) => i.checked).map((i) => i.id)

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
        <h2 className="text-[13px] font-medium">Inköpslista</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/shopping?plan=${plan.id}`}>
              <Plus />
              Lägg till
            </Link>
          </Button>
          <span className="rounded-full bg-hb-sage/20 px-2.5 py-1 text-[12px] font-medium tabular-nums">
            {done} av {plan.items.length} i korgen
          </span>
          {checkedIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggle.mutate({ ids: checkedIds, checked: false })}
              disabled={toggle.isPending}
            >
              Avmarkera alla
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-3xl shadow-sm overflow-hidden">
        {sections.map(([section, items], idx) => (
          <div key={section} className={cn('py-1', idx > 0 && 'border-t border-border')}>
            <h3 className="label-caps text-muted-foreground px-4 pt-3 pb-1">{section}</h3>
            <ul>
              {items.map((item) => {
                const id = `item-${item.id}`
                const uses = item.dish_ids.map((d) => dishNames.get(d)).filter(Boolean)
                // Added by hand on the shopping page: no price or dish to show.
                const added = item.price_est == null && item.dish_ids.length === 0
                return (
                  <li key={item.id}>
                    <label htmlFor={id} className="flex items-start gap-3 px-4 py-2 cursor-pointer hover:bg-secondary/40">
                      <Checkbox
                        id={id}
                        checked={item.checked}
                        onCheckedChange={(value) => toggle.mutate({ ids: [item.id], checked: value === true })}
                        className="h-5 w-5 mt-0.5"
                      />
                      <span className="flex-1 min-w-0">
                        <span className={cn('block text-[14px] font-medium', item.checked && 'line-through text-muted-foreground')}>
                          {item.name}
                        </span>
                        <span className="block text-[12px] text-muted-foreground">
                          {[item.qty_text || [item.quantity, item.unit].filter((v) => v != null).join(' '), uses.join(', ')]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      {!added && (
                      <span className="text-right shrink-0">
                        <span className="block text-[14px] tabular-nums">{item.price_est != null ? formatKr(Number(item.price_est)) : '–'}</span>
                        <span
                          className={cn(
                            'block text-[10px] font-semibold',
                            item.is_offer ? 'text-hb-cognac-deep' : 'text-muted-foreground font-normal'
                          )}
                        >
                          {item.is_offer && item.offer_label ? item.offer_label : PRICE_SOURCE_LABEL[item.price_source]}
                        </span>
                      </span>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        <div className="flex justify-between px-4 py-3 border-t-2 border-foreground font-medium tabular-nums">
          <span>Summa, ungefär</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {plan.pantry.length > 0 && (
        <p className="text-[13px] text-muted-foreground px-1">
          <span className="font-medium text-foreground">Har ni hemma?</span> {plan.pantry.join(', ')}. Ingår inte i summan.
        </p>
      )}
    </section>
  )
}
