import { AppSplash } from '@/components/shared/app-splash'

// Streams immediately while the (app) layout checks the session and profile
// on the server, so a cold start shows the logo instead of a blank screen.
export default function Loading() {
  return <AppSplash />
}
