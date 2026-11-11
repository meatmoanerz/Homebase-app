'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { clearUserState, switchUserState } from '@/lib/auth/user-state'

/**
 * Keeps cached data tied to the signed-in account. When the account signs
 * out, or a different account becomes active, everything cached for the
 * previous one is dropped so it can never show up in the new session.
 */
export function AuthSessionGuard() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const supabase = createClient()
    // undefined = not known yet, null = signed out
    let currentUserId: string | null | undefined

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null

      if (event === 'SIGNED_OUT') {
        clearUserState(queryClient)
      } else if (event === 'INITIAL_SESSION' || currentUserId === undefined) {
        // First report of who is signed in: nothing to compare with.
      } else if (nextUserId !== currentUserId) {
        switchUserState(queryClient)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        queryClient.invalidateQueries({ queryKey: ['user'] })
      }

      currentUserId = nextUserId
    })

    return () => subscription.unsubscribe()
  }, [queryClient])

  return null
}
