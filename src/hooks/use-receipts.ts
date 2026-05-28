'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

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

export interface ReceiptItem {
  id: string
  receipt_id: string
  product_id: string | null
  raw_name: string
  article_number: string | null
  quantity: number
  unit_price: number | null
  total_price: number
  discount_amount: number
  is_deposit: boolean
  needs_review: boolean
}

export interface ProductSummary {
  product_id: string
  product_name: string
  purchase_count: number
  avg_unit_price: number
  min_unit_price: number
  max_unit_price: number
  last_purchased: string
}

export interface PriceHistoryPoint {
  product_id: string
  product_name: string
  purchase_date: string
  store_chain: string | null
  store_name: string | null
  quantity: number
  unit_price: number | null
  total_price: number
  effective_unit_price: number
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

export function useReceiptItems(receiptId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['receipt-items', receiptId],
    queryFn: async (): Promise<ReceiptItem[]> => {
      if (!receiptId) return []
      const { data, error } = await supabase
        .from('receipt_items')
        .select('*')
        .eq('receipt_id', receiptId)
        .order('total_price', { ascending: false })

      if (error) throw error
      return (data as ReceiptItem[]) || []
    },
    enabled: !!receiptId,
  })
}

export function useProductSummary() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['product-summary'],
    queryFn: async (): Promise<ProductSummary[]> => {
      const { data, error } = await supabase
        .from('v_product_summary')
        .select('*')
        .order('purchase_count', { ascending: false })

      if (error) throw error
      return (data as ProductSummary[]) || []
    },
  })
}

export function usePriceHistory(productId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['price-history', productId],
    queryFn: async (): Promise<PriceHistoryPoint[]> => {
      if (!productId) return []
      const { data, error } = await supabase
        .from('v_price_history')
        .select('*')
        .eq('product_id', productId)
        .order('purchase_date', { ascending: true })

      if (error) throw error
      return (data as PriceHistoryPoint[]) || []
    },
    enabled: !!productId,
  })
}
