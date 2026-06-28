'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface SharedAccountDefault {
  id: string
  user_id: string
  effective_from: string // budget period 'YYYY-MM'
  category_ids: string[]
  created_at: string
}

/**
 * All shared-account default rows visible to the household (own + partner via RLS).
 * Defaults are effective-dated: each "save as default" writes a new row whose
 * effective_from is the period it was saved in. History stays intact; the active
 * default for any period is the most recent row with effective_from <= that period.
 */
export function useSharedAccountDefaults() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['shared-account-defaults'],
    queryFn: async (): Promise<SharedAccountDefault[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('shared_account_defaults') as any)
        .select('*')
        .order('effective_from', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as SharedAccountDefault[]) || []
    },
    staleTime: 60_000,
  })
}

/**
 * Resolve which category ids are the active default for a given period.
 * Picks the most recent default (effective_from <= period); empty if none yet.
 */
export function resolveDefaultForPeriod(
  defaults: SharedAccountDefault[],
  period: string
): { categoryIds: Set<string>; effectiveFrom: string | null } {
  // defaults already sorted by effective_from desc, created_at desc
  const active = defaults.find((d) => d.effective_from <= period)
  return {
    categoryIds: new Set(active?.category_ids ?? []),
    effectiveFrom: active?.effective_from ?? null,
  }
}

export function useSaveSharedAccountDefault() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ period, categoryIds }: { period: string; categoryIds: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // One row per (user, effective_from): overwrite if saving again in the same period
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('shared_account_defaults') as any)
        .upsert(
          { user_id: user.id, effective_from: period, category_ids: categoryIds },
          { onConflict: 'user_id,effective_from' }
        )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-account-defaults'] })
      toast.success('Standard sparad — gäller denna period och framåt')
    },
    onError: () => {
      toast.error('Kunde inte spara standard')
    },
  })
}
