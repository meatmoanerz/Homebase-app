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
}

/**
 * The text pasted into Claude chat (Homebase project) to start a week's run.
 * Carries everything the run needs, so the chat never reads settings from the
 * database; the run itself is described in docs/08-veckomat.md.
 */
export function buildMealPrompt({ userId, firstName, week, settings, stores, recentDishes }: MealPromptInput): string {
  const preferred = settings.preferred_store_ids
    .map((id) => stores.find((s) => s.id === id))
    .filter((s): s is MealStore => !!s)

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
  }

  return [
    `Kör veckomat för v${week.week} ${week.year}${firstName ? ` åt ${firstName}` : ''}.`,
    '',
    'Följ docs/08-veckomat.md i Homebase-repot. I korthet:',
    '1. Hämta veckans erbjudanden från butikerna nedan (offers_url / offers_source). Filtrera på giltighet för veckan.',
    '2. Välj den butik som täcker flest huvudvaror på erbjudande och säg vilken och varför.',
    `3. Ta fram ${settings.dinners_per_week} middagar för hushållet nedan. Matlådorna kommer från rätter som lagas i dubbel sats.`,
    '4. Priser per rad i ordningen: erbjudande (medlemspris bara för medlemskapen nedan) → butikens ordinarie pris → senaste kvittopris (public.latest_receipt_price(namn, user_id)) → uppskattning. Ange price_source per rad.',
    '5. Undvik rätterna i recent_dishes från förra veckan. Återanvänd ett recept genom att ange dess recipe_id.',
    '6. Spara med SELECT public.import_meal_plan(<MealPlan-JSON>::jsonb, user_id) enligt JSON-kontraktet i 08-veckomat.md avsnitt 5.4, och svara med listans namn och en kort sammanfattning.',
    '',
    'Inställningar:',
    '```json',
    JSON.stringify(data, null, 2),
    '```',
  ].join('\n')
}
