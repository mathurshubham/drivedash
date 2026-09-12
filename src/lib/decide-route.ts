import type { AccessDecision } from './types';

export type RouteDecision = { type: 'next' } | { type: 'redirect'; to: string };

/**
 * Public paths a signed-out visitor may read: the marketing/landing page and
 * the two legal pages Google's consent screen links to. `/about` is the
 * registered app home page URL, so `/` must land there rather than on the
 * sign-in form — a stranger following the consent-screen link gets the pitch,
 * not a lone Google button.
 */
const PUBLIC = /^\/(about|privacy|terms)\/?$/;

/**
 * Pure page-routing matrix for `src/proxy.ts`. `/login` stays reachable so a
 * signed-in but refused user can switch accounts, and `/access-denied` is
 * reachable by any authenticated session so it can explain the refusal. Admin
 * paths require `decision.isAdmin`.
 *
 * | pathname        | signed out            | signed in, allowed |
 * |-----------------|-----------------------|--------------------|
 * | `/`             | redirect `/about`     | next               |
 * | `/about`        | next                  | next               |
 * | `/privacy`      | next                  | next               |
 * | `/terms`        | next                  | next               |
 * | `/login`        | next                  | next               |
 * | anything else   | redirect `/login`     | next               |
 */
export function decideRoute({
  pathname,
  isAuthed,
  decision,
}: {
  pathname: string;
  isAuthed: boolean;
  decision: AccessDecision;
}): RouteDecision {
  if (pathname === '/login' || pathname.startsWith('/api/')) return { type: 'next' };
  // Public whether or not there is a session; signed-in users keep reading them.
  if (PUBLIC.test(pathname)) return { type: 'next' };
  if (!isAuthed) {
    // The landing page is the front door; `/login` stays reachable directly.
    return { type: 'redirect', to: pathname === '/' ? '/about' : '/login' };
  }
  if (pathname === '/access-denied') return { type: 'next' };
  if (!decision.allowed) return { type: 'redirect', to: `/access-denied?reason=${decision.reason}` };
  if ((pathname === '/admin' || pathname.startsWith('/admin/')) && !decision.isAdmin) {
    return { type: 'redirect', to: '/' };
  }
  return { type: 'next' };
}
