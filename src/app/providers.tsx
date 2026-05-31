'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { useState } from 'react'
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
        <KeyboardDetector />
        <CapacitorInit />
        {children}
        <Toaster
          richColors
          position="top-center"
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

