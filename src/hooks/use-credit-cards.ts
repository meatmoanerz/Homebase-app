'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { CreditCard } from '@/lib/utils/credit-cards'
import { getDefaultCard } from '@/lib/utils/credit-cards'

export type { CreditCard } from '@/lib/utils/credit-cards'

export interface CreditCardInput {
  name: string
  issuer: string | null
  invoice_break_date: number
  due_day: number
  is_default: boolean
}

/** Hushållets kreditkort (egna + partnerns, via RLS). */
export function useCreditCards() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['credit-cards'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('credit_cards')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as CreditCard[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useDefaultCreditCard() {
  const { data: cards = [], ...rest } = useCreditCards()
  return { data: getDefaultCard(cards), cards, ...rest }
}

// Endast ett standardkort per hushåll: nolla övriga innan ett nytt sätts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function clearDefaults(supabase: any, exceptId?: string) {
  let query = supabase.from('credit_cards').update({ is_default: false }).eq('is_default', true)
  if (exceptId) query = query.neq('id', exceptId)
  const { error } = await query
  if (error) throw error
}

export function useCreateCreditCard() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreditCardInput) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (supabase as any)
        .from('credit_cards')
        .select('id', { count: 'exact', head: true })
      const isFirst = !count
      const makeDefault = input.is_default || isFirst

      if (makeDefault && !isFirst) await clearDefaults(supabase)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('credit_cards')
        .insert({
          ...input,
          is_default: makeDefault,
          user_id: user.id,
          sort_order: count || 0,
        })
        .select()
        .single()

      if (error) throw error
      return data as CreditCard
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
    },
  })
}

export function useUpdateCreditCard() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CreditCardInput> & { id: string }) => {
      if (updates.is_default) await clearDefaults(supabase, id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('credit_cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as CreditCard
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

export function useDeleteCreditCard() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (supabase as any)
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('credit_card_id', id)
      if (count && count > 0) {
        throw new Error(`Kortet har ${count} transaktioner — flytta dem till ett annat kort först`)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('credit_cards').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
      queryClient.invalidateQueries({ queryKey: ['ccm-invoices'] })
    },
  })
}
