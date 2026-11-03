import type { MealSettings, MealStore, Membership } from '@/types/meals'
import type { IsoWeek } from '@/lib/meals/week'

export const MEMBERSHIP_LABELS: Record<Membership, string> = {
  willys_plus: 'Willys Plus',
  ica_stammis: 'ICA Stammis',
  coop_member: 'Coop medlem',
}

export interface MealPromptInput {
  userId: string
  firstName: string | null
  week: IsoWeek
  settings: Omit<MealSettings, 'user_id'>
  stores: MealStore[]
  recentDishes: { recipe_id: string; name: string; year: number; iso_week: number }[]
  leftoversFromLastPlan: string[]
}

/**
 * The text pasted into Claude chat (Homebase project) to start a week's run.
 * Carries everything the run needs, so the chat never reads settings from the
 * database. The keys match public.meal_prompt_context(), which a scheduled run
 * uses instead; the run itself is described in docs/09-veckomat-korning.md.
 */
export function buildMealPrompt({
  userId,
  firstName,
  week,
  settings,
  stores,
  recentDishes,
  leftoversFromLastPlan,
}: MealPromptInput): string {
  const preferred = settings.preferred_store_ids
    .map((id) => stores.find((s) => s.id === id))
    .filter((s): s is MealStore => !!s)
  const onHand = settings.on_hand?.trim() || null

  const data = {
    user_id: userId,
    year: week.year,
    iso_week: week.week,
    household: {
      adults: settings.adults,
      kids: settings.kids,
      portions_per_dinner: settings.portions_per_dinner,
      dinners_per_week: settings.dinners_per_week,
      lunchboxes_per_week: settings.lunchboxes_per_week,
    },
    diet_notes: settings.diet_notes || null,
    avoid: settings.avoid,
    kcal_per_adult_portion:
      settings.kcal_target_min || settings.kcal_target_max
        ? { min: settings.kcal_target_min, max: settings.kcal_target_max }
        : null,
    memberships: settings.memberships.map((m) => MEMBERSHIP_LABELS[m] ?? m),
    pantry_staples: settings.pantry_staples,
    on_hand: onHand ? { text: onHand, updated_at: settings.on_hand_updated_at } : null,
    stores: preferred.map((s) => ({
      store_id: s.id,
      name: s.name,
      chain: s.chain,
      external_id: s.external_id,
      offers_source: s.offers_source,
      offers_url: s.offers_url,
      online_fee: settings.online_fees[s.id] ?? null,
    })),
    recent_dishes: recentDishes.map((d) => ({ recipe_id: d.recipe_id, name: d.name, week: `v${d.iso_week} ${d.year}` })),
    leftovers_from_last_plan: leftoversFromLastPlan,
  }

  return [
    `Kör veckomat för v${week.week} ${week.year}${firstName ? ` åt ${firstName}` : ''}.`,
    '',
    'Läs docs/09-veckomat-korning.md i Homebase-repot och följ den. I korthet:',
    '1. Hämta veckans erbjudanden från butikerna nedan och välj den butik som täcker flest huvudvaror på erbjudande.',
    `2. Ta fram ${settings.dinners_per_week} middagar. Använd det som finns i on_hand först och köp det inte. pantry_staples köps aldrig.`,
    '3. Priser per rad: erbjudande (medlemspris bara för memberships) → butikens ordinarie pris → senaste kvittopris → uppskattning.',
    '4. Undvik förra veckans rätter i recent_dishes. Återanvänd ett recept med dess recipe_id.',
    '5. Spara med public.import_meal_plan(<JSON>, user_id), med leftovers ifyllt, och svara med listans namn och en kort sammanfattning.',
    '',
    'Inställningar:',
    '```json',
    JSON.stringify(data, null, 2),
    '```',
  ].join('\n')
}
