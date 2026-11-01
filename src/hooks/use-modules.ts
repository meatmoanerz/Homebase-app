'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import {
  ALL_OPTIONAL_MODULES,
  MODULE_INFO,
  isModuleEnabled,
  type OptionalModule,
} from '@/lib/onboarding/modules'
import type { Profile } from '@/types'

// The generated database types lag the newest profile columns.
type ProfileWithModules = Profile & {
  enabled_modules?: string[] | null
  seen_intros?: string[] | null
}

/** Which optional modules the signed-in user has switched on. */
export function useModules() {
  const { data: user, isLoading } = useUser()
  const profile = user as ProfileWithModules | null | undefined
  return {
    isLoading,
    isEnabled: (module: OptionalModule) => isModuleEnabled(profile, module),
  }
}

export function useSetModuleEnabled() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async ({ userId, module, enabled }: { userId: string; module: OptionalModule; enabled: boolean }) => {
      const previous = queryClient.getQueryData<ProfileWithModules | null>(['user'])
      // NULL means "every module" (profiles from before module selection).
      const current = previous?.enabled_modules ?? [...ALL_OPTIONAL_MODULES]
      const next = enabled
        ? Array.from(new Set([...current, module]))
        : current.filter((m) => m !== module)

      const update: Record<string, unknown> = { enabled_modules: next }
      if (module === 'ccm') update.ccm_enabled = enabled

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('profiles').update(update).eq('id', userId)
      if (error) throw error
      return update
    },
    onSuccess: (update, { module, enabled }) => {
      const previous = queryClient.getQueryData<ProfileWithModules | null>(['user'])
      if (previous) queryClient.setQueryData(['user'], { ...previous, ...update })
      const info = MODULE_INFO[module]
      if (enabled) {
        // The module's introduction shows the first time its page is opened.
        toast.success(`${info.label} är aktiverat`, {
          action: { label: 'Öppna', onClick: () => router.push(info.href) },
        })
      } else {
        toast.success(`${info.label} är avstängt`)
      }
    },
    onError: () => {
      toast.error('Kunde inte spara inställningen')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
    },
  })
}

/** Which introductions the user has already seen or dismissed. */
export function useIntros() {
  const { data: user } = useUser()
  const profile = user as ProfileWithModules | null | undefined
  // Missing column (before the migration) counts as "seen everything".
  const seen = profile ? profile.seen_intros ?? ['*'] : ['*']
  return {
    ready: !!profile,
    hasSeen: (key: string) => seen.includes('*') || seen.includes(key),
  }
}

export function useMarkIntroSeen() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, key }: { userId: string; key: string }) => {
      const previous = queryClient.getQueryData<ProfileWithModules | null>(['user'])
      const seen = previous?.seen_intros ?? []
      if (seen.includes(key) || seen.includes('*')) return seen
      const next = [...seen, key]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('profiles').update({ seen_intros: next }).eq('id', userId)
      if (error) throw error
      return next
    },
    onMutate: async ({ key }) => {
      // Hide the intro right away, even before the write lands.
      const previous = queryClient.getQueryData<ProfileWithModules | null>(['user'])
      if (previous) {
        const seen = previous.seen_intros ?? []
        if (!seen.includes(key)) queryClient.setQueryData(['user'], { ...previous, seen_intros: [...seen, key] })
      }
    },
  })
}

/** Shows every introduction again (from the help page). */
export function useResetIntros() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('profiles').update({ seen_intros: [] }).eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      const previous = queryClient.getQueryData<ProfileWithModules | null>(['user'])
      if (previous) queryClient.setQueryData(['user'], { ...previous, seen_intros: [] })
      toast.success('Introduktionerna visas igen')
    },
    onError: () => {
      toast.error('Kunde inte återställa introduktionerna')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
    },
  })
}
