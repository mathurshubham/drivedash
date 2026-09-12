import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAnyonePermission,
  createEmailPermission,
  expiryToDate,
  findActiveAnyoneEntry,
  mergeSharesById,
  mergeWriteLedger,
  pruneLedger,
  revokePermission,
  sanitizeMessage,
  sweep,
  validateLedger,
} from '../shares';
import type { ShareEntry, ShareLedger } from '../types';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('expiryToDate', () => {
  const now = new Date('2026-09-12T12:00:00.000Z');

  it('returns exact day offsets', () => {
    expect(expiryToDate(1, now)).toBe('2026-09-13T12:00:00.000Z');
    expect(expiryToDate(3, now)).toBe('2026-09-15T12:00:00.000Z');
    expect(expiryToDate(7, now)).toBe('2026-09-19T12:00:00.000Z');
  });

  it('returns null when there is no expiry', () => {
    expect(expiryToDate(null, now)).toBeNull();
  });
});

describe('pruneLedger', () => {
  it('keeps all active, drops oldest non-active first, respects cap', () => {
    const shares: ShareEntry[] = [
      entry({ id: 'a1', kind: 'anyone', status: 'active', createdAt: '2026-01-03T00:00:00.000Z' }),
      entry({ id: 'a2', kind: 'anyone', status: 'active', createdAt: '2026-01-04T00:00:00.000Z' }),
      entry({ id: 'e1', kind: 'anyone', status: 'expired', createdAt: '2026-01-01T00:00:00.000Z' }),
      entry({ id: 'e2', kind: 'anyone', status: 'revoked', createdAt: '2026-01-02T00:00:00.000Z' }),
      entry({ id: 'e3', kind: 'anyone', status: 'expired', createdAt: '2026-01-05T00:00:00.000Z' }),
    ];
    const pruned = pruneLedger(ledger(shares), 3);
    expect(pruned.shares.map((s) => s.id).sort()).toEqual(['a1', 'a2', 'e3']);
  });

  it('drops oldest overall when active entries exceed the cap', () => {
    const shares: ShareEntry[] = [
      entry({ id: 'a1', kind: 'anyone', status: 'active', createdAt: '2026-01-01T00:00:00.000Z' }),
      entry({ id: 'a2', kind: 'anyone', status: 'active', createdAt: '2026-01-02T00:00:00.000Z' }),
      entry({ id: 'a3', kind: 'anyone', status: 'active', createdAt: '2026-01-03T00:00:00.000Z' }),
    ];
    const pruned = pruneLedger(ledger(shares), 2);
    expect(pruned.shares.map((s) => s.id).sort()).toEqual(['a2', 'a3']);
  });
});

describe('sanitizeMessage', () => {
  it('trims, strips C0 controls except newline, and caps at 500', () => {
    expect(sanitizeMessage('  hello  ')).toBe('hello');
    expect(sanitizeMessage('a\u0000b\nc\td')).toBe('ab\ncd');
    expect(sanitizeMessage('x'.repeat(600))).toHaveLength(500);
  });
});

describe('validateLedger', () => {
  it('accepts a well-formed ledger', () => {
    expect(validateLedger(defaultLike())).toBe(true);
    expect(
      validateLedger(
        ledger([
          entry({
            id: 's1',
            kind: 'email',
            status: 'active',
            email: 'a@b.com',
            notified: true,
            nativeExpiry: true,
            permissionId: 'p1',
            expiresAt: '2026-09-15T00:00:00.000Z',
          }),
        ]),
      ),
    ).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['wrong version', { version: 2, lastSweepAt: null, shares: [] }],
    ['missing shares', { version: 1, lastSweepAt: null }],
    ['bad lastSweepAt', { version: 1, lastSweepAt: 1, shares: [] }],
    [
      'an entry with an unknown kind',
      { version: 1, lastSweepAt: null, shares: [{ ...entry({ id: 'x', kind: 'anyone', status: 'active' }), kind: 'nope' }] },
    ],
    [
      'an entry missing createdAt',
      {
        version: 1,
        lastSweepAt: null,
        shares: [
          {
            id: 'x',
            kind: 'anyone',
            status: 'active',
            fileId: 'f',
            fileName: 'n',
            webViewLink: 'l',
            expiresAt: null,
          },
        ],
      },
    ],
  ])('rejects %s', (_label, input) => {
    expect(validateLedger(input)).toBe(false);
  });
});

function defaultLike(): ShareLedger {
  return { version: 1, lastSweepAt: null, shares: [] };
}

describe('createEmailPermission (stubbed fetch)', () => {
  it('sends notify, message, and expirationTime', async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: 'perm1', expirationTime: '2026-09-15T00:00:00.000Z' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createEmailPermission('tok', 'f1', {
      email: 'a@b.com',
      notify: true,
      message: 'Please review',
      expiresAt: '2026-09-15T00:00:00.000Z',
    });

    expect(result).toEqual({ permissionId: 'perm1', nativeExpiry: true });
    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const url = new URL(target);
    expect(url.searchParams.get('fields')).toBe('id,expirationTime');
    expect(url.searchParams.get('sendNotificationEmail')).toBe('true');
    expect(url.searchParams.get('emailMessage')).toBe('Please review');
    expect(JSON.parse(String(init.body))).toEqual({
      role: 'reader',
      type: 'user',
      emailAddress: 'a@b.com',
      expirationTime: '2026-09-15T00:00:00.000Z',
    });
  });

  it('retries without expirationTime on a 400 that mentions it', async () => {
    const fetchMock = vi.fn(async (_target: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { expirationTime?: string };
      if (body.expirationTime) {
        return Response.json({ error: { message: 'expirationTime is not allowed' } }, { status: 400 });
      }
      return Response.json({ id: 'perm2' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createEmailPermission('tok', 'f1', {
      email: 'a@b.com',
      notify: false,
      expiresAt: '2026-09-15T00:00:00.000Z',
    });

    expect(result).toEqual({ permissionId: 'perm2', nativeExpiry: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = JSON.parse(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body));
    expect(second.expirationTime).toBeUndefined();
  });

  it('reports nativeExpiry false when Drive accepts the POST but drops expirationTime', async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: 'perm3' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createEmailPermission('tok', 'f1', {
      email: 'a@b.com',
      notify: false,
      expiresAt: '2026-09-15T00:00:00.000Z',
    });

    expect(result).toEqual({ permissionId: 'perm3', nativeExpiry: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(target).searchParams.get('fields')).toBe('id,expirationTime');
    expect(JSON.parse(String(init.body)).expirationTime).toBe('2026-09-15T00:00:00.000Z');
  });
});

describe('createAnyonePermission (stubbed fetch)', () => {
  it('posts an anyone-reader permission', async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: 'anyoneWithLink' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createAnyonePermission('tok', 'f1')).resolves.toEqual({
      permissionId: 'anyoneWithLink',
    });

    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(target).toContain('/files/f1/permissions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ role: 'reader', type: 'anyone' });
  });
});

describe('revokePermission (stubbed fetch)', () => {
  const live = entry({
    id: 's1',
    kind: 'anyone',
    status: 'active',
    permissionId: 'perm1',
    fileId: 'f1',
  });

  it('DELETEs the ledger permission id', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(revokePermission('tok', live)).resolves.toBe('revoked');

    const [target, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('DELETE');
    expect(target).toBe('https://www.googleapis.com/drive/v3/files/f1/permissions/perm1');
  });

  it('maps 404 to already-gone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: { message: 'not found' } }, { status: 404 })),
    );
    await expect(revokePermission('tok', live)).resolves.toBe('already-gone');
  });

  it('throws on external entries and missing permissionId', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      revokePermission('tok', entry({ id: 'e', kind: 'external', status: 'external', permissionId: 'p' })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      revokePermission('tok', entry({ id: 'a', kind: 'anyone', status: 'active' })),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function stubLedgerFetch(stored: ShareLedger, opts?: { deleteStatus?: number }) {
  const fetchMock = vi.fn(async (target: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const u = new URL(target);
    if (u.searchParams.get('spaces') === 'appDataFolder') {
      return Response.json({ files: [{ id: 'ledger1' }] });
    }
    if (u.searchParams.get('alt') === 'media') {
      return Response.json(stored);
    }
    if (method === 'DELETE') {
      if (opts?.deleteStatus && opts.deleteStatus !== 204) {
        return Response.json({ error: { message: 'boom' } }, { status: opts.deleteStatus });
      }
      return new Response(null, { status: 204 });
    }
    return Response.json({ id: 'ok' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function deleteCalls(mock: ReturnType<typeof vi.fn>): Array<[string, RequestInit]> {
  return mock.mock.calls.filter((call) => {
    const init = call[1] as RequestInit | undefined;
    return (init?.method ?? 'GET').toUpperCase() === 'DELETE';
  }) as Array<[string, RequestInit]>;
}

describe('sweep (stubbed fetch)', () => {
  const now = new Date('2026-09-12T12:00:00.000Z');

  it('revokes an expired anyone share via DELETE', async () => {
    const stored = ledger([
      entry({
        id: 's1',
        kind: 'anyone',
        status: 'active',
        permissionId: 'perm1',
        expiresAt: '2026-09-11T00:00:00.000Z',
      }),
    ]);
    const fetchMock = stubLedgerFetch(stored);

    const result = await sweep('tok', now);
    const updated = result.ledger.shares[0];

    expect(result.revoked).toBe(1);
    expect(result.expired).toBe(0);
    expect(result.failed).toBe(0);
    expect(updated.status).toBe('expired');
    expect(updated.revokedBy).toBe('sweep');
    expect(deleteCalls(fetchMock)).toHaveLength(1);
    expect(deleteCalls(fetchMock)[0][0]).toContain('/permissions/perm1');
  });

  it('marks native-expiry email shares expired without a DELETE', async () => {
    const stored = ledger([
      entry({
        id: 's1',
        kind: 'email',
        status: 'active',
        permissionId: 'perm1',
        email: 'a@b.com',
        nativeExpiry: true,
        expiresAt: '2026-09-11T00:00:00.000Z',
      }),
    ]);
    const fetchMock = stubLedgerFetch(stored);

    const result = await sweep('tok', now);
    expect(result.revoked).toBe(0);
    expect(result.expired).toBe(1);
    expect(result.ledger.shares[0].revokedBy).toBe('google');
    expect(deleteCalls(fetchMock)).toHaveLength(0);
  });

  it('leaves not-yet-expired and never-expiring entries untouched', async () => {
    const stored = ledger(
      [
        entry({
          id: 'future',
          kind: 'anyone',
          status: 'active',
          permissionId: 'p1',
          expiresAt: '2026-09-20T00:00:00.000Z',
        }),
        entry({
          id: 'forever',
          kind: 'anyone',
          status: 'active',
          permissionId: 'p2',
          expiresAt: null,
        }),
      ],
      now.toISOString(),
    );
    const fetchMock = stubLedgerFetch(stored);

    const result = await sweep('tok', now);
    expect(result.revoked).toBe(0);
    expect(result.expired).toBe(0);
    expect(result.ledger.shares.every((s) => s.status === 'active')).toBe(true);
    expect(deleteCalls(fetchMock)).toHaveLength(0);
  });

  it('leaves the entry active and counts failed when Drive returns 500', async () => {
    const stored = ledger([
      entry({
        id: 's1',
        kind: 'anyone',
        status: 'active',
        permissionId: 'perm1',
        expiresAt: '2026-09-11T00:00:00.000Z',
      }),
    ]);
    stubLedgerFetch(stored, { deleteStatus: 500 });

    const result = await sweep('tok', now);
    expect(result.failed).toBe(1);
    expect(result.revoked).toBe(0);
    expect(result.ledger.shares[0].status).toBe('active');
  });
});

describe('mergeSharesById', () => {
  it('unions stored and incoming, incoming wins on id collision', () => {
    const stored = [
      entry({ id: 'keep', kind: 'anyone', status: 'expired' }),
      entry({ id: 'clash', kind: 'email', status: 'active', email: 'old@x.com' }),
    ];
    const incoming = [
      entry({ id: 'clash', kind: 'email', status: 'revoked', email: 'new@x.com' }),
      entry({ id: 'fresh', kind: 'anyone', status: 'active' }),
    ];
    const merged = mergeSharesById(stored, incoming);
    expect(merged.map((s) => s.id).sort()).toEqual(['clash', 'fresh', 'keep']);
    expect(merged.find((s) => s.id === 'clash')).toMatchObject({
      status: 'revoked',
      email: 'new@x.com',
    });
    expect(merged.find((s) => s.id === 'keep')?.status).toBe('expired');
  });

  it('mergeWriteLedger re-reads then writes the union', async () => {
    const stored = ledger([
      entry({ id: 'swept', kind: 'anyone', status: 'expired', fileId: 'other' }),
    ]);
    stubLedgerFetch(stored);
    const incoming = entry({ id: 'fresh', kind: 'anyone', status: 'active' });
    const result = await mergeWriteLedger('tok', [incoming]);
    expect(result.shares.map((s) => s.id).sort()).toEqual(['fresh', 'swept']);
  });
});

describe('findActiveAnyoneEntry', () => {
  it('finds an active anyone or copy-anyone row for the file', () => {
    const l = ledger([
      entry({ id: 'ext', kind: 'external', status: 'external', fileId: 'f1' }),
      entry({
        id: 'dead',
        kind: 'anyone',
        status: 'revoked',
        fileId: 'f1',
        permissionId: 'old',
      }),
      entry({
        id: 'copy',
        kind: 'copy',
        status: 'active',
        fileId: 'f2',
        shareKind: 'anyone',
        permissionId: 'c1',
      }),
    ]);
    expect(findActiveAnyoneEntry(l, 'f1')).toBeUndefined();
    expect(findActiveAnyoneEntry(l, 'f2')?.id).toBe('copy');

    const withAnyone = ledger([
      ...l.shares,
      entry({ id: 'live', kind: 'anyone', status: 'active', fileId: 'f1', permissionId: 'p1' }),
    ]);
    expect(findActiveAnyoneEntry(withAnyone, 'f1')?.id).toBe('live');
  });
});
