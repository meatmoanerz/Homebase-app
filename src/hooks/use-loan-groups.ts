'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { LoanGroup } from '@/types'
import type { InsertTables, UpdateTables } from '@/types/database'

// Default loan group colors
export const LOAN_GROUP_COLORS = [
  '#8B7355', // Homebase olive
  '#A8C5A8', // Homebase sage
  '#E8DED0', // Homebase cream
  '#D4A574', // Gold/tan
  '#7BA3A8', // Teal
  '#9E8B7D', // Taupe
  '#B8860B', // Dark golden rod
  '#708090', // Slate gray
] as const

// Predefined loan groups for bolån and övriga
export const DEFAULT_LOAN_GROUPS = [
  { name: 'Bolån', description: 'Bostadslån och hypotekslån', color: '#8B7355' },
  { name: 'Övriga lån', description: 'Privatlån, konsumtionslån och andra skulder', color: '#A8C5A8' },
] as const

// Fetch all loan groups
export function useLoanGroups() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['loan-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_groups')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      return data as LoanGroup[]
    },
  })
}

// Create a new loan group
export function useCreateLoanGroup() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (group: Omit<InsertTables<'loan_groups'>, 'user_id'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('loan_groups') as any)
        .insert({
          ...group,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data as LoanGroup
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-groups'] })
    },
  })
}

// Update a loan group
export function useUpdateLoanGroup() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'loan_groups'> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('loan_groups') as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as LoanGroup
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-groups'] })
      queryClient.invalidateQueries({ queryKey: ['loans'] })
    },
  })
}

// Delete a loan group
export function useDeleteLoanGroup() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // First, unassign any loans from this group
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase.from('loans') as any)
        .update({ group_id: null })
        .eq('group_id', id)

      if (updateError) throw updateError

      // Then delete the group
      const { error } = await supabase
        .from('loan_groups')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-groups'] })
      queryClient.invalidateQueries({ queryKey: ['loans'] })
    },
  })
}

// Create default loan groups if none exist
export function useEnsureDefaultLoanGroups() {
  const { data: existingGroups, isLoading } = useLoanGroups()
  const createGroup = useCreateLoanGroup()

  const ensureDefaults = async () => {
    if (isLoading || !existingGroups) return

    // Check if defaults already exist
    const hasBolanGroup = existingGroups.some(g =>
      g.name.toLowerCase().includes('bolån') ||
      g.name.toLowerCase().includes('bostadslån')
    )
    const hasOvrigaGroup = existingGroups.some(g =>
      g.name.toLowerCase().includes('övriga') ||
      g.name.toLowerCase().includes('privatlån')
    )

    const promises: Promise<LoanGroup>[] = []

    if (!hasBolanGroup) {
      promises.push(createGroup.mutateAsync({
        name: DEFAULT_LOAN_GROUPS[0].name,
        description: DEFAULT_LOAN_GROUPS[0].description,
        color: DEFAULT_LOAN_GROUPS[0].color,
      }))
    }

    if (!hasOvrigaGroup) {
      promises.push(createGroup.mutateAsync({
        name: DEFAULT_LOAN_GROUPS[1].name,
        description: DEFAULT_LOAN_GROUPS[1].description,
        color: DEFAULT_LOAN_GROUPS[1].color,
      }))
    }

    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }

  return { ensureDefaults, isLoading: isLoading || createGroup.isPending }
}
