// Veckomat (modul 'meals'). Speglar tabellerna i
// supabase/migrations/20261102120000_meals_module.sql — de genererade
// databastyperna har inte de här tabellerna än.

export type PriceSource = 'offer' | 'store_ordinary' | 'receipt' | 'estimate'
export type MealPlanStatus = 'visible' | 'archived'
export type Membership = 'willys_plus' | 'ica_stammis' | 'coop_member'

export interface MealStore {
  id: string
  user_id: string
  name: string
  chain: string | null
  location: string | null
  external_id: string | null
  offers_source: string | null
  offers_url: string | null
}

export interface MealSettings {
  user_id: string
  adults: number
  kids: number
  portions_per_dinner: number
  dinners_per_week: number
  lunchboxes_per_week: number
  diet_notes: string | null
  avoid: string[]
  kcal_target_min: number | null
  kcal_target_max: number | null
  memberships: Membership[]
  preferred_store_ids: string[]
  online_fees: Record<string, number>
  run_day: number | null
  run_time: string | null
  /** Always at home, never bought (oil, spices, rice ...). */
  pantry_staples: string[]
  /** At home this week, to be used first. */
  on_hand: string | null
  on_hand_updated_at: string | null
}

export interface RecipeIngredient {
  id: string
  sort: number
  name: string
  amount: number | null
  unit: string | null
  amount_text: string | null
  is_pantry: boolean
}

export interface Recipe {
  id: string
  name: string
  description: string | null
  base_portions: number
  kcal_per_portion: number | null
  time_text: string | null
  steps: string[]
  tips: string[]
  storage_note: string | null
  kids_note: string | null
  tags: string[]
  ingredients: RecipeIngredient[]
}

export interface MealPlanDish {
  id: string
  sort: number
  batch_multiplier: number
  dinner_portions: number
  lunchbox_portions: number
  cost_est: number | null
  planned_date: string | null
  cooked_at: string | null
  recipe: Recipe
}

export interface ShoppingListItem {
  id: string
  /** Set for a Veckomat list; null for an own list (shopping_list_id). */
  meal_plan_id: string | null
  shopping_list_id: string | null
  section: string
  sort: number
  name: string
  quantity: number | null
  unit: string | null
  qty_text: string | null
  price_est: number | null
  price_source: PriceSource
  is_offer: boolean
  offer_label: string | null
  dish_ids: string[]
  checked: boolean
  checked_by: string | null
  checked_at: string | null
}

export interface MealPlanSummary {
  id: string
  user_id: string
  name: string
  year: number
  iso_week: number
  status: MealPlanStatus
  is_new: boolean
  total_cost_est: number | null
  cost_per_portion_est: number | null
  portions_total: number | null
  kcal_min: number | null
  kcal_max: number | null
  created_at: string
  archived_at: string | null
  /** What the plan expects to be left over; suggested as "on hand" next week. */
  leftovers: string[]
  store: { id: string; name: string; chain: string | null } | null
  items: { checked: boolean }[]
}

export interface MealPlan extends Omit<MealPlanSummary, 'items'> {
  notes: string | null
  pantry: string[]
  source: 'chat' | 'schedule' | 'app'
  dishes: MealPlanDish[]
  items: ShoppingListItem[]
}

export interface MealRun {
  id: string
  user_id: string
  status: 'running' | 'done' | 'failed'
  year: number
  iso_week: number
  meal_plan_id: string | null
  error: string | null
  sources: { store: string; source: string | null; offers: number; error: string | null }[]
  created_at: string
  finished_at: string | null
}
