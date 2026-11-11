'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Income } from '@/types'
import type { InsertTables, UpdateTables } from '@/types/database'

export function useIncomes() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['incomes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incomes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Income[]
    },
  })
}

export function useTotalIncome() {
  const { data: incomes } = useIncomes()
  return incomes?.reduce((sum, income) => sum + income.amount, 0) ?? 0
}

export function useCreateIncome() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (income: InsertTables<'incomes'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('incomes') as any)
        .insert({
          ...income,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data as Income
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] })
    },
  })
}

export function useUpdateIncome() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'incomes'> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('incomes') as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Income
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] })
    },
  })
}

export function useDeleteIncome() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('incomes')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] })
      queryClient.invalidateQueries({ queryKey: ['household-income'] })
    },
  })
}

// Get combined household income (user + partner) for budget calculations
export function useHouseholdIncome() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['household-income'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_household_income')
        .single()

      if (error) {
        console.error('Error fetching household income:', error)
        // Fallback to just user's income
        const { data: incomes } = await supabase
          .from('incomes')
          .select('amount')

        const total = (incomes as { amount: number }[] | null)?.reduce((sum, i) => sum + i.amount, 0) ?? 0
        return { total_income: total, user_income: total, partner_income: 0 }
      }
      
      return data as { total_income: number; user_income: number; partner_income: number }
    },
  })
}

// Get detailed income records for both user and partner
export function useHouseholdIncomeDetails() {
  return useQuery({
    queryKey: ['household-income-details'],
    queryFn: async () => {
      const response = await fetch('/api/household-incomes', { cache: 'no-store' })
      const data = await response.json()
      
      if (data.error) {
        console.error('Error fetching household incomes:', data.error)
        return { userIncomes: [], partnerIncomes: [], userId: null, partnerId: null, partnerName: null }
      }
      
      return data as {
        userIncomes: Income[]
        partnerIncomes: Income[]
        userId: string | null
        partnerId: string | null
        partnerName: string | null
      }
    },
  })
}

