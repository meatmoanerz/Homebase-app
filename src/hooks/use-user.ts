'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { useEffect } from 'react'

export function useUser() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Listen for auth changes and invalidate query
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        queryClient.invalidateQueries({ queryKey: ['user'] })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, queryClient])

  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      // First get the authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
        return null
      }
      
      if (!user) {
        return null
      }

      // Then get the profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()  // Use maybeSingle instead of single to avoid error on no results

      if (profileError) {
        console.error('Profile fetch error:', profileError)
        // If profile doesn't exist, return a minimal profile from auth
        return {
          id: user.id,
          email: user.email || '',
          first_name: user.user_metadata?.first_name || user.email?.split('@')[0] || '',
          last_name: user.user_metadata?.last_name || '',
          salary_day: 25,
          onboarding_completed: false,
          currency: 'SEK',
          language: 'sv',
          theme: 'light',
          ccm_enabled: false,
          ccm_invoice_break_date: 1,
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Profile
      }

      if (!profile) {
        // Profile doesn't exist yet - return minimal profile
        return {
          id: user.id,
          email: user.email || '',
          first_name: user.user_metadata?.first_name || user.email?.split('@')[0] || '',
          last_name: user.user_metadata?.last_name || '',
          salary_day: 25,
          onboarding_completed: false,
          currency: 'SEK',
          language: 'sv',
          theme: 'light',
          ccm_enabled: false,
          ccm_invoice_break_date: 1,
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Profile
      }

      return profile as Profile
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })
}

export function usePartner() {
  return useQuery({
    queryKey: ['partner'],
    queryFn: async () => {
      console.log('usePartner: Fetching from API...')
      
      const response = await fetch('/api/partner')
      const data = await response.json()
      
      console.log('usePartner: API response:', data)
      
      if (data.error) {
        console.error('usePartner: API error:', data.error)
        return null
      }
      
      return data.partner as Profile | null
    },
    staleTime: 10 * 60 * 1000 // 10 min — sällan ändrad,
  })
}

export function usePartnerConnection() {
  return useQuery({
    queryKey: ['partner-connection'],
    queryFn: async () => {
      console.log('usePartnerConnection: Fetching from API...')
      
      const response = await fetch('/api/partner')
      const data = await response.json()
      
      console.log('usePartnerConnection: API response:', data)
      
      if (data.error) {
        console.error('usePartnerConnection: API error:', data.error)
        return null
      }
      
      return data.connection || null
    },
    staleTime: 10 * 60 * 1000 // 10 min — sällan ändrad,
  })
}
