'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ExpenseWithCategory } from '@/types'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface ExpenseRealtimePayload {
  id: string
  user_id: string
  category_id: string
  amount: number
  description: string
  date: string
  cost_assignment: 'personal' | 'shared' | 'partner'
  assigned_to: string | null
  is_ccm: boolean
  created_at: string
  updated_at: string
}

const REFETCH_DEBOUNCE_MS = 400

export function useExpensesRealtime(userId: string | undefined, partnerId: string | undefined) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  useEffect(() => {
    // Only setup realtime if we have a valid user
    if (!userId) return

    // An import writes many rows at once and each row arrives as its own
    // event. Refetch once per burst instead of once per row.
    let refetchTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer)
      refetchTimer = setTimeout(() => {
        refetchTimer = null
        queryClient.invalidateQueries({ queryKey: ['expenses'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      }, REFETCH_DEBOUNCE_MS)
    }

    console.log('[Realtime] Setting up expense realtime subscription for user:', userId)
    if (partnerId) {
      console.log('[Realtime] Partner connected:', partnerId)
    }

    // Create a channel for realtime updates
    const channel = supabase
      .channel('expenses-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'expenses',
        },
        async (payload: RealtimePostgresChangesPayload<ExpenseRealtimePayload>) => {
          const expense = payload.new as ExpenseRealtimePayload
          const oldExpense = payload.old as ExpenseRealtimePayload

          // Determine if this expense is relevant to current user
          let isRelevant = false

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Show expense if:
            // 1. User created it
            // 2. Partner created it AND it's shared
            // 3. Partner created it AND it's assigned to partner
            // 4. Expense is assigned_to current user
            isRelevant =
              expense.user_id === userId || // User's own expense
              (partnerId && expense.user_id === partnerId && expense.cost_assignment === 'shared') || // Partner's shared expense
              (partnerId && expense.user_id === partnerId && expense.cost_assignment === 'partner') || // Partner pays
              expense.assigned_to === userId // Assigned to user
          } else if (payload.eventType === 'DELETE') {
            // For deletes, we only have old data
            isRelevant =
              oldExpense.user_id === userId ||
              (partnerId && oldExpense.user_id === partnerId && oldExpense.cost_assignment === 'shared') ||
              (partnerId && oldExpense.user_id === partnerId && oldExpense.cost_assignment === 'partner') ||
              oldExpense.assigned_to === userId
          }

          if (!isRelevant) return

          // Invalidate all expense-related queries to trigger refetch
          scheduleRefetch()
        }
      )
      .subscribe((status, err) => {
        console.log('[Realtime] Subscription status:', status)
        if (err) {
          console.error('[Realtime] Subscription error:', err)
        }
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ✅ Successfully subscribed to expense changes')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] ❌ Channel error - Realtime may not be enabled in Supabase')
        } else if (status === 'TIMED_OUT') {
          console.error('[Realtime] ❌ Subscription timed out')
        }
      })

    // Cleanup function
    return () => {
      console.log('[Realtime] Cleaning up expense realtime subscription')
      if (refetchTimer) clearTimeout(refetchTimer)
      channel.unsubscribe()
    }
  }, [userId, partnerId, supabase, queryClient])
}
