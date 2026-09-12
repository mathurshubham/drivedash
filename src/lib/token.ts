/**
 * Google access-token handling plus session-JWT decoding. Kept free of any
 * top-level `next-auth` import (only `next-auth/jwt` is pulled in lazily) so it
 * can be unit tested, and so API routes can refresh without waiting for the
 * refreshed session cookie to come back on the *next* request.
 */

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
/** Refresh this many seconds before the access token actually expires. */
export const REFRESH_SKEW_SECONDS = 60;
/** Upper bound on the in-memory token cache, per worker isolate. */
const CACHE_LIMIT = 50;

export interface GoogleRefreshResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
}

export interface AccessTokenClaims {
  accessToken?: string;
  refreshToken?: string;
  /** Epoch seconds. */
  expiresAt?: number;
  error?: string;
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleRefreshResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? '',
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed with status ${res.status}`);
  const data = (await res.json()) as GoogleRefreshResponse;
  if (!data.access_token) throw new Error('Token refresh response contained no access_token');
  return data;
}

/**
 * Access tokens refreshed inside this isolate, keyed by refresh token. Google
 * does not rotate refresh tokens, so the key stays stable across requests and
 * repeated API calls within an isolate hit the token endpoint at most once per
 * token lifetime.
 */
const cache = new Map<string, { accessToken: string; expiresAt: number }>();

/** Exposed for tests. */
export function clearAccessTokenCache(): void {
  cache.clear();
}

function cacheSet(refreshToken: string, accessToken: string, expiresAt: number): void {
  if (!cache.has(refreshToken) && cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(refreshToken, { accessToken, expiresAt });
}

function isFresh(expiresAt: number | undefined, now: number): boolean {
  return typeof expiresAt === 'number' && now / 1000 <= expiresAt - REFRESH_SKEW_SECONDS;
}

/**
 * Turn the decoded session JWT into a usable Google access token, refreshing
 * it when it has expired (or is about to). Returns `null` when no usable token
 * can be produced.
 */
export async function resolveAccessToken(
  jwt: AccessTokenClaims,
  now: number = Date.now(),
): Promise<string | null> {
  if (jwt.error === 'RefreshTokenError') return null;

  if (jwt.accessToken && isFresh(jwt.expiresAt, now)) return jwt.accessToken;

  const refreshToken = jwt.refreshToken;
  if (!refreshToken) return null;

  const cached = cache.get(refreshToken);
  if (cached && isFresh(cached.expiresAt, now)) return cached.accessToken;

  try {
    const refreshed = await refreshAccessToken(refreshToken);
    const accessToken = refreshed.access_token;
    if (!accessToken) return null;
    const expiresAt = Math.floor(now / 1000) + Number(refreshed.expires_in ?? 3600);
    cacheSet(refreshToken, accessToken, expiresAt);
    return accessToken;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Session JWT access                                                          */
/* -------------------------------------------------------------------------- */

/** The subset of the session JWT this module cares about. */
export interface SessionClaims extends AccessTokenClaims {
  email?: string | null;
  name?: string | null;
}

/** Comma-separated `ALLOWED_EMAILS` — seed source for the KV allowlist only. */
export function envAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Whether the session cookie for this request carries the `__Secure-` prefix.
 * On Workers the request is rebuilt before it reaches us, so consult every
 * signal available rather than trusting `req.url` alone.
 */
export function isSecureRequest(req: Request): boolean {
  if ((process.env.AUTH_URL ?? '').startsWith('https://')) return true;
  if (req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https') return true;
  try {
    return new URL(req.url).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Decode the session JWT straight from the request cookie. Deliberately does
 * not go through `auth()`, so API routes never trigger a second refresh on top
 * of `resolveAccessToken`'s. Retries with the opposite cookie prefix, which is
 * cheap and sidesteps the wrong-cookie-name failure mode behind the Workers
 * request rebuild.
 */
export async function getSessionToken(req: Request): Promise<SessionClaims | null> {
  const { getToken } = await import('next-auth/jwt');
  const read = async (secureCookie: boolean): Promise<SessionClaims | null> =>
    ((await getToken({
      req,
      secret: process.env.AUTH_SECRET,
      secureCookie,
    })) ?? null) as SessionClaims | null;

  const secure = isSecureRequest(req);
  return (await read(secure)) ?? (await read(!secure));
}
