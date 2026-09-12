export type RouteDecision = { type: 'next' } | { type: 'redirect'; to: string };

/**
 * Pure page-routing matrix for `src/proxy.ts`. `/login` stays reachable so a
 * signed-in but unapproved user can switch accounts. `/request-access` is
 * allowed for any authenticated session. Admin paths require `isAdmin`.
 */
export function decideRoute({
  pathname,
  isAuthed,
  isAllowed,
  isAdmin,
}: {
  pathname: string;
  isAuthed: boolean;
  isAllowed: boolean;
  isAdmin: boolean;
}): RouteDecision {
  if (pathname === '/login' || pathname.startsWith('/api/')) return { type: 'next' };
  if (!isAuthed) return { type: 'redirect', to: '/login' };
  if (pathname === '/request-access') return { type: 'next' };
  if (!isAllowed) return { type: 'redirect', to: '/request-access' };
  if (pathname.startsWith('/admin') && !isAdmin) return { type: 'redirect', to: '/' };
  return { type: 'next' };
}
