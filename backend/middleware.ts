import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { verifyEnvironment } from '@/lib/verify-env'

// Verify environment on startup
if (typeof globalThis !== 'undefined' && !('__env_verified' in globalThis)) {
  verifyEnvironment()
  ;(globalThis as any).__env_verified = true
}

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/chat(.*)',
  '/api/mcq(.*)',
  '/api/quizzes(.*)',
  '/api/attempt(.*)',
  '/api/notes(.*)',  // Allow API routes to handle their own auth
  '/api/test-ai(.*)',  // Test endpoint accessible without auth
])

export default clerkMiddleware((auth, request) => {
  // Only protect non-API routes
  if (!isPublicRoute(request) && !request.nextUrl.pathname.startsWith('/api')) {
    auth().protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
