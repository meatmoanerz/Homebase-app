'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface NotificationSettings {
  user_id: string
  import_reminder_enabled: boolean
  import_reminder_day: number // 0 = söndag (JS getDay-konvention)
  updated_at: string
}

export function useNotificationSettings() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['notification-settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      return (data as NotificationSettings) || null
    },
  })
}

export function useSaveNotificationSettings() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settings: { import_reminder_enabled: boolean; import_reminder_day: number }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('notification_settings')
        .upsert(
          {
            user_id: user.id,
            import_reminder_enabled: settings.import_reminder_enabled,
            import_reminder_day: settings.import_reminder_day,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single()

      if (error) throw error
      return data as NotificationSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] })
    },
  })
}
