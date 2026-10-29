'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUser, usePartner } from '@/hooks/use-user'
import { useHouseholdMonthlyIncomes } from '@/hooks/use-monthly-incomes'
import {
  computeIncomeSplit,
  resolveHouseholdSettings,
  splitRuleFor,
  type HouseholdModel,
  type HouseholdSettings,
  type HouseholdSettingsRow,
} from '@/lib/household/economy'

/**
 * All household settings rows visible to the household (own + partner via RLS),
 * effective-dated: each save writes the row for its period, history stays intact.
 * Stored in shared_account_defaults (the table started out holding only the
 * shared-account categories).
 */
export function useHouseholdSettingsRows() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['household-settings'],
    queryFn: async (): Promise<HouseholdSettingsRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('shared_account_defaults') as any)
        .select('*')
        .order('effective_from', { ascending: false })

      if (error) throw error
      return (data as HouseholdSettingsRow[]) || []
    },
    staleTime: 60_000,
  })
}

/** Settings in force for a period. */
export function useHouseholdSettings(period: string) {
  const query = useHouseholdSettingsRows()
  const settings = useMemo(
    () => resolveHouseholdSettings(query.data ?? [], period),
    [query.data, period]
  )
  return { ...query, settings }
}

/**
 * Everything needed to split a period's money between the two of you:
 * the settings in force, the income split (share, equalization, buckets) and
 * the default rule for rows nobody split by hand.
 */
export function useHouseholdEconomy(period: string) {
  const { data: user } = useUser()
  const { data: partner } = usePartner()
  const { settings, isLoading: settingsLoading } = useHouseholdSettings(period)
  const { data: incomes = [], isLoading: incomesLoading } = useHouseholdMonthlyIncomes(period)

  const incomeSplit = useMemo(
    () => computeIncomeSplit(incomes, user?.id, partner?.id, settings),
    [incomes, user?.id, partner?.id, settings]
  )
  const splitRule = useMemo(() => splitRuleFor(settings, incomeSplit), [settings, incomeSplit])

  return {
    settings,
    incomes,
    incomeSplit,
    splitRule,
    hasPartner: !!partner,
    isLoading: settingsLoading || incomesLoading,
  }
}

export interface SaveHouseholdSettingsInput {
  period: string
  /** Settings currently in force for the period; unchanged fields are kept */
  current: HouseholdSettings
  model?: HouseholdModel
  categoryIds?: string[]
  incomeCategoryIds?: string[]
  excludedIncomeNames?: string[]
  /** Toast to show on success; false for none */
  successMessage?: string | false
}

/** Saves a full snapshot of the settings, in force from `period` onwards. */
export function useSaveHouseholdSettings() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SaveHouseholdSettingsInput) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const categoryIds = input.categoryIds ?? Array.from(input.current.categoryIds)
      // Income-split categories are always a subset of the shared ones
      const incomeCategoryIds = (input.incomeCategoryIds ?? Array.from(input.current.incomeCategoryIds))
        .filter((id) => categoryIds.includes(id))

      // One row per (user, effective_from): overwrite if saving again in the same period
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('shared_account_defaults') as any)
        .upsert(
          {
            user_id: user.id,
            effective_from: input.period,
            model: input.model ?? input.current.model,
            category_ids: categoryIds,
            income_category_ids: incomeCategoryIds,
            excluded_income_names: input.excludedIncomeNames ?? Array.from(input.current.excludedIncomeNames),
          },
          { onConflict: 'user_id,effective_from' }
        )
      if (error) throw error
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['household-settings'] })
      if (input.successMessage !== false) {
        toast.success(input.successMessage ?? 'Sparat — gäller denna period och framåt')
      }
    },
    onError: () => {
      toast.error('Kunde inte spara')
    },
  })
}

export interface SettlementCheck {
  id: string
  user_id: string
  period: string
  step: string
  created_at: string
}

/** Ticked steps of a period's "Att göra" list, the household's both. */
export function useSettlementChecks(period: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['settlement-checks', period],
    queryFn: async (): Promise<SettlementCheck[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('household_settlement_checks') as any)
        .select('*')
        .eq('period', period)

      if (error) throw error
      return (data as SettlementCheck[]) || []
    },
  })
}

export function useToggleSettlementCheck() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ period, step, done }: { period: string; step: string; done: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (done) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('household_settlement_checks') as any)
          .upsert({ user_id: user.id, period, step }, { onConflict: 'user_id,period,step', ignoreDuplicates: true })
        if (error) throw error
      } else {
        // Whoever ticked it — either partner may untick
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('household_settlement_checks') as any)
          .delete()
          .eq('period', period)
          .eq('step', step)
        if (error) throw error
      }
    },
    onMutate: async ({ period, step, done }) => {
      await queryClient.cancelQueries({ queryKey: ['settlement-checks', period] })
      const previous = queryClient.getQueryData<SettlementCheck[]>(['settlement-checks', period])
      queryClient.setQueryData<SettlementCheck[]>(['settlement-checks', period], (old = []) =>
        done
          ? [...old, { id: `temp-${step}`, user_id: '', period, step, created_at: new Date().toISOString() }]
          : old.filter((c) => c.step !== step)
      )
      return { previous }
    },
    onError: (_error, { period }, context) => {
      queryClient.setQueryData(['settlement-checks', period], context?.previous)
      toast.error('Kunde inte spara')
    },
    onSettled: (_data, _error, { period }) => {
      queryClient.invalidateQueries({ queryKey: ['settlement-checks', period] })
    },
  })
}
