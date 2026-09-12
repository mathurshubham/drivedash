import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextMiddleware, NextRequest } from 'next/server';
import { isAdminEmail, isAllowed } from '@/lib/access';
import { auth } from '@/lib/auth';
import { decideRoute } from '@/lib/decide-route';

export { decideRoute } from '@/lib/decide-route';

/**
 * Next.js 16 Proxy (formerly Middleware). Redirects unauthenticated page
 * requests to `/login`. `/api/*` is excluded by the matcher below — those
 * routes answer `401 { error: 'unauthorized' }` themselves.
 * `/request-access` is NOT excluded: it needs the auth wrapper to know who
 * the user is.
 */
const withAuth = auth(async (req) => {
  const { pathname, search } = req.nextUrl;
  const isAuthed = Boolean(req.auth?.user) && req.auth?.error !== 'RefreshTokenError';
  const email = req.auth?.user?.email;
  const allowed = isAuthed ? await isAllowed(email) : false;
  const admin = isAdminEmail(email);
  const decision = decideRoute({ pathname, isAuthed, isAllowed: allowed, isAdmin: admin });

  if (decision.type === 'next') return NextResponse.next();

  const url = new URL(decision.to, req.nextUrl.origin);
  if (decision.to === '/login') {
    if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`);
  }
  return NextResponse.redirect(url);
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
