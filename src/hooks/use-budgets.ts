'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Budget, BudgetWithItems, BudgetItemAssignment } from '@/types'
import type { InsertTables, UpdateTables, Tables } from '@/types/database'

export type BudgetListEntry = Budget & {
  budget_items?: {
    id: string
    amount: number
    category_id: string | null
    budget_item_assignments?: BudgetItemAssignment[]
  }[]
}

export function useBudgets() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select(`
          *,
          budget_items(
            id,
            amount,
            category_id,
            budget_item_assignments(*)
          )
        `)
        .order('period', { ascending: false })

      if (error) throw error
      return data as BudgetListEntry[]
    },
  })
}

export function useBudget(id: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['budgets', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select(`
          *,
          budget_items(
            *,
            category:categories(*),
            budget_item_assignments(*)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as BudgetWithItems
    },
    enabled: !!id,
  })
}

export function useBudgetByPeriod(period: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['budgets', 'period', period],
    queryFn: async () => {
      // RLS policies automatically handle access to both own and partner budgets
      // Use maybeSingle() instead of single() to avoid 406 error when no budget exists
      const { data, error } = await supabase
        .from('budgets')
        .select(`
          *,
          budget_items(
            *,
            category:categories(*),
            budget_item_assignments(*)
          )
        `)
        .eq('period', period)
        .maybeSingle()

      if (error) throw error
      return data as BudgetWithItems | null
    },
    enabled: !!period,
  })
}

export function useCurrentBudget(period: string) {
  return useBudgetByPeriod(period)
}

/**
 * Get the previous period's budget based on the current period string (YYYY-MM)
 */
export function usePreviousBudget(currentPeriod: string) {
  const supabase = createClient()

  // Calculate previous period
  const getPreviousPeriod = (period: string): string => {
    const [year, month] = period.split('-').map(Number)
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`
  }

  const previousPeriod = getPreviousPeriod(currentPeriod)

  return useQuery({
    queryKey: ['budgets', 'period', previousPeriod],
    queryFn: async () => {
      // RLS policies automatically handle access to both own and partner budgets
      const { data, error } = await supabase
        .from('budgets')
        .select(`
          *,
          budget_items(
            *,
            category:categories(*),
            budget_item_assignments(*)
          )
        `)
        .eq('period', previousPeriod)
        .maybeSingle()

      if (error) throw error
      return data as BudgetWithItems | null
    },
    enabled: !!currentPeriod,
  })
}

/**
 * Get the next period that doesn't have a budget yet
 */
export function useNextAvailablePeriod(salaryDay: number) {
  const { data: budgets, isLoading } = useBudgets()
  
  // Get the next 12 months of possible periods
  const getNextPeriods = (count: number): string[] => {
    const periods: string[] = []
    const now = new Date()
    
    for (let i = 0; i < count; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const dayOfMonth = now.getDate()
      
      // Adjust based on salary day logic
      let periodMonth: Date
      if (i === 0 && dayOfMonth >= salaryDay) {
        periodMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      } else if (i === 0) {
        periodMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      } else {
        periodMonth = new Date(now.getFullYear(), now.getMonth() + i, 1)
        if (dayOfMonth >= salaryDay) {
          periodMonth = new Date(now.getFullYear(), now.getMonth() + i + 1, 1)
        }
      }
      
      const periodStr = `${periodMonth.getFullYear()}-${String(periodMonth.getMonth() + 1).padStart(2, '0')}`
      if (!periods.includes(periodStr)) {
        periods.push(periodStr)
      }
    }
    
    return periods
  }
  
  const existingPeriods = budgets?.map(b => b.period) || []
  const upcomingPeriods = getNextPeriods(12)
  
  // Find the first period without a budget
  const nextAvailable = upcomingPeriods.find(p => !existingPeriods.includes(p))
  
  return {
    period: nextAvailable || upcomingPeriods[0],
    isLoading,
  }
}

export function useCreateBudget() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (budget: Omit<InsertTables<'budgets'>, 'user_id'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('budgets') as any)
        .insert({
          ...budget,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data as Tables<'budgets'>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
    },
  })
}

export function useUpdateBudget() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'budgets'> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('budgets') as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Tables<'budgets'>
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['budgets', variables.id] })
    },
  })
}

export function useDeleteBudget() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
    },
  })
}

// Budget Items Hooks
export function useCreateBudgetItems() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (items: InsertTables<'budget_items'>[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('budget_items') as any)
        .insert(items)
        .select()

      if (error) throw error
      return data as Tables<'budget_items'>[]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
    },
  })
}

export function useDeleteBudgetItems() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (budgetId: string) => {
      const { error } = await supabase
        .from('budget_items')
        .delete()
        .eq('budget_id', budgetId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
    },
  })
}
