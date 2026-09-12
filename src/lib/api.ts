import { AccessError, isAdminEmail, isAllowed, sanitizeName } from './access';
import { DriveError } from './drive';
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
 * Signed-in session only — no allowlist check and no Drive access token.
 * Used by `/api/access/request` and `/api/access/me`. Identity is enough, so a
 * `RefreshTokenError` session is still accepted (the user can sign out).
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
 * `resolveAccessToken` would refresh a second time. The KV allowlist is
 * re-checked here (with a 60s per-isolate cache) so that removing an address
 * revokes API access within a minute instead of after the 30-day JWT expiry.
 */
export async function requireToken(req: Request): Promise<{ token: string; email: string }> {
  const unauthorized = new ApiHttpError(401, 'unauthorized');
  const { claims, email } = await readSession(req, { requireFreshToken: true });
  if (!(await isAllowed(email))) throw unauthorized;

  const token = await resolveAccessToken(claims);
  if (!token) throw unauthorized;
  return { token, email };
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
  if (e instanceof DriveError) {
    const status = e.status >= 400 && e.status <= 599 ? e.status : 502;
    return errorResponse(status, e.message);
  }
  console.error('Unhandled API error', e);
  return errorResponse(500, 'internal_error');
}
