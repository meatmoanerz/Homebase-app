'use client'

import { BottomNav } from './bottom-nav'
import { Sidebar } from './sidebar'
import { MobileHeader } from './mobile-header'
import { RealtimeProvider } from '@/components/realtime-provider'
import { IncomeReminderDialog } from '@/components/income-reminder-dialog'
import { cn } from '@/lib/utils/cn'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, usePartner } from '@/hooks/use-user'
import { useCategories } from '@/hooks/use-categories'
import { createClient } from '@/lib/supabase/client'

/**
 * Prefetches critical shared data at app shell mount so it's ready
 * before the user navigates to any page. Renders nothing.
 */
function AppPrefetch() {
  useUser()
  usePartner()
  useCategories()
  return null
}

/**
 * Sends users who haven't finished onboarding to /onboarding. The cached
 * profile only says "maybe" (useUser also returns a stand-in profile when the
 * row can't be read), so the row itself is checked before redirecting.
 */
function OnboardingGate() {
  const { data: user } = useUser()
  const router = useRouter()
  const needsCheck = !!user && user.onboarding_completed === false

  useEffect(() => {
    if (!needsCheck || !user) return
    let cancelled = false
    createClient()
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { onboarding_completed: boolean } | null
        if (!cancelled && row && !row.onboarding_completed) router.replace('/onboarding')
      })
    return () => { cancelled = true }
  }, [needsCheck, user, router])

  return null
}

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <RealtimeProvider>
      {/* Warms the cache for shared data used on every page */}
      <AppPrefetch />
      <OnboardingGate />
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only"
      >
        Hoppa till innehåll
      </a>

      {/* Desktop sidebar - hidden on mobile */}
      <Sidebar />

      {/* Main content area */}
      <div
        className={cn(
          'min-h-[100dvh]',
          // Clears the floating nav pill (20px gap + ~48px pill) with some air
          'pb-[calc(env(safe-area-inset-bottom,0px)+96px)] md:pb-8',
          'md:pl-60'
        )}
      >
        {/* Mobile header with title + perspective trigger */}
        <MobileHeader />

        <main
          id="main-content"
          className="max-w-lg md:max-w-4xl lg:max-w-6xl mx-auto"
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom nav - hidden on desktop */}
      <BottomNav className="md:hidden" />

      {/* Income reminder popup */}
      <IncomeReminderDialog />
    </RealtimeProvider>
  )
}

