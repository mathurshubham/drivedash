/**
 * Hard rule 4: every `/api/*` route answers `401 { error: 'unauthorized' }`
 * without a valid session. `next-auth/jwt` is mocked so the real auth stack is
 * never loaded — the routes reach it only through `getSessionToken`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { blockUser, resetAccessStateForTests, resolveAccess } from '@/lib/access';
import { resetKvBudgetForTests } from '@/lib/kv-budget';

const getToken = vi.fn();

vi.mock('next-auth/jwt', () => ({ getToken }));

const params = Promise.resolve({ id: 'f1' });
const emailParams = Promise.resolve({ email: encodeURIComponent('user@x.com') });

const shareParams = Promise.resolve({ shareId: 's1' });

interface RouteCase {
  name: string;
  load: () => Promise<Record<string, unknown>>;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  init?: RequestInit;
  context?: unknown;
}

const ROUTES: RouteCase[] = [
  {
    name: 'GET /api/search',
    load: () => import('@/app/api/search/route'),
    method: 'GET',
    url: 'http://localhost:3000/api/search?q=deck',
  },
  {
    name: 'GET /api/recent',
    load: () => import('@/app/api/recent/route'),
    method: 'GET',
    url: 'http://localhost:3000/api/recent',
  },
  {
    name: 'GET /api/hotlist',
    load: () => import('@/app/api/hotlist/route'),
    method: 'GET',
    url: 'http://localhost:3000/api/hotlist',
  },
  {
    name: 'PUT /api/hotlist',
    load: () => import('@/app/api/hotlist/route'),
    method: 'PUT',
    url: 'http://localhost:3000/api/hotlist',
    init: { body: JSON.stringify({ version: 1, groups: [], settings: {} }) },
  },
  {
    name: 'GET /api/files/[id]',
    load: () => import('@/app/api/files/[id]/route'),
    method: 'GET',
    url: 'http://localhost:3000/api/files/f1',
    context: { params },
  },
  {
    name: 'GET /api/files/[id]/download',
    load: () => import('@/app/api/files/[id]/download/route'),
    method: 'GET',
    url: 'http://localhost:3000/api/files/f1/download',
    context: { params },
  },
  {
    name: 'POST /api/files/[id]/share',
    load: () => import('@/app/api/files/[id]/share/route'),
    method: 'POST',
    url: 'http://localhost:3000/api/files/f1/share',
    init: { body: JSON.stringify({ mode: 'anyone' }) },
    context: { params },
  },
  {
    name: 'POST /api/files/[id]/copy',
    load: () => import('@/app/api/files/[id]/copy/route'),
    method: 'POST',
    url: 'http://localhost:3000/api/files/f1/copy',
    init: { body: JSON.stringify({ clientName: 'Acme', share: 'none' }) },
    context: { params },
  },
  {
    name: 'GET /api/shares',
    load: () => import('@/app/api/shares/route'),
    method: 'GET',
    url: 'http://localhost:3000/api/shares',
  },
  {
    name: 'POST /api/shares/sweep',
    load: () => import('@/app/api/shares/sweep/route'),
    method: 'POST',
    url: 'http://localhost:3000/api/shares/sweep',
  },
  {
    name: 'DELETE /api/shares/[shareId]',
    load: () => import('@/app/api/shares/[shareId]/route'),
    method: 'DELETE',
    url: 'http://localhost:3000/api/shares/s1',
    context: { params: shareParams },
  },
  {
    name: 'PATCH /api/shares/[shareId]',
    load: () => import('@/app/api/shares/[shareId]/route'),
    method: 'PATCH',
    url: 'http://localhost:3000/api/shares/s1',
    init: { body: JSON.stringify({ extendDays: 7 }) },
    context: { params: shareParams },
  },
  {
    name: 'GET /api/access/me',
    load: () => import('@/app/api/access/me/route'),
    method: 'GET',
    url: 'http://localhost:3000/api/access/me',
  },
  {
    name: 'GET /api/admin/users',
    load: () => import('@/app/api/admin/users/route'),
    method: 'GET',
    url: 'http://localhost:3000/api/admin/users',
  },
  {
    name: 'POST /api/admin/users/[email]/block',
    load: () => import('@/app/api/admin/users/[email]/block/route'),
    method: 'POST',
    url: 'http://localhost:3000/api/admin/users/user%40x.com/block',
    init: { body: JSON.stringify({ blocked: true }) },
    context: { params: emailParams },
  },
  {
    name: 'DELETE /api/admin/users/[email]',
    load: () => import('@/app/api/admin/users/[email]/route'),
    method: 'DELETE',
    url: 'http://localhost:3000/api/admin/users/user%40x.com',
    context: { params: emailParams },
  },
];

beforeEach(() => {
  getToken.mockReset();
  resetAccessStateForTests();
  vi.stubEnv('AUTH_SECRET', 'test-secret');
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
  vi.stubEnv('MAX_USERS', '2');
  resetKvBudgetForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('API routes reject requests without a session', () => {
  it.each(ROUTES.map((r) => [r.name, r] as const))('%s answers 401', async (_name, route) => {
    getToken.mockResolvedValue(null);
    // Make any accidental network call fail loudly rather than silently pass.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('unauthenticated route must not call Drive');
      }),
    );

    const mod = await route.load();
    const handler = mod[route.method] as (req: Request, ctx?: unknown) => Promise<Response>;
    expect(typeof handler).toBe('function');

    const req = new Request(route.url, { method: route.method, ...route.init });
    const res = await handler(req, route.context);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'unauthorized' });
    // Both cookie-name variants are tried before giving up.
    expect(getToken).toHaveBeenCalledTimes(2);
  });
});

describe('requireToken', () => {
  const NOW_S = Math.floor(Date.now() / 1000);

  async function requireToken(req: Request) {
    const { requireToken: fn } = await import('@/lib/api');
    return fn(req);
  }

  const req = () => new Request('http://localhost:3000/api/recent');

  it('registers and returns the access token for a new email', async () => {
    getToken.mockResolvedValue({
      email: 'Allowed@Example.com',
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: NOW_S + 3600,
    });

    await expect(requireToken(req())).resolves.toEqual({
      token: 'at',
      email: 'allowed@example.com',
    });
    // Resolved on the first cookie-name attempt; no retry needed.
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it("rejects with 403 'full' once the cap is reached", async () => {
    await resolveAccess('a@x.com');
    await resolveAccess('b@x.com');
    getToken.mockResolvedValue({
      email: 'late@example.com',
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: NOW_S + 3600,
    });

    await expect(requireToken(req())).rejects.toMatchObject({ status: 403, message: 'full' });
  });

  it("rejects with 403 'blocked' for a blocked user", async () => {
    await resolveAccess('blocked@example.com');
    await blockUser('blocked@example.com', 'admin@example.com');
    getToken.mockResolvedValue({
      email: 'blocked@example.com',
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: NOW_S + 3600,
    });

    await expect(requireToken(req())).rejects.toMatchObject({ status: 403, message: 'blocked' });
  });

  it('rejects a token carrying RefreshTokenError with 401', async () => {
    getToken.mockResolvedValue({
      email: 'allowed@example.com',
      error: 'RefreshTokenError',
      refreshToken: 'rt',
    });

    await expect(requireToken(req())).rejects.toMatchObject({ status: 401 });
  });
});

describe('requireSession and GET /api/access/me', () => {
  const req = () => new Request('http://localhost:3000/api/access/me');

  it('returns identity for a RefreshTokenError session', async () => {
    getToken.mockResolvedValue({
      email: 'newbie@x.com',
      name: 'New User',
      error: 'RefreshTokenError',
    });
    const { requireSession } = await import('@/lib/api');
    await expect(requireSession(req())).resolves.toEqual({
      email: 'newbie@x.com',
      name: 'New User',
    });
  });

  it('answers for a RefreshTokenError session and registers the user', async () => {
    getToken.mockResolvedValue({ email: 'newbie@x.com', error: 'RefreshTokenError' });
    const { GET } = await import('@/app/api/access/me/route');
    const res = await GET(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      email: 'newbie@x.com',
      allowed: true,
      isAdmin: false,
      maxUsers: 2,
    });
  });

  it('reports the reason when the registry is full', async () => {
    await resolveAccess('a@x.com');
    await resolveAccess('b@x.com');
    getToken.mockResolvedValue({ email: 'late@x.com' });
    const { GET } = await import('@/app/api/access/me/route');
    const res = await GET(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      email: 'late@x.com',
      allowed: false,
      isAdmin: false,
      reason: 'full',
      maxUsers: 2,
    });
  });

  it('reports isAdmin for an admin session', async () => {
    getToken.mockResolvedValue({ email: 'admin@example.com' });
    const { GET } = await import('@/app/api/access/me/route');
    await expect((await GET(req())).json()).resolves.toEqual({
      email: 'admin@example.com',
      allowed: true,
      isAdmin: true,
      maxUsers: 2,
    });
  });
});

describe('admin routes reject non-admin sessions', () => {
  const session = {
    email: 'user@x.com',
    accessToken: 'at',
    refreshToken: 'rt',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };

  const ADMIN_ROUTES: RouteCase[] = [
    {
      name: 'GET /api/admin/users',
      load: () => import('@/app/api/admin/users/route'),
      method: 'GET',
      url: 'http://localhost:3000/api/admin/users',
    },
    {
      name: 'POST /api/admin/users/[email]/block',
      load: () => import('@/app/api/admin/users/[email]/block/route'),
      method: 'POST',
      url: 'http://localhost:3000/api/admin/users/user%40x.com/block',
      init: { body: JSON.stringify({ blocked: true }) },
      context: { params: emailParams },
    },
    {
      name: 'DELETE /api/admin/users/[email]',
      load: () => import('@/app/api/admin/users/[email]/route'),
      method: 'DELETE',
      url: 'http://localhost:3000/api/admin/users/user%40x.com',
      context: { params: emailParams },
    },
  ];

  it.each(ADMIN_ROUTES.map((r) => [r.name, r] as const))('%s answers 403', async (_name, route) => {
    getToken.mockResolvedValue(session);
    const mod = await route.load();
    const handler = mod[route.method] as (req: Request, ctx?: unknown) => Promise<Response>;
    const req = new Request(route.url, { method: route.method, ...route.init });
    const res = await handler(req, route.context);
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'forbidden' });
  });
});
