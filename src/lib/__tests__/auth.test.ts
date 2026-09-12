import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAccessTokenCache, resolveAccessToken } from '../token';

const NOW = 1_800_000_000_000; // ms
const NOW_S = NOW / 1000;

function tokenResponse(accessToken: string, expiresIn = 3600) {
  return Response.json({ access_token: accessToken, expires_in: expiresIn });
}

beforeEach(() => {
  clearAccessTokenCache();
  vi.stubEnv('AUTH_GOOGLE_ID', 'client-id');
  vi.stubEnv('AUTH_GOOGLE_SECRET', 'client-secret');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('resolveAccessToken', () => {
  it('returns the stored token while it is still fresh', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveAccessToken(
      { accessToken: 'fresh', refreshToken: 'r1', expiresAt: NOW_S + 600 },
      NOW,
    );

    expect(result).toBe('fresh');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes when the token is expired (or inside the skew window)', async () => {
    const fetchMock = vi.fn(async () => tokenResponse('refreshed'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveAccessToken(
      { accessToken: 'stale', refreshToken: 'r1', expiresAt: NOW_S + 10 },
      NOW,
    );

    expect(result).toBe('refreshed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(target).toBe('https://oauth2.googleapis.com/token');
    const body = new URLSearchParams(String(init.body));
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('r1');
    expect(body.get('client_id')).toBe('client-id');
    expect(body.get('client_secret')).toBe('client-secret');
  });

  it('returns null for a RefreshTokenError jwt', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveAccessToken(
      { accessToken: 'stale', refreshToken: 'r1', expiresAt: 0, error: 'RefreshTokenError' },
      NOW,
    );

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when the refresh request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'invalid_grant' }, { status: 400 })));

    await expect(
      resolveAccessToken({ accessToken: 'stale', refreshToken: 'r1', expiresAt: 0 }, NOW),
    ).resolves.toBeNull();
  });

  it('returns null when there is no refresh token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveAccessToken({ accessToken: 'stale', expiresAt: 0 }, NOW)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caches a refreshed token per refresh token within the isolate', async () => {
    const fetchMock = vi.fn(async () => tokenResponse('refreshed'));
    vi.stubGlobal('fetch', fetchMock);

    const jwt = { accessToken: 'stale', refreshToken: 'r1', expiresAt: 0 };
    await expect(resolveAccessToken(jwt, NOW)).resolves.toBe('refreshed');
    await expect(resolveAccessToken(jwt, NOW + 1000)).resolves.toBe('refreshed');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes again once the cached token has itself expired', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse('first'))
      .mockResolvedValueOnce(tokenResponse('second'));
    vi.stubGlobal('fetch', fetchMock);

    const jwt = { accessToken: 'stale', refreshToken: 'r1', expiresAt: 0 };
    await expect(resolveAccessToken(jwt, NOW)).resolves.toBe('first');
    await expect(resolveAccessToken(jwt, NOW + 3_600_000)).resolves.toBe('second');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
