'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'

/**
 * Whether the signed-in user has a beta feature (profiles.feature_access, or
 * a @test.se account). Decided in the database by has_feature_access().
 */
export function useFeatureAccess(feature: string) {
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['feature-access', feature, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<boolean> => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- function not in generated types yet
      const { data, error } = await (supabase as any).rpc('has_feature_access', { p_feature: feature })
      if (error) throw error
      return data === true
    },
    staleTime: 30 * 60 * 1000,
  })
}
