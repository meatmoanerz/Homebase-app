import { AppShell } from '@/components/layout/app-shell'
import { AppErrorBoundary } from '@/components/error/app-error-boundary'

// No server data here on purpose: the middleware already sends signed-out
// visitors to /login, and the onboarding check runs in the client
// (OnboardingGate). That keeps every page in this group static, so opening
// the app is served straight from Vercel's CDN instead of waiting for a
// server function to wake up and check the session.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppShell>
      <AppErrorBoundary>{children}</AppErrorBoundary>
    </AppShell>
  )
}
