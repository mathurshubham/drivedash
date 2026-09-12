import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextMiddleware, NextRequest } from 'next/server';
import { auth, isAllowedEmail } from '@/lib/auth';

/**
 * Next.js 16 Proxy (formerly Middleware). Redirects unauthenticated page
 * requests to `/login`. `/api/*` is excluded by the matcher below — those
 * routes answer `401 { error: 'unauthorized' }` themselves.
 */
const withAuth = auth((req) => {
  const { pathname, search } = req.nextUrl;

  if (pathname === '/login' || pathname.startsWith('/api/')) return NextResponse.next();

  const redirect = (error?: string): NextResponse => {
    const url = new URL('/login', req.nextUrl.origin);
    if (error) url.searchParams.set('error', error);
    if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  };

  if (!req.auth?.user || req.auth.error === 'RefreshTokenError') return redirect();

  // Re-checked on every page request so that removing an address from
  // ALLOWED_EMAILS revokes access immediately, not at JWT expiry.
  if (!isAllowedEmail(req.auth.user.email)) return redirect('AccessDenied');

  return NextResponse.next();
});

// Next.js requires the `proxy` export to be a plain function declaration.
// With the lazy `NextAuth(() => config)` form, `auth(handler)` resolves
// asynchronously to the wrapped middleware, so it is awaited here.
export async function proxy(req: NextRequest, event: NextFetchEvent) {
  const handler = (await withAuth) as unknown as NextMiddleware;
  return handler(req, event);
}

export const config = {
  // Prefix-only paths such as `/apifoo` must not bypass auth, hence the
  // trailing slashes / dots on every exclusion.
  matcher: ['/((?!_next/|api/|favicon.ico|manifest.webmanifest|icons/).*)'],
};
