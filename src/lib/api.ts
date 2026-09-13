import { AccessError, isAdminEmail, resolveAccess, sanitizeName } from './access';
import { KvBudgetExceeded } from './kv-budget';
import { DriveError } from './drive';
import type { SessionClaims } from './token';
import { getSessionToken, resolveAccessToken } from './token';
import type { ApiError } from './types';

export { DriveError };

/** An error that maps directly onto an HTTP status in an API route. */
export class ApiHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
  }
}

/** JSON response helper with the correct content type. */
export function json<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function errorResponse(status: number, error: string): Response {
  return json<ApiError>({ error }, { status });
}

/** 400 helper for manual body/query validation. */
export function badRequest(error: string): Response {
  return errorResponse(400, error);
}

async function readSession(req: Request, opts?: { requireFreshToken?: boolean }) {
  const unauthorized = new ApiHttpError(401, 'unauthorized');
  const claims = await getSessionToken(req);
  if (!claims) throw unauthorized;
  if (opts?.requireFreshToken && claims.error === 'RefreshTokenError') throw unauthorized;
  const email = claims.email?.trim().toLowerCase();
  if (!email) throw unauthorized;
  return { claims, email, name: claims.name ? sanitizeName(claims.name) || undefined : undefined };
}

/**
 * Signed-in session only — no registry check and no Drive access token.
 * Used by `/api/access/me`. Identity is enough, so a `RefreshTokenError`
 * session is still accepted (the user can sign out).
 */
export async function requireSession(req: Request): Promise<{ email: string; name?: string }> {
  const { email, name } = await readSession(req);
  return { email, name };
}

/**
 * Resolve the Google access token for the current request.
 * Throws `ApiHttpError(401)` when there is no usable session.
 *
 * Reads the session JWT straight off the request cookie rather than going
 * through `auth()`: `auth()` runs the `jwt` callback, which refreshes, and then
 * `resolveAccessToken` would refresh a second time. The KV registry is
 * re-checked here (with a 60s per-isolate cache) so that blocking or removing a
 * user revokes API access within a minute instead of after the 30-day JWT
 * expiry. A refused user gets `403 { error: 'full' | 'blocked' }`, which is
 * deliberately distinct from the `401` returned when there is no session.
 */
export async function requireToken(req: Request): Promise<{ token: string; email: string }> {
  const unauthorized = new ApiHttpError(401, 'unauthorized');
  const { claims, email, name } = await readSession(req, { requireFreshToken: true });
  const decision = await resolveAccess(email, name);
  if (!decision.allowed) throw new ApiHttpError(403, decision.reason);

  const token = await resolveAccessToken(claims);
  if (!token) throw unauthorized;
  return { token, email };
}

/**
 * Like `requireToken`, minus the registry check.
 *
 * Deleting your own data is the one thing a refused user must still be able to
 * do: a blocked account, or one that arrived after the cap filled, still has
 * files in its app-data folder and a seat in the registry, and sending it to
 * `/access-denied` with no way out would make the block a data trap. So the
 * allowlist / cap decision is deliberately skipped — identity plus a usable
 * Drive token is the whole gate. `RefreshTokenError` sessions are refused here
 * (401): without a token there is nothing to delete in Drive anyway.
 */
export async function requireTokenForDeletion(
  req: Request,
): Promise<{ token: string; email: string; claims: SessionClaims }> {
  const { claims, email } = await readSession(req, { requireFreshToken: true });
  const token = await resolveAccessToken(claims);
  if (!token) throw new ApiHttpError(401, 'unauthorized');
  return { token, email, claims };
}

/** Signed-in admin. Throws 403 when the session is not an admin. */
export async function requireAdmin(req: Request): Promise<{ email: string; name?: string }> {
  const session = await requireSession(req);
  if (!isAdminEmail(session.email)) throw new ApiHttpError(403, 'forbidden');
  return session;
}

/** Map any thrown value onto an `ApiError` response. */
export function handleError(e: unknown): Response {
  if (e instanceof ApiHttpError) return errorResponse(e.status, e.message);
  if (e instanceof AccessError) return errorResponse(e.status, e.message);
  if (e instanceof KvBudgetExceeded) return errorResponse(503, e.message);
  if (e instanceof DriveError) {
    const status = e.status >= 400 && e.status <= 599 ? e.status : 502;
    return errorResponse(status, e.message);
  }
  console.error('Unhandled API error', e);
  return errorResponse(500, 'internal_error');
}
