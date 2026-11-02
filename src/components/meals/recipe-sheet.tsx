'use client'

import { BottomSheet } from '@/components/shared/bottom-sheet'
import { formatCurrency } from '@/lib/utils/formatters'
import type { MealPlanDish } from '@/types/meals'

function portions(dish: MealPlanDish): number {
  return Number(dish.dinner_portions) + Number(dish.lunchbox_portions)
}

function servesText(dish: MealPlanDish): string {
  const total = portions(dish)
  const boxes = Number(dish.lunchbox_portions)
  const dinner = Number(dish.dinner_portions)
  return boxes > 0
    ? `${total} portioner: ${dinner} till middag + ${boxes} matlådor`
    : `${dinner} portioner`
}

export function RecipeSheet({ dish, onOpenChange }: { dish: MealPlanDish | null; onOpenChange: (open: boolean) => void }) {
  const recipe = dish?.recipe
  const total = dish ? portions(dish) : 0
  const perPortion = dish?.cost_est != null && total > 0 ? Number(dish.cost_est) / total : null
  const ingredients = recipe?.ingredients.filter((i) => !i.is_pantry) ?? []
  const pantry = recipe?.ingredients.filter((i) => i.is_pantry) ?? []

  return (
    <BottomSheet
      open={!!dish}
      onOpenChange={onOpenChange}
      title={recipe?.name ?? 'Recept'}
      subtitle={dish ? servesText(dish) : undefined}
    >
      {dish && recipe && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Fact value={recipe.kcal_per_portion ? `ca ${recipe.kcal_per_portion} kcal` : '–'} label="per vuxenportion" />
            <Fact value={perPortion != null ? `ca ${formatCurrency(Math.round(perPortion))}` : '–'} label="per portion" />
            <Fact value={dish.cost_est != null ? `ca ${formatCurrency(Number(dish.cost_est))}` : '–'} label="hela rätten" />
            <Fact value={recipe.time_text || '–'} label="tid" />
          </div>

          <div>
            <h3 className="font-serif text-[17px] font-medium tracking-tight mb-2">Ingredienser</h3>
            <ul className="divide-y divide-dashed divide-border">
              {ingredients.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-1.5 text-[14px]">
                  <span>{i.name}</span>
                  <span className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {i.amount_text || [i.amount, i.unit].filter((v) => v != null).join(' ')}
                  </span>
                </li>
              ))}
            </ul>
            {pantry.length > 0 && (
              <p className="text-[12px] text-muted-foreground mt-2">
                Från skafferiet: {pantry.map((i) => (i.amount_text ? `${i.name} (${i.amount_text})` : i.name)).join(', ')}
              </p>
            )}
          </div>

          {recipe.steps.length > 0 && (
            <div>
              <h3 className="font-serif text-[17px] font-medium tracking-tight mb-2">Gör så här</h3>
              <ol className="list-decimal pl-5 space-y-2 text-[14px] leading-relaxed">
                {recipe.steps.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ol>
            </div>
          )}

          {(recipe.tips.length > 0 || recipe.kids_note || recipe.kcal_per_portion) && (
            <div className="bg-hb-sage/15 rounded-2xl p-4 space-y-1.5 text-[14px]">
              <h3 className="font-serif text-[16px] font-medium tracking-tight">Vid upplägg</h3>
              {recipe.tips.map((t, idx) => (
                <p key={idx}>{t}</p>
              ))}
              {recipe.kids_note && <p>Barnen: {recipe.kids_note}</p>}
              {recipe.kcal_per_portion && (
                <p className="text-muted-foreground">
                  Barnportion: ungefär hälften, ca {Math.round(recipe.kcal_per_portion / 2 / 10) * 10} kcal.
                </p>
              )}
            </div>
          )}

          {recipe.storage_note && (
            <p className="text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">{Number(dish.lunchbox_portions) > 0 ? 'Matlådor' : 'Förvaring'}:</span>{' '}
              {recipe.storage_note}
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-secondary/50 rounded-2xl px-3 py-2.5">
      <div className="font-serif-kpi text-[15px]">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}
