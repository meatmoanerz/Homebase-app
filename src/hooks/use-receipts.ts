'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { ProductStat, ReceiptLine } from '@/lib/receipts/receipt-analytics'

export interface Receipt {
  id: string
  store_id: string | null
  expense_id: string | null
  receipt_number: string | null
  purchase_date: string
  total_amount: number
  item_count: number
  created_at: string
  store?: {
    id: string
    name: string
    chain: string | null
  } | null
}

export function useReceipts(limit = 50) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['receipts', limit],
    queryFn: async (): Promise<Receipt[]> => {
      const { data, error } = await supabase
        .from('receipts')
        .select('*, store:stores(id, name, chain)')
        .order('purchase_date', { ascending: false })
        .limit(limit)

      if (error) throw error
      return (data as Receipt[]) || []
    },
  })
}

/**
 * Every receipt line with its product, for the insights on the Kvitton page
 * (small data: tens of receipts, hundreds of lines). Paginated past the
 * 1000-row PostgREST cap just in case.
 */
export function useReceiptLines() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['receipt-items', 'all'],
    queryFn: async (): Promise<ReceiptLine[]> => {
      const all: ReceiptLine[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('receipt_items')
          .select('id, receipt_id, product_id, raw_name, article_number, quantity, unit_price, total_price, discount_amount, is_deposit, package_size, package_unit, product:products(id, name, unit, product_group)')
          .order('id', { ascending: true })
          .range(from, from + 999)
        if (error) throw error
        all.push(...((data || []) as unknown as ReceiptLine[]))
        if (!data || data.length < 1000) break
      }
      return all
    },
    staleTime: 5 * 60 * 1000,
  })
}

/** The receipt lines of a product (or of lines not yet linked to one). */
export interface ProductLines {
  productId: string | null
  name: string
  unit: string | null
  lineIds: string[]
  rawNames: string[]
  articleNumbers: string[]
}

export function productLines(product: ProductStat): ProductLines {
  return {
    productId: product.productId,
    name: product.name,
    unit: product.unit ?? (product.purchases.every((p) => p.weighed) ? 'kg' : 'st'),
    lineIds: product.purchases.map((p) => p.lineId),
    rawNames: product.rawNames,
    articleNumbers: product.articleNumbers,
  }
}

// The generated database types lag the receipt tables; keep these queries locally typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

/**
 * The product for these lines: the linked one, or a new product created from
 * the lines, which are linked to it and get aliases so future receipts with
 * the same text or article number link too.
 */
async function ensureProduct(db: Db, userId: string, input: ProductLines, groupKey: string | null): Promise<string> {
  if (input.productId) return input.productId
  const { data: product, error: createError } = await db
    .from('products')
    .insert({ user_id: userId, name: input.name, unit: input.unit, product_group: groupKey })
    .select('id')
    .single()
  if (createError) throw createError
  await linkLines(db, userId, product.id, input)
  return product.id as string
}

async function linkLines(db: Db, userId: string, productId: string, lines: ProductLines) {
  const { error } = await db.from('receipt_items').update({ product_id: productId }).in('id', lines.lineIds)
  if (error) throw error
  const aliases = [
    ...lines.rawNames.map((raw) => ({ user_id: userId, product_id: productId, raw_name_pattern: raw, article_number: null })),
    ...lines.articleNumbers.map((nr) => ({ user_id: userId, product_id: productId, raw_name_pattern: lines.name, article_number: nr })),
  ]
  if (aliases.length > 0) await db.from('product_aliases').insert(aliases)
}

function invalidateReceipts(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['receipt-items'] })
  queryClient.invalidateQueries({ queryKey: ['receipts'] })
}

/**
 * Save the product group ("varugrupp") for a product. Lines that are not yet
 * linked to a product get one created from them.
 */
export function useSetProductGroup() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ProductLines & { groupKey: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const db = supabase as Db

      if (input.productId) {
        const { error } = await db
          .from('products')
          .update({ product_group: input.groupKey, updated_at: new Date().toISOString() })
          .eq('id', input.productId)
        if (error) throw error
        return input.productId
      }
      return ensureProduct(db, user.id, input, input.groupKey)
    },
    onSuccess: () => {
      invalidateReceipts(queryClient)
      toast.success('Varugrupp sparad')
    },
    onError: () => {
      toast.error('Kunde inte spara varugruppen')
    },
  })
}

/**
 * Same product, other article: move the source's lines (and its aliases) to
 * the target product. An emptied source product is removed.
 */
export function useMergeProducts() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ target, source, groupKey }: { target: ProductLines; source: ProductLines; groupKey: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const db = supabase as Db
      const targetId = await ensureProduct(db, user.id, target, groupKey)

      if (source.productId) {
        const { error } = await db.from('receipt_items').update({ product_id: targetId }).eq('product_id', source.productId)
        if (error) throw error
        await db.from('product_aliases').update({ product_id: targetId }).eq('product_id', source.productId)
        await db.from('products').delete().eq('id', source.productId)
      } else {
        await linkLines(db, user.id, targetId, { ...source, name: target.name })
      }
      return targetId
    },
    onSuccess: () => {
      invalidateReceipts(queryClient)
      toast.success('Varianten kopplad')
    },
    onError: () => {
      toast.error('Kunde inte koppla varianten')
    },
  })
}

/** "Not the same product": take one article out of its product. */
export function useSplitArticle() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { productId: string; lineIds: string[]; articleNumber: string | null; rawNames: string[] }) => {
      const db = supabase as Db
      const { error } = await db.from('receipt_items').update({ product_id: null }).in('id', input.lineIds)
      if (error) throw error
      if (input.articleNumber) {
        await db.from('product_aliases').delete().eq('product_id', input.productId).eq('article_number', input.articleNumber)
      }
      if (input.rawNames.length > 0) {
        await db.from('product_aliases').delete().eq('product_id', input.productId).is('article_number', null).in('raw_name_pattern', input.rawNames)
      }
    },
    onSuccess: () => {
      invalidateReceipts(queryClient)
      toast.success('Artikeln är nu en egen vara')
    },
    onError: () => {
      toast.error('Kunde inte bryta ut artikeln')
    },
  })
}

/** Pack size for an article (all its lines), or null to clear it. */
export function useSetArticleSize() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { lineIds: string[]; size: { size: number; unit: 'kg' | 'l' | 'st' } | null }) => {
      const db = supabase as Db
      const { error } = await db
        .from('receipt_items')
        .update({ package_size: input.size?.size ?? null, package_unit: input.size?.unit ?? null })
        .in('id', input.lineIds)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateReceipts(queryClient)
      toast.success('Förpackningsstorlek sparad')
    },
    onError: () => {
      toast.error('Kunde inte spara storleken')
    },
  })
}
