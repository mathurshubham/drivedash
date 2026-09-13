/**
 * `DELETE /api/account` orchestration.
 *
 * Every collaborator is stubbed; what is under test is the *order* the steps
 * run in and the fact that one failing step never stops the rest. Order is the
 * load-bearing part: shares are revoked while the ledger naming them still
 * exists, and Google's grant is handed back only after every step that needed
 * the token has run.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetAccessStateForTests, type AccessStore } from '../access';
import { resetKvBudgetForTests } from '../kv-budget';
import type { ShareEntry, UserRecord, UsersDoc } from '../types';

const T0 = Date.parse('2026-09-13T09:00:00.000Z');

/* -------------------------------------------------------------------------- */
/* Stubs                                                                       */
/* -------------------------------------------------------------------------- */

const calls: string[] = [];

const requireTokenForDeletion = vi.fn();
const readLedger = vi.fn();
const revokePermission = vi.fn();
const deleteAppDataFiles = vi.fn();
const revokeGoogleToken = vi.fn();
const removeSelf = vi.fn();

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, requireTokenForDeletion: (req: Request) => requireTokenForDeletion(req) };
});

vi.mock('@/lib/shares', () => ({
  readLedger: (...a: unknown[]) => readLedger(...a),
  revokePermission: (...a: unknown[]) => revokePermission(...a),
}));

vi.mock('@/lib/appdata', () => ({
  deleteAppDataFiles: (...a: unknown[]) => deleteAppDataFiles(...a),
  revokeGoogleToken: (...a: unknown[]) => revokeGoogleToken(...a),
}));

vi.mock('@/lib/access', async () => {
  const actual = await vi.importActual<typeof import('@/lib/access')>('@/lib/access');
  return { ...actual, removeUserRecordForSelf: (...a: unknown[]) => removeSelf(...a) };
});

function entry(over: Partial<ShareEntry> = {}): ShareEntry {
  return {
    id: over.id ?? 's1',
    kind: 'anyone',
    status: 'active',
    fileId: 'f1',
    fileName: 'Deck',
    webViewLink: 'https://drive.google.com/f1',
    permissionId: 'p1',
    createdAt: '2026-09-01T00:00:00.000Z',
    expiresAt: null,
    ...over,
  };
}

async function callDelete(body?: unknown): Promise<Response> {
  const { DELETE } = await import('@/app/api/account/route');
  return DELETE(
    new Request('http://localhost:3000/api/account', {
      method: 'DELETE',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

beforeEach(() => {
  calls.length = 0;
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
  vi.stubEnv('MAX_USERS', '3');
  resetAccessStateForTests();
  resetKvBudgetForTests(T0);

  requireTokenForDeletion.mockResolvedValue({
    token: 'at',
    email: 'user@example.com',
    claims: { refreshToken: 'rt' },
  });
  readLedger.mockImplementation(async () => {
    calls.push('readLedger');
    return { version: 1, lastSweepAt: null, shares: [entry()] };
  });
  revokePermission.mockImplementation(async (_t: string, e: ShareEntry) => {
    calls.push(`revoke:${e.id}`);
    return 'revoked';
  });
  deleteAppDataFiles.mockImplementation(async () => {
    calls.push('deleteAppDataFiles');
    return [
      { name: 'hotlist.json', ok: true },
      { name: 'shares.json', ok: true },
    ];
  });
  removeSelf.mockImplementation(async (email: string) => {
    calls.push(`removeUserRecordForSelf:${email}`);
    return 'removed';
  });
  revokeGoogleToken.mockImplementation(async (t: string) => {
    calls.push(`revokeGoogleToken:${t}`);
    return { ok: true };
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('DELETE /api/account orchestration', () => {
  it('revokes shares before deleting the files that record them, and the grant last', async () => {
    const res = await callDelete({ revokeShares: true });
    expect(res.status).toBe(200);

    expect(calls).toEqual([
      'readLedger',
      'revoke:s1',
      'deleteAppDataFiles',
      'removeUserRecordForSelf:user@example.com',
      'revokeGoogleToken:rt',
      'revokeGoogleToken:at',
    ]);

    const body = (await res.json()) as { steps: Array<{ step: string; ok: boolean }> };
    expect(body.steps.map((s) => s.step)).toEqual([
      'revokeShares',
      'appDataFiles',
      'registry',
      'googleAccess',
    ]);
    expect(body.steps.every((s) => s.ok)).toBe(true);
  });

  it('defaults revokeShares to true when the body omits it', async () => {
    await callDelete({});
    expect(calls).toContain('revoke:s1');
  });

  it('skips the share pass — and only that pass — when revokeShares is false', async () => {
    const res = await callDelete({ revokeShares: false });
    const body = (await res.json()) as { steps: Array<{ step: string }> };

    expect(readLedger).not.toHaveBeenCalled();
    expect(revokePermission).not.toHaveBeenCalled();
    expect(body.steps.map((s) => s.step)).toEqual(['appDataFiles', 'registry', 'googleAccess']);
  });

  it('only revokes active entries that carry a permission id', async () => {
    readLedger.mockResolvedValue({
      version: 1,
      lastSweepAt: null,
      shares: [
        entry({ id: 'live' }),
        entry({ id: 'gone', status: 'revoked' }),
        entry({ id: 'no-perm', permissionId: undefined }),
        entry({ id: 'external', kind: 'external' }),
        entry({ id: 'copy', kind: 'copy' }),
        entry({ id: 'mail', kind: 'email' }),
      ],
    });

    await callDelete({ revokeShares: true });
    expect(revokePermission.mock.calls.map(([, e]) => (e as ShareEntry).id)).toEqual([
      'live',
      'copy',
      'mail',
    ]);
  });

  it('continues past a failing step and reports it, still answering 200', async () => {
    deleteAppDataFiles.mockRejectedValue(new Error('drive exploded'));

    const res = await callDelete({ revokeShares: true });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { steps: Array<{ step: string; ok: boolean; detail?: string }> };
    const byStep = Object.fromEntries(body.steps.map((s) => [s.step, s]));
    expect(byStep.appDataFiles).toEqual({
      step: 'appDataFiles',
      ok: false,
      detail: 'drive exploded',
    });
    // The later steps still ran.
    expect(byStep.registry.ok).toBe(true);
    expect(byStep.googleAccess.ok).toBe(true);
    expect(calls).toContain('removeUserRecordForSelf:user@example.com');
  });

  it('reports a partial share revocation without failing the request', async () => {
    revokePermission.mockRejectedValue(new Error('nope'));

    const res = await callDelete({ revokeShares: true });
    const body = (await res.json()) as { steps: Array<{ step: string; ok: boolean; detail?: string }> };
    const revoke = body.steps.find((s) => s.step === 'revokeShares');

    expect(revoke).toEqual({ step: 'revokeShares', ok: false, detail: '0 of 1 revoked' });
    expect(calls).toContain('deleteAppDataFiles');
  });

  it('answers 401 and touches nothing when there is no session', async () => {
    const { ApiHttpError } = await import('@/lib/api');
    requireTokenForDeletion.mockRejectedValue(new ApiHttpError(401, 'unauthorized'));

    const res = await callDelete({});
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(calls).toEqual([]);
  });

  it('revokes only the access token when the session carries no refresh token', async () => {
    requireTokenForDeletion.mockResolvedValue({ token: 'at', email: 'u@x.com', claims: {} });
    await callDelete({ revokeShares: false });
    expect(calls.filter((c) => c.startsWith('revokeGoogleToken'))).toEqual(['revokeGoogleToken:at']);
  });
});

/* -------------------------------------------------------------------------- */
/* The registry step itself, against a real in-memory KV                       */
/* -------------------------------------------------------------------------- */

function mem(): AccessStore & { puts: number; data: Map<string, string> } {
  const data = new Map<string, string>();
  const store = {
    puts: 0,
    data,
    async get(key: string) {
      return data.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.puts += 1;
      data.set(key, value);
    },
  };
  return store;
}

function seed(store: { data: Map<string, string> }, records: UserRecord[]): void {
  store.data.set('users', JSON.stringify({ version: 1, users: records } satisfies UsersDoc));
}

function stored(store: { data: Map<string, string> }): UserRecord[] {
  const raw = store.data.get('users');
  return raw ? (JSON.parse(raw) as UsersDoc).users : [];
}

function record(email: string, over: Partial<UserRecord> = {}): UserRecord {
  return {
    email,
    firstSeenAt: '2026-09-01T00:00:00.000Z',
    lastSeenAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

/** The real function, not the route-level stub installed above. */
async function removeUserRecordForSelf(email: string, store: AccessStore) {
  const actual = await vi.importActual<typeof import('../access')>('../access');
  return actual.removeUserRecordForSelf(email, store);
}

describe('removeUserRecordForSelf', () => {
  it('removes a non-admin record and frees the seat', async () => {
    const store = mem();
    seed(store, [record('user@example.com'), record('other@example.com')]);

    await expect(removeUserRecordForSelf('User@Example.com', store)).resolves.toBe('removed');
    expect(stored(store).map((u) => u.email)).toEqual(['other@example.com']);
    expect(store.puts).toBe(1);
  });

  it('removes a blocked record too — unlike admin removal, no unblock first', async () => {
    const store = mem();
    seed(store, [record('user@example.com', { blocked: true })]);

    await expect(removeUserRecordForSelf('user@example.com', store)).resolves.toBe('removed');
    expect(stored(store)).toEqual([]);
  });

  it('is a no-op for an admin: admins are never registered', async () => {
    const store = mem();
    seed(store, [record('user@example.com')]);

    await expect(removeUserRecordForSelf('admin@example.com', store)).resolves.toBe('admin');
    expect(stored(store).map((u) => u.email)).toEqual(['user@example.com']);
    expect(store.puts).toBe(0);
  });

  it('is a no-op when there is no record, and writes nothing', async () => {
    const store = mem();
    seed(store, [record('other@example.com')]);

    await expect(removeUserRecordForSelf('user@example.com', store)).resolves.toBe('not-found');
    expect(store.puts).toBe(0);
  });
});
