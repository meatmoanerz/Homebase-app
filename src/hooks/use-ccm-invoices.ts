'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface CCMInvoice {
  id: string
  user_id: string
  period: string
  actual_amount: number
  notes: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export function useCCMInvoices() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['ccm-invoices'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('ccm_invoices')
        .select('*')
        .order('period', { ascending: false })

      if (error) throw error
      return data as CCMInvoice[]
    },
  })
}

export function useCCMInvoice(period: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['ccm-invoices', period],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('ccm_invoices')
        .select('*')
        .eq('period', period)
        .maybeSingle()

      if (error) throw error
      return data as CCMInvoice | null
    },
    enabled: !!period,
  })
}

export function useUpsertCCMInvoice() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ period, actual_amount, notes }: { period: string; actual_amount: number; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('ccm_invoices')
        .upsert(
          {
            user_id: user.id,
            period,
            actual_amount,
            notes,
          },
          { onConflict: 'user_id,period' }
        )
        .select()
        .single()

      if (error) throw error
      return data as CCMInvoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ccm-invoices'] })
    },
  })
}

// Mark an invoice period as paid/unpaid.
// Upserts the ccm_invoices row so it works even for periods without a saved invoice amount.
export function useSetCCMPeriodPaid() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ period, paid, actualAmount }: { period: string; paid: boolean; actualAmount?: number }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('ccm_invoices')
        .upsert(
          {
            user_id: user.id,
            period,
            actual_amount: actualAmount ?? 0,
            paid_at: paid ? new Date().toISOString() : null,
          },
          { onConflict: 'user_id,period' }
        )
        .select()
        .single()

      if (error) throw error
      return data as CCMInvoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ccm-invoices'] })
    },
  })
}

export function useDeleteCCMInvoice() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('ccm_invoices')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ccm-invoices'] })
    },
  })
}
