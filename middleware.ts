import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { handleAdminRoute } from '@/lib/admin/middleware'

export async function middleware(request: NextRequest) {
  // Handle admin routes separately
  const adminResponse = handleAdminRoute(request)
  if (adminResponse) {
    return adminResponse
  }

  // Handle regular app routes with Supabase auth
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, manifest, service worker)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

