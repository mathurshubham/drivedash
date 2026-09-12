import type { AccessDecision } from './types';

export type RouteDecision = { type: 'next' } | { type: 'redirect'; to: string };

/**
 * Pure page-routing matrix for `src/proxy.ts`. `/login` stays reachable so a
 * signed-in but refused user can switch accounts, and `/access-denied` is
 * reachable by any authenticated session so it can explain the refusal. Admin
 * paths require `decision.isAdmin`.
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
  if (!isAuthed) return { type: 'redirect', to: '/login' };
  if (pathname === '/access-denied') return { type: 'next' };
  if (!decision.allowed) return { type: 'redirect', to: `/access-denied?reason=${decision.reason}` };
  if ((pathname === '/admin' || pathname.startsWith('/admin/')) && !decision.isAdmin) {
    return { type: 'redirect', to: '/' };
  }
  return { type: 'next' };
}
