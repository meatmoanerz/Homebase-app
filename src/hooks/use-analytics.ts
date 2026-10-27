'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ExpenseWithCategory } from '@/types'

const PAGE_SIZE = 1000

/**
 * Every expense the household can see, oldest periods included. The Analys
 * page slices this client-side so switching timeframe, person or category is
 * instant. Paginated because PostgREST caps a response at 1000 rows.
 * Lives under ['expenses'] so every expense mutation refreshes it.
 */
export function useAllExpenses() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['expenses', 'analytics', 'all'],
    queryFn: async () => {
      const all: ExpenseWithCategory[] = []
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('expenses')
          .select('*, category:categories(*)')
          .order('date', { ascending: false })
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        all.push(...((data || []) as ExpenseWithCategory[]))
        if (!data || data.length < PAGE_SIZE) break
      }
      return all
    },
    staleTime: 60_000,
  })
}

export interface PeriodIncome {
  total_income: number
  user_income: number
  partner_income: number
}

/** Household income per budget period (one RPC per period, run in parallel). */
export function usePeriodIncomes(periods: string[]) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['monthly-income-total', 'batch', periods],
    queryFn: async () => {
      const entries = await Promise.all(
        periods.map(async (period) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (supabase.rpc as any)('get_household_monthly_income_total', { p_period: period })
            .maybeSingle()
          if (error || !data) return [period, null] as const
          const row = data as PeriodIncome
          return [period, {
            total_income: Number(row.total_income) || 0,
            user_income: Number(row.user_income) || 0,
            partner_income: Number(row.partner_income) || 0,
          }] as const
        })
      )
      return new Map<string, PeriodIncome | null>(entries)
    },
    enabled: periods.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}
