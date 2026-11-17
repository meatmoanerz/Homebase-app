'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SavingsGoal, SavingsGoalWithCategory, SavingsGoalContributionWithExpense } from '@/types'
import type { UpdateTables } from '@/types/database'

/**
 * Total saved on a goal. starting_balance is the running total (initial_balance,
 * "Redan sparat", plus every contribution — kept by DB trigger);
 * starting_balance_user1/2 only split the contributions per person.
 */
export function getSavedAmount(goal: Pick<SavingsGoal, 'starting_balance'>): number {
  return Number(goal.starting_balance) || 0
}

/** Date a contribution counts from: the expense's date, or a manual entry's own date. */
export function getContributionDate(contribution: SavingsGoalContributionWithExpense): string {
  return contribution.expense?.date || contribution.date || contribution.created_at
}

export function useSavingsGoals() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['savings-goals'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Use explicit foreign key hint to resolve ambiguous relationship
      // savings_goals has category_id -> categories.id
      // categories has linked_savings_goal_id -> savings_goals.id
      // RLS returns own goals and the partner's; the partner's show only when shared.
      const { data, error } = await (supabase
        .from('savings_goals')
        .select(`
          *,
          category:categories!category_id(*)
        `)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .order('created_at', { ascending: false }) as any)

      if (error) {
        console.error('Error fetching savings goals:', error)
        throw error
      }

      // Filter out archived goals — keep active, completed, and null status
      // (completed goals are shown in the "Uppnådda" tab)
      const goals = (data || []).filter((goal: SavingsGoalWithCategory) => {
        return goal.status !== 'archived' && (goal.user_id === user.id || goal.is_shared)
      }) as SavingsGoalWithCategory[]

      return goals
    },
  })
}

export function useSavingsGoal(id: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['savings-goals', id],
    queryFn: async () => {
      if (!id) return null

      // Use explicit foreign key hint to resolve ambiguous relationship
      const { data, error } = await (supabase
        .from('savings_goals')
        .select(`
          *,
          category:categories!category_id(*),
          custom_goal_type:custom_goal_types(*)
        `)
        .eq('id', id)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .single() as any)

      if (error) throw error
      return data as SavingsGoalWithCategory
    },
    enabled: !!id,
  })
}

export function useSavingsGoalContributions(goalId: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['savings-goal-contributions', goalId],
    queryFn: async () => {
      if (!goalId) return []

      const { data, error } = await supabase
        .from('savings_goal_contributions')
        .select(`
          *,
          expense:expenses(*)
        `)
        .eq('savings_goal_id', goalId)

      if (error) throw error
      const contributions = data as SavingsGoalContributionWithExpense[]
      // Newest first by the date the money moved, not when the row was written
      return contributions.sort((a, b) =>
        getContributionDate(b).localeCompare(getContributionDate(a)) || b.created_at.localeCompare(a.created_at)
      )
    },
    enabled: !!goalId,
  })
}

interface CreateSavingsGoalInput {
  name: string
  description?: string
  target_amount?: number
  target_date?: string
  initial_balance?: number
  goal_category?: 'emergency' | 'vacation' | 'home' | 'car' | 'education' | 'retirement' | 'other'
  custom_goal_type_id?: string | null
  is_shared?: boolean
}

export function useCreateSavingsGoal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (goal: CreateSavingsGoalInput) => {
      // Category, goal and the link between them in one transaction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('create_savings_goal', {
        p_name: goal.name,
        p_description: goal.description || null,
        p_target_amount: goal.target_amount || null,
        p_target_date: goal.target_date || null,
        p_initial_balance: goal.initial_balance || 0,
        p_goal_category: goal.goal_category || 'other',
        p_custom_goal_type_id: goal.custom_goal_type_id || null,
        p_is_shared: goal.is_shared || false,
      })

      if (error) {
        console.error('Failed to create savings goal:', error)
        throw new Error(`Kunde inte skapa sparmål: ${error.message}`)
      }

      return data as SavingsGoal
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export function useUpdateSavingsGoal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'savings_goals'> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('savings_goals') as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as SavingsGoal
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
    },
  })
}

interface CreateWithdrawalInput {
  goal: Pick<SavingsGoal, 'id' | 'user_id' | 'is_shared'>
  amount: number
  date: string
  note?: string
  /** Who the money is taken from. user1 = the goal owner, user2 = the owner's partner. */
  from: 'both' | 'user1' | 'user2'
}

/** A withdrawal ("uttag") is a manual, negative contribution without an expense. */
export function useCreateSavingsWithdrawal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ goal, amount, date, note, from }: CreateWithdrawalInput) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const total = -Math.abs(amount)
      const user1 = from === 'both' ? Math.round(total / 2 * 100) / 100 : from === 'user1' ? total : 0
      const user2 = total - user1

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('savings_goal_contributions') as any).insert({
        savings_goal_id: goal.id,
        user_id: user.id,
        amount: total,
        user1_amount: goal.is_shared ? user1 : total,
        user2_amount: goal.is_shared ? user2 : 0,
        date,
        note: note || null,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
      queryClient.invalidateQueries({ queryKey: ['savings-goal-contributions'] })
    },
  })
}

/** Removes a manual entry. Expense-linked contributions follow their expense instead. */
export function useDeleteSavingsContribution() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('savings_goal_contributions')
        .delete()
        .eq('id', id)
        .is('expense_id', null)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
      queryClient.invalidateQueries({ queryKey: ['savings-goal-contributions'] })
    },
  })
}

export function useDeleteSavingsGoal() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // Archive the savings goal
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: archiveError } = await (supabase.from('savings_goals') as any)
        .update({ status: 'archived', archived_at: new Date().toISOString() })
        .eq('id', id)

      if (archiveError) throw archiveError

      // Note: The linked category will automatically be hidden because
      // useCategories filters out categories linked to archived savings goals
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

/** A withdrawal that pays (part of) an expense ("Betala med sparande"). */
export interface ExpenseFunding {
  id: string
  savings_goal_id: string
  goal_name: string
  goal_owner_id: string
  /** Positive: what is paid from the goal */
  amount: number
  user1_amount: number
  user2_amount: number
  /** When the money moves to the paying account */
  date: string
}

interface FundingRow {
  id: string
  savings_goal_id: string
  amount: number
  user1_amount: number
  user2_amount: number
  date: string
  goal: { name: string; user_id: string } | null
}

function toFunding(row: FundingRow): ExpenseFunding {
  return {
    id: row.id,
    savings_goal_id: row.savings_goal_id,
    goal_name: row.goal?.name ?? 'Sparmål',
    goal_owner_id: row.goal?.user_id ?? '',
    amount: -Number(row.amount),
    user1_amount: -Number(row.user1_amount),
    user2_amount: -Number(row.user2_amount),
    date: row.date,
  }
}

const FUNDING_SELECT = 'id, savings_goal_id, amount, user1_amount, user2_amount, date, goal:savings_goals(name, user_id)'

/** Savings withdrawals that pay one expense. */
export function useExpenseFunding(expenseId: string | null | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['savings-funding', 'expense', expenseId],
    enabled: !!expenseId,
    queryFn: async (): Promise<ExpenseFunding[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('savings_goal_contributions') as any)
        .select(FUNDING_SELECT)
        .eq('funded_expense_id', expenseId)
      if (error) throw error
      return ((data || []) as FundingRow[]).map(toFunding)
    },
  })
}

/**
 * Money moved from savings to pay for something, by the date it moves
 * (in a period: cash in). Empty if the database does not have the column yet.
 */
export function useSavingsFundingInRange(startDate: string, endDate: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['savings-funding', 'range', startDate, endDate],
    queryFn: async (): Promise<ExpenseFunding[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('savings_goal_contributions') as any)
        .select(FUNDING_SELECT)
        .not('funded_expense_id', 'is', null)
        .gte('date', startDate)
        .lte('date', endDate)
      if (error) {
        console.error('Kunde inte hämta uttag från sparande:', error)
        return []
      }
      return ((data || []) as FundingRow[]).map(toFunding)
    },
  })
}

/** A funding's amount from one perspective. user1 = the goal owner, user2 = the owner's partner. */
export function fundingForPerson(
  funding: ExpenseFunding,
  person: 'all' | 'me' | 'partner',
  viewerId: string | undefined
): number {
  if (person === 'all') return funding.amount
  const viewerIsOwner = funding.goal_owner_id === viewerId
  const mine = viewerIsOwner ? funding.user1_amount : funding.user2_amount
  const theirs = viewerIsOwner ? funding.user2_amount : funding.user1_amount
  return person === 'me' ? mine : theirs
}

interface FundExpenseInput {
  expenseId: string
  goal: Pick<SavingsGoal, 'id' | 'is_shared'>
  amount: number
  date: string
  from: 'both' | 'user1' | 'user2'
  note?: string
}

/** Pays (part of) an expense from a savings goal: a withdrawal linked to the expense. */
export function useFundExpenseFromSavings() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ expenseId, goal, amount, date, from, note }: FundExpenseInput) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const total = -Math.round(Math.abs(amount) * 100) / 100
      const user1 = from === 'both' ? Math.round(total / 2 * 100) / 100 : from === 'user1' ? total : 0
      const user2 = Math.round((total - user1) * 100) / 100

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('savings_goal_contributions') as any).insert({
        savings_goal_id: goal.id,
        user_id: user.id,
        amount: total,
        user1_amount: goal.is_shared ? user1 : total,
        user2_amount: goal.is_shared ? user2 : 0,
        date,
        note: note || null,
        funded_expense_id: expenseId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
      queryClient.invalidateQueries({ queryKey: ['savings-goal-contributions'] })
      queryClient.invalidateQueries({ queryKey: ['savings-funding'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/** Takes a funding back: the money returns to the goal and the expense counts in full again. */
export function useRemoveExpenseFunding() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contributionId: string) => {
      const { error } = await supabase
        .from('savings_goal_contributions')
        .delete()
        .eq('id', contributionId)
        .is('expense_id', null)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
      queryClient.invalidateQueries({ queryKey: ['savings-goal-contributions'] })
      queryClient.invalidateQueries({ queryKey: ['savings-funding'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
