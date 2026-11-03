'use client'

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import type {
  MealPlan,
  MealRun,
  MealPlanSummary,
  MealSettings,
  MealStore,
  ShoppingListItem,
} from '@/types/meals'

// The generated database types do not have the meal tables yet; keep these
// queries locally typed (see src/types/meals.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

function db(): Db {
  return createClient() as Db
}

const PLAN_SELECT = `*,
  store:stores(id, name, chain),
  dishes:meal_plan_dishes(*, recipe:recipes(*, ingredients:recipe_ingredients(*))),
  items:shopping_list_items(*)`

/** All meal plans in the household, newest first, with check progress. */
export function useMealPlans() {
  return useQuery({
    queryKey: ['meal-plans'],
    queryFn: async (): Promise<MealPlanSummary[]> => {
      const { data, error } = await db()
        .from('meal_plans')
        .select('id, user_id, name, year, iso_week, status, is_new, total_cost_est, cost_per_portion_est, portions_total, kcal_min, kcal_max, created_at, archived_at, leftovers, store:stores(id, name, chain), items:shopping_list_items(checked)')
        .order('year', { ascending: false })
        .order('iso_week', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as MealPlanSummary[]
    },
  })
}

/** One plan with dishes, recipes and shopping list, sorted for display. */
export function useMealPlan(id: string | undefined) {
  return useQuery({
    queryKey: ['meal-plan', id],
    enabled: !!id,
    queryFn: async (): Promise<MealPlan | null> => {
      const { data, error } = await db().from('meal_plans').select(PLAN_SELECT).eq('id', id).maybeSingle()
      if (error) throw error
      if (!data) return null
      const plan = data as MealPlan
      plan.dishes = [...plan.dishes].sort((a, b) => a.sort - b.sort)
      for (const d of plan.dishes) {
        d.recipe.ingredients = [...(d.recipe.ingredients || [])].sort((a, b) => a.sort - b.sort)
      }
      plan.items = [...plan.items].sort((a, b) => a.sort - b.sort)
      return plan
    },
  })
}

/** Live check-offs: the partner's ticks show up without reloading. */
export function useShoppingListRealtime(planId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!planId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`shopping-list-${planId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_list_items', filter: `meal_plan_id=eq.${planId}` },
        (payload) => {
          const row = payload.new as Partial<ShoppingListItem> | undefined
          if (payload.eventType === 'UPDATE' && row?.id) {
            queryClient.setQueryData<MealPlan | null>(['meal-plan', planId], (plan) =>
              plan ? { ...plan, items: plan.items.map((i) => (i.id === row.id ? { ...i, ...row } : i)) } : plan
            )
          } else {
            queryClient.invalidateQueries({ queryKey: ['meal-plan', planId] })
          }
          queryClient.invalidateQueries({ queryKey: ['meal-plans'] })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [planId, queryClient])
}

export function useToggleShoppingItems(planId: string) {
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async ({ ids, checked }: { ids: string[]; checked: boolean }) => {
      const { error } = await db()
        .from('shopping_list_items')
        .update({
          checked,
          checked_by: checked ? user?.id ?? null : null,
          checked_at: checked ? new Date().toISOString() : null,
        })
        .in('id', ids)
      if (error) throw error
    },
    onMutate: async ({ ids, checked }) => {
      await queryClient.cancelQueries({ queryKey: ['meal-plan', planId] })
      const previous = queryClient.getQueryData<MealPlan | null>(['meal-plan', planId])
      if (previous) {
        const set = new Set(ids)
        queryClient.setQueryData<MealPlan>(['meal-plan', planId], {
          ...previous,
          items: previous.items.map((i) => (set.has(i.id) ? { ...i, checked } : i)),
        })
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['meal-plan', planId], context.previous)
      toast.error('Kunde inte spara avbockningen')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] })
    },
  })
}

export function useSetMealPlansArchived() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ids, archived }: { ids: string[]; archived: boolean }) => {
      const { error } = await db()
        .from('meal_plans')
        .update({ status: archived ? 'archived' : 'visible', archived_at: archived ? new Date().toISOString() : null })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: (_data, { ids, archived }) => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] })
      for (const id of ids) queryClient.invalidateQueries({ queryKey: ['meal-plan', id] })
      toast.success(
        archived
          ? ids.length === 1 ? 'Listan är arkiverad' : `${ids.length} listor är arkiverade`
          : 'Listan är tillbaka'
      )
    },
    onError: () => {
      toast.error('Kunde inte ändra listan')
    },
  })
}

/** Clears the "Ny" label once a plan has been opened. */
export function useMarkMealPlanSeen() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('meal_plans').update({ is_new: false }).eq('id', id).eq('is_new', true)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] })
    },
  })
}

/** Stores the household can plan with: own and the partner's. */
export function useMealStores() {
  return useQuery({
    queryKey: ['meal-stores'],
    queryFn: async (): Promise<MealStore[]> => {
      const { data, error } = await db()
        .from('stores')
        .select('id, user_id, name, chain, location, external_id, offers_source, offers_url')
        .order('name')
      if (error) throw error
      return (data || []) as MealStore[]
    },
  })
}

export function useAddMealStore() {
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async (input: Pick<MealStore, 'name' | 'chain' | 'location' | 'external_id' | 'offers_source' | 'offers_url'>) => {
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await db()
        .from('stores')
        .insert({ ...input, user_id: user.id })
        .select('id, user_id, name, chain, location, external_id, offers_source, offers_url')
        .single()
      if (error) throw error
      return data as MealStore
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-stores'] })
      toast.success('Butiken är tillagd')
    },
    onError: () => {
      toast.error('Kunde inte lägga till butiken')
    },
  })
}

export const DEFAULT_MEAL_SETTINGS: Omit<MealSettings, 'user_id'> = {
  adults: 2,
  kids: 0,
  portions_per_dinner: 2,
  dinners_per_week: 4,
  lunchboxes_per_week: 0,
  diet_notes: null,
  avoid: [],
  kcal_target_min: null,
  kcal_target_max: null,
  memberships: [],
  preferred_store_ids: [],
  online_fees: {},
  run_day: null,
  run_time: null,
  pantry_staples: [],
  on_hand: null,
  on_hand_updated_at: null,
}

/**
 * The signed-in user's settings. Without a row of their own, the partner's
 * are returned (marked inherited) so the household starts from the same plan.
 */
export function useMealSettings() {
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['meal-settings', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<{ settings: MealSettings | null; inherited: boolean }> => {
      const { data, error } = await db().from('meal_settings').select('*')
      if (error) throw error
      const rows = (data || []) as MealSettings[]
      const own = rows.find((r) => r.user_id === user!.id)
      if (own) return { settings: own, inherited: false }
      return { settings: rows[0] ?? null, inherited: rows.length > 0 }
    },
  })
}

export function useSaveMealSettings({ successMessage = 'Inställningarna är sparade' }: { successMessage?: string } = {}) {
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async (settings: Omit<MealSettings, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await db()
        .from('meal_settings')
        .upsert({ ...settings, user_id: user.id }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-settings'] })
      toast.success(successMessage)
    },
    onError: () => {
      toast.error('Kunde inte spara inställningarna')
    },
  })
}

export interface RecentDish {
  recipe_id: string
  name: string
  year: number
  iso_week: number
}

/** Dishes from the latest plans, for the start prompt (avoid repeats, reuse recipes). */
export function useRecentDishes(planCount = 4) {
  return useQuery({
    queryKey: ['meal-recent-dishes', planCount],
    queryFn: async (): Promise<RecentDish[]> => {
      const { data, error } = await db()
        .from('meal_plans')
        .select('year, iso_week, created_at, dishes:meal_plan_dishes(recipe:recipes(id, name))')
        .order('year', { ascending: false })
        .order('iso_week', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(planCount)
      if (error) throw error
      const seen = new Set<string>()
      const out: RecentDish[] = []
      for (const plan of (data || []) as { year: number; iso_week: number; dishes: { recipe: { id: string; name: string } | null }[] }[]) {
        for (const d of plan.dishes) {
          if (!d.recipe || seen.has(d.recipe.id)) continue
          seen.add(d.recipe.id)
          out.push({ recipe_id: d.recipe.id, name: d.recipe.name, year: plan.year, iso_week: plan.iso_week })
        }
      }
      return out
    },
  })
}

// A run still "running" after this was cut off; matches /api/meals/run.
const RUN_STALE_AFTER_MS = 6 * 60 * 1000

export function isRunActive(run: MealRun | null | undefined): boolean {
  return !!run && run.status === 'running' && Date.now() - new Date(run.created_at).getTime() < RUN_STALE_AFTER_MS
}

/** The household's latest app run; polls while it is running. */
export function useLatestMealRun() {
  return useQuery({
    queryKey: ['meal-run-latest'],
    queryFn: async (): Promise<MealRun | null> => {
      const { data, error } = await db()
        .from('meal_runs')
        .select('id, user_id, status, year, iso_week, meal_plan_id, error, sources, created_at, finished_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return (data as MealRun | null) ?? null
    },
    refetchInterval: (query) => (isRunActive(query.state.data) ? 4000 : false),
  })
}

/** Starts a run in the app (Claude API via /api/meals/run). */
export function useStartMealRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/meals/run', { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; runId?: string }
      if (!res.ok || !body.ok) throw new Error(body.error || 'Kunde inte starta körningen')
      return body.runId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-run-latest'] })
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Kunde inte starta körningen')
    },
  })
}
