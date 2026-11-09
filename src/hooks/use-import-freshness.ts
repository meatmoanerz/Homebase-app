'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { BankFreshnessRow } from '@/lib/import/freshness'

/**
 * Per person and bank: latest transaction and last upload from a bank file,
 * for the household (RLS shows own and partner's rows). Under ['dashboard'] so
 * it refreshes when expenses are added.
 */
export function useImportFreshness(enabled = true) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['dashboard', 'import-freshness'],
    enabled,
    queryFn: async (): Promise<BankFreshnessRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('import_freshness')
      if (error) throw error
      return (data as BankFreshnessRow[]) || []
    },
    staleTime: 60_000,
  })
}
