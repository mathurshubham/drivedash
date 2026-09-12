/**
 * Google access-token handling, kept free of any `next-auth` import so it can
 * be unit tested (and so API routes can refresh without waiting for the
 * refreshed session cookie to come back on the *next* request).
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
