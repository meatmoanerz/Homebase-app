'use client'

import { BottomNav } from './bottom-nav'
import { Sidebar } from './sidebar'
import { MobileHeader } from './mobile-header'
import { RealtimeProvider } from '@/components/realtime-provider'
import { IncomeReminderDialog } from '@/components/income-reminder-dialog'
import { cn } from '@/lib/utils/cn'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <RealtimeProvider>
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
          'pb-[120px] md:pb-8',
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

