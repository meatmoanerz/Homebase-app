'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { ReceiptLine } from '@/lib/receipts/receipt-analytics'

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
          .select('id, receipt_id, product_id, raw_name, article_number, quantity, unit_price, total_price, discount_amount, is_deposit, product:products(id, name, unit, product_group)')
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

/**
 * Save the product group ("varugrupp") for a product. Lines that are not yet
 * linked to a product get one created from them, are linked to it, and get
 * aliases so future receipts with the same text or article number link too.
 */
export function useSetProductGroup() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      productId: string | null
      name: string
      unit: string | null
      groupKey: string
      lineIds: string[]
      rawNames: string[]
      articleNumbers: string[]
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (input.productId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('products') as any)
          .update({ product_group: input.groupKey, updated_at: new Date().toISOString() })
          .eq('id', input.productId)
        if (error) throw error
        return input.productId
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: product, error: createError } = await (supabase.from('products') as any)
        .insert({ user_id: user.id, name: input.name, unit: input.unit, product_group: input.groupKey })
        .select('id')
        .single()
      if (createError) throw createError

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: linkError } = await (supabase.from('receipt_items') as any)
        .update({ product_id: product.id })
        .in('id', input.lineIds)
      if (linkError) throw linkError

      const aliases = [
        ...input.rawNames.map((raw) => ({ user_id: user.id, product_id: product.id, raw_name_pattern: raw, article_number: null })),
        ...input.articleNumbers.map((nr) => ({ user_id: user.id, product_id: product.id, raw_name_pattern: input.name, article_number: nr })),
      ]
      if (aliases.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('product_aliases') as any).insert(aliases)
      }
      return product.id as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt-items'] })
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      toast.success('Varugrupp sparad')
    },
    onError: () => {
      toast.error('Kunde inte spara varugruppen')
    },
  })
}
