import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ShareEntry, ShareLedger } from '../types';

const getToken = vi.fn();

vi.mock('next-auth/jwt', () => ({ getToken }));

const params = Promise.resolve({ id: 'f1' });
const NOW_S = Math.floor(Date.now() / 1000);

function session() {
  getToken.mockResolvedValue({
    email: 'allowed@example.com',
    accessToken: 'at',
    refreshToken: 'rt',
    expiresAt: NOW_S + 3600,
  });
}

function entry(partial: Partial<ShareEntry> & Pick<ShareEntry, 'id' | 'kind' | 'status'>): ShareEntry {
  return {
    fileId: 'f1',
    fileName: 'Deck',
    webViewLink: 'https://drive.google.com/f1',
    createdAt: '2026-09-01T00:00:00.000Z',
    expiresAt: null,
    ...partial,
  };
}

function ledger(shares: ShareEntry[], lastSweepAt: string | null = null): ShareLedger {
  return { version: 1, lastSweepAt, shares };
}

beforeEach(() => {
  getToken.mockReset();
  vi.stubEnv('AUTH_SECRET', 'test-secret');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('message length is rejected, not truncated', () => {
  beforeEach(session);

  it('POST /api/files/[id]/share accepts control-char padding that sanitizes to 500', async () => {
    const { POST } = await import('@/app/api/files/[id]/share/route');
    stubShareFetch({ ledgers: [ledger([])] });

    const res = await POST(
      new Request('http://localhost/api/files/f1/share', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'anyone',
          message: `${'x'.repeat(500)}${'\u0000'.repeat(20)}`,
        }),
      }),
      { params },
    );

    expect(res.status).toBe(200);
  });

  it('POST /api/files/[id]/share returns 400 when the trimmed message exceeds 500', async () => {
    const { POST } = await import('@/app/api/files/[id]/share/route');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST(
      new Request('http://localhost/api/files/f1/share', {
        method: 'POST',
        body: JSON.stringify({ mode: 'anyone', message: `  ${'x'.repeat(501)}  ` }),
      }),
      { params },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'message must be 500 characters or fewer' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /api/files/[id]/copy returns 400 when the trimmed message exceeds 500', async () => {
    const { POST } = await import('@/app/api/files/[id]/copy/route');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST(
      new Request('http://localhost/api/files/f1/copy', {
        method: 'POST',
        body: JSON.stringify({
          clientName: 'Acme',
          share: 'anyone',
          message: 'y'.repeat(501),
        }),
      }),
      { params },
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'message must be 500 characters or fewer' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function stubShareFetch(opts: {
  ledgers: ShareLedger[];
  anyone?: { id: string; type: string; role: string }[];
}): { written: ShareLedger | null; fetchMock: ReturnType<typeof vi.fn> } {
  let mediaReads = 0;
  let written: ShareLedger | null = null;
  const fetchMock = vi.fn(async (target: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const u = new URL(target);

    if (u.searchParams.get('spaces') === 'appDataFolder') {
      return Response.json({ files: [{ id: 'ledger1' }] });
    }
    if (u.searchParams.get('alt') === 'media') {
      const stored = opts.ledgers[Math.min(mediaReads, opts.ledgers.length - 1)];
      mediaReads += 1;
      return Response.json(stored);
    }
    if (method === 'PATCH' && target.includes('/upload/')) {
      written = JSON.parse(String(init?.body)) as ShareLedger;
      return Response.json({ id: 'ledger1' });
    }
    if (u.pathname.endsWith('/permissions') && method === 'GET') {
      return Response.json({ permissions: opts.anyone ?? [] });
    }
    if (u.pathname.endsWith('/permissions') && method === 'POST') {
      return Response.json({ id: 'perm-new' });
    }
    return Response.json({
      id: 'f1',
      name: 'Deck',
      mimeType: 'application/pdf',
      modifiedTime: '2026-01-01T00:00:00.000Z',
      webViewLink: 'https://drive.google.com/f1',
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    get written() {
      return written;
    },
  } as { written: ShareLedger | null; fetchMock: ReturnType<typeof vi.fn> };
}

describe('share route ledger writes', () => {
  beforeEach(session);

  it('does not flag an app-managed anyone permission as external', async () => {
    const existing = entry({
      id: 'ours',
      kind: 'anyone',
      status: 'active',
      permissionId: 'anyoneWithLink',
      expiresAt: '2026-09-15T00:00:00.000Z',
    });
    const stub = stubShareFetch({
      ledgers: [ledger([existing]), ledger([existing])],
      anyone: [{ id: 'anyoneWithLink', type: 'anyone', role: 'reader' }],
    });

    const { POST } = await import('@/app/api/files/[id]/share/route');
    const res = await POST(
      new Request('http://localhost/api/files/f1/share', {
        method: 'POST',
        body: JSON.stringify({ mode: 'anyone', expiresInDays: 7 }),
      }),
      { params },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { entry: ShareEntry };
    expect(body.entry).toMatchObject({ id: 'ours', kind: 'anyone', status: 'active' });
    expect(body.entry.kind).not.toBe('external');
    expect(stub.written?.shares.find((s) => s.id === 'ours')?.kind).toBe('anyone');
    expect(
      stub.fetchMock.mock.calls.some(
        (call) => ((call[1] as RequestInit | undefined)?.method ?? 'GET') === 'POST',
      ),
    ).toBe(false);
  });

  it('re-reads the ledger before write and merges by id (new wins)', async () => {
    const swept = entry({
      id: 'swept',
      kind: 'anyone',
      status: 'expired',
      fileId: 'other',
      revokedBy: 'sweep',
    });
    const stub = stubShareFetch({
      ledgers: [ledger([]), ledger([swept])],
    });

    const { POST } = await import('@/app/api/files/[id]/share/route');
    const res = await POST(
      new Request('http://localhost/api/files/f1/share', {
        method: 'POST',
        body: JSON.stringify({ mode: 'anyone' }),
      }),
      { params },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { entry: ShareEntry };
    const ids = stub.written?.shares.map((s) => s.id).sort();
    expect(ids).toEqual([body.entry.id, 'swept'].sort());
    expect(stub.written?.shares.find((s) => s.id === 'swept')?.status).toBe('expired');
    expect(stub.written?.shares.find((s) => s.id === body.entry.id)?.status).toBe('active');
  });
});
