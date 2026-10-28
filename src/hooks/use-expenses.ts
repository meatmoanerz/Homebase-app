'use client'

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Expense, ExpenseWithCategory, Category, SavingsGoalContribution } from '@/types'
import type { InsertTables, UpdateTables } from '@/types/database'
import { getBudgetPeriod, getPeriodDates } from '@/lib/utils/budget-period'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { handleMutationError, generateTempId } from '@/lib/utils/error-handler'

/**
 * Extended type for optimistic expenses that includes a flag to identify them
 */
export interface OptimisticExpenseWithCategory extends ExpenseWithCategory {
  _isOptimistic?: boolean
}

interface UseExpensesOptions {
  period?: string
  salaryDay?: number
  limit?: number
  categoryId?: string
}

export function useExpenses(options?: UseExpensesOptions) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['expenses', options],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select(`
          *,
          category:categories(*)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      // Filter by period if provided
      if (options?.period && options?.salaryDay) {
        const { startDate, endDate } = getPeriodDates(options.period, options.salaryDay)
        
        query = query
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'))
      }

      if (options?.categoryId) {
        query = query.eq('category_id', options.categoryId)
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query
      if (error) throw error
      return data as ExpenseWithCategory[]
    },
  })
}

export function useRecentExpenses(limit: number = 5) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['expenses', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          category:categories(*)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data as ExpenseWithCategory[]
    },
  })
}

type ContributionShares = Pick<SavingsGoalContribution, 'savings_goal_id' | 'amount' | 'user1_amount' | 'user2_amount'>

/**
 * The contribution an expense should give its category's savings goal, or null.
 * user1 is the goal owner (who also owns the goal's category), user2 the owner's
 * partner — so a partner's 'personal' expense is credited to user2.
 */
function getDesiredContribution(expense: ExpenseWithCategory): ContributionShares | null {
  const goalId = expense.category?.linked_savings_goal_id
  const amount = Number(expense.amount)
  if (!expense.category || !goalId || !(amount > 0)) return null

  let creatorShare = amount
  let otherShare = 0
  if (expense.cost_assignment === 'shared') {
    creatorShare = amount / 2
    otherShare = amount / 2
  } else if (expense.cost_assignment === 'partner') {
    creatorShare = 0
    otherShare = amount
  }

  const creatorIsOwner = expense.user_id === expense.category.user_id
  return {
    savings_goal_id: goalId,
    amount,
    user1_amount: creatorIsOwner ? creatorShare : otherShare,
    user2_amount: creatorIsOwner ? otherShare : creatorShare,
  }
}

/**
 * Makes the expense's savings goal contribution match its current category,
 * amount and cost assignment. The DB trigger on savings_goal_contributions
 * keeps the goal's balances in step with inserts and deletes.
 * Returns true when anything changed.
 */
async function syncSavingsContribution(
  supabase: ReturnType<typeof createClient>,
  expense: ExpenseWithCategory
): Promise<boolean> {
  const { data: existingData, error: fetchError } = await supabase
    .from('savings_goal_contributions')
    .select('id, savings_goal_id, amount, user1_amount, user2_amount')
    .eq('expense_id', expense.id)
    .maybeSingle()

  if (fetchError) throw fetchError

  const existing = existingData as (ContributionShares & { id: string }) | null
  const desired = getDesiredContribution(expense)

  if (!existing && !desired) return false
  if (
    existing && desired &&
    existing.savings_goal_id === desired.savings_goal_id &&
    Number(existing.amount) === desired.amount &&
    Number(existing.user1_amount) === desired.user1_amount &&
    Number(existing.user2_amount) === desired.user2_amount
  ) {
    return false
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from('savings_goal_contributions')
      .delete()
      .eq('id', existing.id)

    if (deleteError) throw deleteError
  }

  if (desired) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase.from('savings_goal_contributions') as any)
      .insert({ ...desired, expense_id: expense.id, user_id: user.id })

    if (insertError) throw insertError
  }

  return true
}

/** The expense itself is already saved, so a failed sync only warns. */
async function syncSavingsContributionSafely(
  supabase: ReturnType<typeof createClient>,
  queryClient: QueryClient,
  expense: ExpenseWithCategory
) {
  try {
    if (await syncSavingsContribution(supabase, expense)) {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
      queryClient.invalidateQueries({ queryKey: ['savings-goal-contributions'] })
    }
  } catch (error) {
    console.error('Failed to sync savings goal contribution:', error)
    toast.error('Utgiften sparades men kunde inte kopplas till sparmålet')
  }
}

const importBanks = ['SEB', 'Swedbank', 'Amex', 'Norwegian'] as const

/**
 * Latest transaction date per bank among expenses that came from a
 * transaction file — tells from which date the next bank file must be downloaded.
 */
export function useLatestImportedTransactionDates(userId?: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['dashboard', 'latest-csv-transaction-dates', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated')

      const dates: Record<(typeof importBanks)[number], string | null> = {
        SEB: null,
        Swedbank: null,
        Amex: null,
        Norwegian: null,
      }

      await Promise.all(importBanks.map(async (bank) => {
        const { data, error } = await supabase
          .from('expenses')
          .select('date')
          .eq('user_id', userId)
          .eq('bank', bank)
          // Only transaction files (CSV/Excel read in by the app or by Claude):
          // auto-synced rows must not hide a gap in the downloaded bank files.
          .eq('import_source', 'csv')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) throw error
        const latest = data as { date: string } | null
        dates[bank] = latest?.date ?? null
      }))

      return dates
    },
  })
}

export function useExpensesByPeriod(periodOrSalaryDay: string | number, salaryDay?: number) {
  const supabase = createClient()
  
  // Determine if first arg is a period string or salaryDay
  let periodStr: string
  let dates: { startDate: Date; endDate: Date }
  
  if (typeof periodOrSalaryDay === 'string') {
    // Called with period string and salaryDay
    periodStr = periodOrSalaryDay
    dates = getPeriodDates(periodStr, salaryDay || 25)
  } else {
    // Called with just salaryDay (backward compatible)
    const period = getBudgetPeriod(new Date(), periodOrSalaryDay)
    periodStr = period.period
    dates = { startDate: period.startDate, endDate: period.endDate }
  }

  return useQuery({
    queryKey: ['expenses', 'period', periodStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          category:categories(*)
        `)
        .gte('date', format(dates.startDate, 'yyyy-MM-dd'))
        .lte('date', format(dates.endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: false })

      if (error) throw error
      return data as ExpenseWithCategory[]
    },
    enabled: !!periodStr,
  })
}

export function useCreateExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (expense: InsertTables<'expenses'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('expenses') as any)
        .insert({
          ...expense,
          user_id: user.id,
        })
        .select(`
          *,
          category:categories(*)
        `)
        .single()

      if (error) throw error

      const createdExpense = data as ExpenseWithCategory

      // Expenses in a savings goal's category count towards that goal
      if (createdExpense.category?.linked_savings_goal_id) {
        await syncSavingsContributionSafely(supabase, queryClient, createdExpense)
      }

      return createdExpense
    },
    onMutate: async (newExpense) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['expenses'] })

      // Snapshot current data for all expense queries
      const previousExpenses = queryClient.getQueriesData<OptimisticExpenseWithCategory[]>({
        queryKey: ['expenses'],
      })

      // Get the category for the optimistic expense
      const categories = queryClient.getQueryData<Category[]>(['categories'])
      const category = newExpense.category_id ? categories?.find(c => c.id === newExpense.category_id) : null

      // Create optimistic expense with temp ID
      const optimisticExpense: OptimisticExpenseWithCategory = {
        id: generateTempId(),
        user_id: newExpense.user_id || '',
        category_id: newExpense.category_id || null,
        amount: newExpense.amount,
        description: newExpense.description,
        date: newExpense.date || format(new Date(), 'yyyy-MM-dd'),
        cost_assignment: newExpense.cost_assignment || 'shared',
        assigned_to: newExpense.assigned_to || null,
        is_recurring: newExpense.is_recurring || false,
        recurring_expense_id: newExpense.recurring_expense_id || null,
        is_ccm: newExpense.is_ccm || false,
        is_group_purchase: newExpense.is_group_purchase || false,
        group_purchase_total: newExpense.group_purchase_total || null,
        group_purchase_user_share: newExpense.group_purchase_user_share || null,
        group_purchase_partner_share: newExpense.group_purchase_partner_share || null,
        group_purchase_swish_amount: newExpense.group_purchase_swish_amount || null,
        group_purchase_swish_recipient: newExpense.group_purchase_swish_recipient || null,
        temporary_budget_id: newExpense.temporary_budget_id || null,
        temporary_budget_category_id: newExpense.temporary_budget_category_id || null,
        original_currency: newExpense.original_currency || null,
        original_amount: newExpense.original_amount || null,
        bank: newExpense.bank || null,
        is_refund: newExpense.is_refund || false,
        credit_card_id: newExpense.credit_card_id || null,
        import_source: newExpense.import_source ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        category: category || (newExpense.category_id ? {
          id: newExpense.category_id,
          user_id: '',
          name: 'Laddar...',
          cost_type: 'Variable' as const,
          subcategory: 'Other' as const,
          default_value: 0,
          is_default: false,
          is_shared_expense: false,
          shared_with: null,
          linked_savings_goal_id: null,
          excludes_from_expense_total: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } : null),
        _isOptimistic: true,
      }

      // Optimistically update all expense queries
      queryClient.setQueriesData<OptimisticExpenseWithCategory[]>(
        { queryKey: ['expenses'] },
        (old) => {
          if (!old) return [optimisticExpense]
          // Insert at the beginning (most recent first)
          return [optimisticExpense, ...old]
        }
      )

      return { previousExpenses }
    },
    onError: (error, _newExpense, context) => {
      // Rollback to previous data on error
      if (context?.previousExpenses) {
        context.previousExpenses.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      handleMutationError('expense', 'create', error, toast.error)
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'expenses'> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('expenses') as any)
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          category:categories(*)
        `)
        .single()

      if (error) throw error

      const updatedExpense = data as ExpenseWithCategory

      // Category, amount or cost assignment may have changed: move, update or
      // remove the savings goal contribution accordingly
      await syncSavingsContributionSafely(supabase, queryClient, updatedExpense)

      return updatedExpense
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteExpense() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['expenses'] })

      // Snapshot current data for all expense queries
      const previousExpenses = queryClient.getQueriesData<ExpenseWithCategory[]>({
        queryKey: ['expenses'],
      })

      // Optimistically remove the expense from all queries
      queryClient.setQueriesData<ExpenseWithCategory[]>(
        { queryKey: ['expenses'] },
        (old) => {
          if (!old) return []
          return old.filter((expense) => expense.id !== deletedId)
        }
      )

      return { previousExpenses }
    },
    onError: (error, _deletedId, context) => {
      // Rollback to previous data on error
      if (context?.previousExpenses) {
        context.previousExpenses.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      handleMutationError('expense', 'delete', error, toast.error)
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      // Also invalidate savings goals in case the expense was linked to one
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
      queryClient.invalidateQueries({ queryKey: ['savings-goal-contributions'] })
    },
  })
}

/**
 * Get CCM (Credit Card) expenses grouped by invoice period
 * Invoice period is based on the user's ccm_invoice_break_date setting
 */
export function useCCMExpenses(invoiceBreakDate: number = 1) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['expenses', 'ccm', invoiceBreakDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('is_ccm', true)
        .order('date', { ascending: false })

      if (error) throw error
      return data as ExpenseWithCategory[]
    },
  })
}

/**
 * Calculate invoice period for a given expense date
 * If expense date is >= break date, it belongs to next month's invoice
 * If expense date is < break date, it belongs to current month's invoice
 */
export function getInvoicePeriod(expenseDate: string, invoiceBreakDate: number): string {
  const date = new Date(expenseDate)
  const day = date.getDate()
  const month = date.getMonth()
  const year = date.getFullYear()

  // If the expense is on or after the break date, it goes to next month's invoice
  if (day >= invoiceBreakDate) {
    const nextMonth = month + 1
    if (nextMonth > 11) {
      return `${year + 1}-01`
    }
    return `${year}-${String(nextMonth + 1).padStart(2, '0')}`
  }

  // Otherwise, it belongs to this month's invoice
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/**
 * Group CCM expenses by invoice period
 */
export function groupExpensesByInvoicePeriod(
  expenses: ExpenseWithCategory[],
  invoiceBreakDate: number
): Map<string, ExpenseWithCategory[]> {
  const grouped = new Map<string, ExpenseWithCategory[]>()

  expenses.forEach((expense) => {
    const period = getInvoicePeriod(expense.date, invoiceBreakDate)
    const existing = grouped.get(period) || []
    grouped.set(period, [...existing, expense])
  })

  // Sort periods in descending order (newest first)
  const sortedPeriods = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a))
  const sortedMap = new Map<string, ExpenseWithCategory[]>()
  sortedPeriods.forEach((period) => {
    sortedMap.set(period, grouped.get(period)!)
  })

  return sortedMap
}
