'use client'

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { nameKey, sectionForProductGroup, type SectionHints } from '@/lib/shopping/sections'
import type { ShoppingListItem } from '@/types/meals'
import type { DraftItem, SaveTarget, ShoppingListDetail, ShoppingListSummary } from '@/types/shopping'

// The generated database types do not have the shopping tables yet; keep these
// queries locally typed (see src/types/shopping.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

function db(): Db {
  return createClient() as Db
}

// ---------------------------------------------------------------- own lists

/** The household's own lists (not Veckomat), newest first, with check progress. */
export function useShoppingLists() {
  return useQuery({
    queryKey: ['shopping-lists'],
    queryFn: async (): Promise<ShoppingListSummary[]> => {
      const { data, error } = await db()
        .from('shopping_lists')
        .select('id, user_id, name, created_at, archived_at, items:shopping_list_items(checked)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as ShoppingListSummary[]
    },
  })
}

export function useShoppingList(id: string | undefined) {
  return useQuery({
    queryKey: ['shopping-list', id],
    enabled: !!id,
    queryFn: async (): Promise<ShoppingListDetail | null> => {
      const { data, error } = await db()
        .from('shopping_lists')
        .select('id, user_id, name, created_at, archived_at, items:shopping_list_items(*)')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const list = data as ShoppingListDetail
      list.items = [...list.items].sort((a, b) => a.sort - b.sort)
      return list
    },
  })
}

/** Live check-offs on an own list: the partner's ticks show up without reloading. */
export function useShoppingListItemsRealtime(listId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!listId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`own-shopping-list-${listId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_list_items', filter: `shopping_list_id=eq.${listId}` },
        (payload) => {
          const row = payload.new as Partial<ShoppingListItem> | undefined
          if (payload.eventType === 'UPDATE' && row?.id) {
            queryClient.setQueryData<ShoppingListDetail | null>(['shopping-list', listId], (list) =>
              list ? { ...list, items: list.items.map((i) => (i.id === row.id ? { ...i, ...row } : i)) } : list
            )
          } else {
            queryClient.invalidateQueries({ queryKey: ['shopping-list', listId] })
          }
          queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [listId, queryClient])
}

export function useToggleListItems(listId: string) {
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
      await queryClient.cancelQueries({ queryKey: ['shopping-list', listId] })
      const previous = queryClient.getQueryData<ShoppingListDetail | null>(['shopping-list', listId])
      if (previous) {
        const set = new Set(ids)
        queryClient.setQueryData<ShoppingListDetail>(['shopping-list', listId], {
          ...previous,
          items: previous.items.map((i) => (set.has(i.id) ? { ...i, checked } : i)),
        })
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['shopping-list', listId], context.previous)
      toast.error('Kunde inte spara avbockningen')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
    },
  })
}

export function useDeleteListItems(listId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await db().from('shopping_list_items').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list', listId] })
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
    },
    onError: () => {
      toast.error('Kunde inte ta bort varan')
    },
  })
}

export function useSetShoppingListArchived() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await db()
        .from('shopping_lists')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, { id, archived }) => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
      queryClient.invalidateQueries({ queryKey: ['shopping-list', id] })
      toast.success(archived ? 'Listan är arkiverad' : 'Listan är tillbaka')
    },
    onError: () => {
      toast.error('Kunde inte ändra listan')
    },
  })
}

export function useDeleteShoppingList() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('shopping_lists').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
      queryClient.removeQueries({ queryKey: ['shopping-list', id] })
      toast.success('Listan är borttagen')
    },
    onError: () => {
      toast.error('Kunde inte ta bort listan')
    },
  })
}

// ---------------------------------------------------------------- draft

export interface DraftRow {
  items: DraftItem[]
  updated_at: string
}

function isDraftItem(value: unknown): value is DraftItem {
  const v = value as DraftItem
  return !!v && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.section === 'string'
}

/** Keeps only well-formed rows: the column is plain jsonb. */
export function cleanDraftItems(value: unknown): DraftItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(isDraftItem).map((i) => ({
    id: i.id,
    name: i.name,
    qty_text: typeof i.qty_text === 'string' ? i.qty_text : null,
    section: i.section,
    manual: i.manual === true,
  }))
}

/** The signed-in user's draft on the account (shopping_list_drafts). */
export function useShoppingDraft() {
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['shopping-draft', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<DraftRow | null> => {
      const { data, error } = await db()
        .from('shopping_list_drafts')
        .select('items, updated_at')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return { items: cleanDraftItems(data.items), updated_at: data.updated_at as string }
    },
    // The draft is edited here; refetching on focus would only race the saves.
    refetchOnWindowFocus: false,
  })
}

/** Writes the draft to the account. Called debounced from the page. */
export async function saveShoppingDraft(userId: string, items: DraftItem[], updatedAt: string): Promise<void> {
  const { error } = await db()
    .from('shopping_list_drafts')
    .upsert({ user_id: userId, items, updated_at: updatedAt }, { onConflict: 'user_id' })
  if (error) throw error
}

// ---------------------------------------------------------------- section hints

export interface ShoppingHints {
  sections: SectionHints
  /** Names bought or listed before, for autocomplete. */
  names: string[]
}

/**
 * What the household has used before, by item name: sections picked on this
 * page win, then earlier lists (Veckomat included), then the product group
 * saved from receipts.
 */
export function useShoppingHints() {
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['shopping-section-hints', user?.id],
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<ShoppingHints> => {
      const [learned, items, products] = await Promise.all([
        db().from('shopping_item_sections').select('user_id, name_key, section, updated_at').order('updated_at', { ascending: true }),
        db().from('shopping_list_items').select('name, section').limit(5000),
        db().from('products').select('name, product_group').not('product_group', 'is', null).limit(5000),
      ])
      if (learned.error) throw learned.error
      if (items.error) throw items.error
      if (products.error) throw products.error

      const sections: SectionHints = new Map()
      const names = new Map<string, string>()

      for (const p of (products.data || []) as { name: string; product_group: string | null }[]) {
        const section = sectionForProductGroup(p.product_group)
        const key = nameKey(p.name)
        if (!key) continue
        if (section) sections.set(key, section)
        names.set(key, p.name)
      }

      // Most used section per name in earlier lists.
      const counts = new Map<string, Map<string, number>>()
      for (const i of (items.data || []) as { name: string; section: string }[]) {
        const key = nameKey(i.name)
        if (!key) continue
        const perSection = counts.get(key) ?? new Map<string, number>()
        perSection.set(i.section, (perSection.get(i.section) ?? 0) + 1)
        counts.set(key, perSection)
        if (!names.has(key)) names.set(key, i.name)
      }
      for (const [key, perSection] of counts) {
        const [best] = [...perSection.entries()].sort((a, b) => b[1] - a[1])[0]
        sections.set(key, best)
      }

      // Own choices last so they win; oldest first so the newest wins.
      const rows = (learned.data || []) as { user_id: string; name_key: string; section: string }[]
      for (const r of rows.filter((r) => r.user_id !== user!.id)) sections.set(r.name_key, r.section)
      for (const r of rows.filter((r) => r.user_id === user!.id)) sections.set(r.name_key, r.section)

      return {
        sections,
        names: [...names.values()].sort((a, b) => a.localeCompare(b, 'sv')),
      }
    },
  })
}

// ---------------------------------------------------------------- save draft

/** Unchecked item names already in a target list, for the duplicate check. */
export function useTargetItemKeys(target: SaveTarget | null) {
  const column = target?.kind === 'meal_plan' ? 'meal_plan_id' : 'shopping_list_id'
  const id = target && target.kind !== 'new' ? target.id : null

  return useQuery({
    queryKey: ['shopping-target-items', column, id],
    enabled: !!id,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await db()
        .from('shopping_list_items')
        .select('name')
        .eq(column, id)
        .eq('checked', false)
      if (error) throw error
      return new Set(((data || []) as { name: string }[]).map((r) => nameKey(r.name)))
    },
  })
}

export function useSaveDraftToList() {
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async ({ target, items }: { target: SaveTarget; items: DraftItem[] }) => {
      if (!user) throw new Error('Not authenticated')

      let column: 'meal_plan_id' | 'shopping_list_id'
      let targetId: string
      if (target.kind === 'new') {
        const { data, error } = await db()
          .from('shopping_lists')
          .insert({ user_id: user.id, name: target.name.trim() })
          .select('id')
          .single()
        if (error) throw error
        column = 'shopping_list_id'
        targetId = data.id as string
      } else {
        column = target.kind === 'meal_plan' ? 'meal_plan_id' : 'shopping_list_id'
        targetId = target.id
      }

      let nextSort = 0
      if (target.kind !== 'new') {
        const { data, error } = await db()
          .from('shopping_list_items')
          .select('sort')
          .eq(column, targetId)
          .order('sort', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) throw error
        nextSort = data ? Number(data.sort) + 1 : 0
      }

      if (items.length > 0) {
        const { error } = await db()
          .from('shopping_list_items')
          .insert(
            items.map((item, i) => ({
              user_id: user.id,
              [column]: targetId,
              section: item.section,
              sort: nextSort + i,
              name: item.name,
              qty_text: item.qty_text,
              price_source: 'estimate',
            }))
          )
        if (error) throw error
      }

      // Remember sections picked by hand. A failure here must not undo the save.
      const learned = new Map<string, string>()
      for (const item of items) if (item.manual) learned.set(nameKey(item.name), item.section)
      if (learned.size > 0) {
        const now = new Date().toISOString()
        await db()
          .from('shopping_item_sections')
          .upsert(
            [...learned].map(([name_key, section]) => ({ user_id: user.id, name_key, section, updated_at: now })),
            { onConflict: 'user_id,name_key' }
          )
      }

      return { kind: column === 'meal_plan_id' ? ('meal_plan' as const) : ('list' as const), id: targetId }
    },
    onSuccess: (result) => {
      if (result.kind === 'meal_plan') {
        queryClient.invalidateQueries({ queryKey: ['meal-plan', result.id] })
        queryClient.invalidateQueries({ queryKey: ['meal-plans'] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['shopping-list', result.id] })
      }
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] })
      queryClient.invalidateQueries({ queryKey: ['shopping-target-items'] })
      queryClient.invalidateQueries({ queryKey: ['shopping-section-hints'] })
    },
    onError: () => {
      toast.error('Kunde inte spara till listan')
    },
  })
}
