/**
 * Hard rule 4: every `/api/*` route answers `401 { error: 'unauthorized' }`
 * without a valid session. `next-auth/jwt` is mocked so the real auth stack is
 * never loaded — the routes reach it only through `getSessionToken`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetAccessStateForTests } from '@/lib/access';

const getToken = vi.fn();

vi.mock('next-auth/jwt', () => ({ getToken }));

const params = Promise.resolve({ id: 'f1' });
const emailParams = Promise.resolve({ email: encodeURIComponent('user@x.com') });

interface RouteCase {
  name: string;
  load: () => Promise<Record<string, unknown>>;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
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
    name: 'GET /api/access/me',
    load: () => import('@/app/api/access/me/route'),
    method: 'GET',
    url: 'http://localhost:3000/api/access/me',
  },
  {
    name: 'POST /api/access/request',
    load: () => import('@/app/api/access/request/route'),
    method: 'POST',
    url: 'http://localhost:3000/api/access/request',
    init: { body: JSON.stringify({ note: 'please' }) },
  },
  {
    name: 'GET /api/admin/users',
    load: () => import('@/app/api/admin/users/route'),
    method: 'GET',
    url: 'http://localhost:3000/api/admin/users',
  },
  {
    name: 'POST /api/admin/users',
    load: () => import('@/app/api/admin/users/route'),
    method: 'POST',
    url: 'http://localhost:3000/api/admin/users',
    init: { body: JSON.stringify({ email: 'new@x.com' }) },
  },
  {
    name: 'DELETE /api/admin/users/[email]',
    load: () => import('@/app/api/admin/users/[email]/route'),
    method: 'DELETE',
    url: 'http://localhost:3000/api/admin/users/user%40x.com',
    context: { params: emailParams },
  },
  {
    name: 'POST /api/admin/requests/[email]',
    load: () => import('@/app/api/admin/requests/[email]/route'),
    method: 'POST',
    url: 'http://localhost:3000/api/admin/requests/user%40x.com',
    init: { body: JSON.stringify({ decision: 'approved' }) },
    context: { params: emailParams },
  },
];

beforeEach(() => {
  getToken.mockReset();
  resetAccessStateForTests();
  vi.stubEnv('AUTH_SECRET', 'test-secret');
  vi.stubEnv('ALLOWED_EMAILS', 'allowed@example.com');
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
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

  it('rejects a decoded token whose email is not in ALLOWED_EMAILS', async () => {
    getToken.mockResolvedValue({
      email: 'intruder@example.com',
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: NOW_S + 3600,
    });

    await expect(requireToken(req())).rejects.toMatchObject({
      status: 401,
      message: 'unauthorized',
    });
  });

  it('rejects a token carrying RefreshTokenError', async () => {
    getToken.mockResolvedValue({
      email: 'allowed@example.com',
      error: 'RefreshTokenError',
      refreshToken: 'rt',
    });

    await expect(requireToken(req())).rejects.toMatchObject({ status: 401 });
  });

  it('returns the access token for an allowed email', async () => {
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
});

describe('requireSession', () => {
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

  it('lets GET /api/access/me succeed with a RefreshTokenError session', async () => {
    getToken.mockResolvedValue({
      email: 'newbie@x.com',
      error: 'RefreshTokenError',
    });
    const { GET } = await import('@/app/api/access/me/route');
    const res = await GET(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      email: 'newbie@x.com',
      allowed: false,
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
      name: 'POST /api/admin/users',
      load: () => import('@/app/api/admin/users/route'),
      method: 'POST',
      url: 'http://localhost:3000/api/admin/users',
      init: { body: JSON.stringify({ email: 'new@x.com' }) },
    },
    {
      name: 'DELETE /api/admin/users/[email]',
      load: () => import('@/app/api/admin/users/[email]/route'),
      method: 'DELETE',
      url: 'http://localhost:3000/api/admin/users/user%40x.com',
      context: { params: emailParams },
    },
    {
      name: 'POST /api/admin/requests/[email]',
      load: () => import('@/app/api/admin/requests/[email]/route'),
      method: 'POST',
      url: 'http://localhost:3000/api/admin/requests/user%40x.com',
      init: { body: JSON.stringify({ decision: 'approved' }) },
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

describe('POST /api/access/request', () => {
  it('succeeds for a signed-in email that is not on the allowlist', async () => {
    getToken.mockResolvedValue({
      email: 'newbie@x.com',
      name: 'New',
    });

    const { POST } = await import('@/app/api/access/request/route');
    const res = await POST(
      new Request('http://localhost:3000/api/access/request', {
        method: 'POST',
        body: JSON.stringify({ note: 'please' }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { request: { email: string; status: string; note?: string } };
    expect(body.request).toMatchObject({
      email: 'newbie@x.com',
      status: 'pending',
      note: 'please',
    });
  });
});
