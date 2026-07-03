'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { ExpenseWithCategory } from '@/types'

interface UtlaggData {
  totalAmount: number
  description: string
  category_id: string
  date: string
  userShare: number
  partnerShare: number
  swishRecipient: 'user' | 'partner' | 'shared'
}

interface UpdateUtlaggData extends UtlaggData {
  id: string
}

/**
 * Derive cost_assignment from the shares. A pure utlägg (both shares 0)
 * is stored as 'personal' — the budget amount is 0 so the value only
 * matters for display fallbacks.
 */
export function deriveCostAssignment(
  userShare: number,
  partnerShare: number
): 'personal' | 'shared' | 'partner' {
  if (partnerShare > 0 && userShare > 0) return 'shared'
  if (partnerShare > 0) return 'partner'
  return 'personal'
}

/** Build the expense column payload shared by create/update. */
export function buildUtlaggColumns(data: UtlaggData) {
  const swishAmount = Math.round((data.totalAmount - data.userShare - data.partnerShare) * 100) / 100
  const budgetAmount = Math.round((data.userShare + data.partnerShare) * 100) / 100
  return {
    category_id: data.category_id,
    amount: budgetAmount,
    description: data.description,
    date: data.date,
    cost_assignment: deriveCostAssignment(data.userShare, data.partnerShare),
    is_group_purchase: true,
    group_purchase_total: data.totalAmount,
    group_purchase_user_share: data.userShare,
    group_purchase_partner_share: data.partnerShare,
    group_purchase_swish_amount: swishAmount,
    group_purchase_swish_recipient: data.swishRecipient,
  }
}

export function useCreateUtlagg() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UtlaggData) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: expense, error } = await (supabase.from('expenses') as any)
        .insert({
          user_id: user.id,
          is_ccm: true,
          ...buildUtlaggColumns(data),
        })
        .select(`*, category:categories(*)`)
        .single()

      if (error) throw error
      return expense as ExpenseWithCategory
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      toast.success('Utlägg sparat!')
    },
    onError: (error) => {
      console.error('Failed to create utlägg:', error)
      toast.error('Kunde inte spara utlägget')
    },
  })
}

export function useUpdateUtlagg() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateUtlaggData) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: expense, error } = await (supabase.from('expenses') as any)
        .update(buildUtlaggColumns(data))
        .eq('id', data.id)
        .select(`*, category:categories(*)`)
        .single()

      if (error) throw error
      return expense as ExpenseWithCategory
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      toast.success('Utlägg uppdaterat!')
    },
    onError: (error) => {
      console.error('Failed to update utlägg:', error)
      toast.error('Kunde inte uppdatera utlägget')
    },
  })
}
