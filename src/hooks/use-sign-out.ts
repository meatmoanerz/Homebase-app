'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { usePerspective } from '@/hooks/use-perspective'

/**
 * Signs out and wipes everything the previous account left in memory.
 *
 * The query cache lives in the root layout, so a client-side navigation to
 * /login would keep the old account's profile, partner and expenses around
 * for the next person who signs in on the same device. A full page load
 * guarantees a clean start.
 */
export function useSignOut() {
  const queryClient = useQueryClient()

  return useCallback(async () => {
    const { error } = await createClient().auth.signOut()
    if (error) {
      toast.error('Kunde inte logga ut')
      return
    }
    queryClient.clear()
    usePerspective.getState().setPerspective('all')
    window.location.replace('/login')
  }, [queryClient])
}
