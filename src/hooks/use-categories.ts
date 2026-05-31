'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Category, CostType } from '@/types'
import type { InsertTables, UpdateTables } from '@/types/database'

export function useCategories(options?: { costType?: CostType }) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['categories', options?.costType],
    staleTime: 10 * 60 * 1000, // 10 min — categories rarely change during a session
    queryFn: async () => {
      // Fetch categories with their linked savings goal status
      let query = supabase
        .from('categories')
        .select(`
          *,
          linked_savings_goal:savings_goals!linked_savings_goal_id(status)
        `)
        .order('name')

      if (options?.costType) {
        query = query.eq('cost_type', options.costType)
      }

      const { data, error } = await query
      if (error) throw error

      // Filter out categories whose linked savings goal is archived
      // A category should be shown if:
      // 1. It has no linked savings goal (linked_savings_goal_id is null)
      // 2. Its linked savings goal is active (not archived)
      const filteredCategories = (data || []).filter((cat) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const linkedGoal = (cat as any).linked_savings_goal
        // Show category if no linked goal, or if linked goal is active/null status
        if (!linkedGoal) return true
        return linkedGoal.status === 'active' || linkedGoal.status === null
      }).map((cat) => {
        // Remove the linked_savings_goal from the response to match Category type
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { linked_savings_goal, ...category } = cat as Category & { linked_savings_goal?: unknown }
        return category
      })

      return filteredCategories as Category[]
    },
  })
}

export function useCategoriesByType() {
  const { data: categories, ...rest } = useCategories()

  const grouped = categories?.reduce((acc, cat) => {
    if (!acc[cat.cost_type]) acc[cat.cost_type] = []
    acc[cat.cost_type].push(cat)
    return acc
  }, {} as Record<CostType, Category[]>)

  // Sort each group alphabetically by name
  const sortedGroups = {
    Fixed: (grouped?.Fixed || []).sort((a, b) => a.name.localeCompare(b.name, 'sv')),
    Variable: (grouped?.Variable || []).sort((a, b) => a.name.localeCompare(b.name, 'sv')),
    Savings: (grouped?.Savings || []).sort((a, b) => a.name.localeCompare(b.name, 'sv')),
  }

  return {
    ...rest,
    data: categories,
    fixed: sortedGroups.Fixed,
    variable: sortedGroups.Variable,
    savings: sortedGroups.Savings,
  }
}

export function useCreateCategory() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (category: InsertTables<'categories'>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('categories') as any)
        .insert(category)
        .select()
        .single()

      if (error) throw error
      return data as Category
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useUpdateCategory() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'categories'> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('categories') as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Category
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useDeleteCategory() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

