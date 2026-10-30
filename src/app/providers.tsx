'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, useTheme } from 'next-themes'
import { Toaster } from 'sonner'
import { MotionConfig } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useKeyboard } from '@/hooks/use-keyboard'
import { useCapacitorInit } from '@/hooks/use-capacitor'

// Component to initialize keyboard detection globally
function KeyboardDetector() {
  useKeyboard()
  return null
}

// Component to initialize Capacitor native plugins (no-op on web)
function CapacitorInit() {
  useCapacitorInit()
  return null
}

// Keeps theme-color on the page background when the user picks a theme in the
// app that differs from the system one (the meta tags only follow the system)
function ThemeColorSync() {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    if (!resolvedTheme) return
    const color = resolvedTheme === 'dark' ? '#1a1510' : '#f4ede3'
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute('content', color))
  }, [resolvedTheme])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data fresh for 5 minutes by default.
        // Sällan-ändrad data (kategorier, user) sätter längre staleTime i hooken.
        staleTime: 5 * 60 * 1000,
        // Keep unused cache for 15 min — so navigating back is instant
        gcTime: 15 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        // Don't refetch on mount if data is fresh — crucial for tab-switching
        refetchOnMount: true,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem={true}
        storageKey="stacka-theme"
      >
        <ThemeColorSync />
        <KeyboardDetector />
        <CapacitorInit />
        {/* Framer animations follow the system "Reduce motion" setting */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
        <Toaster
          richColors
          position="top-center"
          // Status bar is see-through, so keep toasts below the clock
          mobileOffset={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
          toastOptions={{
            style: {
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              color: 'var(--foreground)',
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

