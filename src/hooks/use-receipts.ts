'use client'

import { useQuery } from '@tanstack/react-query'
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
          .select('id, receipt_id, product_id, raw_name, quantity, unit_price, total_price, discount_amount, is_deposit, product:products(id, name, unit)')
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
