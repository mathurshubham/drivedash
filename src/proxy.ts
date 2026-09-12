import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Next.js 16 Proxy (formerly Middleware). Redirects unauthenticated page
 * requests to `/login`. `/api/*` is excluded by the matcher below — those
 * routes answer `401 { error: 'unauthorized' }` themselves.
 */
export const proxy = auth((req) => {
  const { pathname, search } = req.nextUrl;

  if (pathname === '/login' || pathname.startsWith('/api/')) return NextResponse.next();

  if (!req.auth?.user || req.auth.error === 'RefreshTokenError') {
    const url = new URL('/login', req.nextUrl.origin);
    if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|manifest.webmanifest|icons).*)'],
};
