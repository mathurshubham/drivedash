import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addToAllowlist,
  decideRequest,
  ensureAllowlistSeeded,
  getAllowlist,
  getRequests,
  invalidateAllowlistCache,
  isAllowed,
  isAdminEmail,
  pruneRequests,
  removeFromAllowlist,
  resetAccessStateForTests,
  upsertRequest,
  type AccessStore,
} from '../access';

function mem(): AccessStore & { gets: number; puts: number; data: Map<string, string> } {
  const data = new Map<string, string>();
  const store = {
    gets: 0,
    puts: 0,
    data,
    async get(key: string) {
      store.gets += 1;
      return data.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.puts += 1;
      data.set(key, value);
    },
  };
  return store;
}

beforeEach(() => {
  resetAccessStateForTests();
  vi.stubEnv('ALLOWED_EMAILS', 'seed@example.com');
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isAllowed', () => {
  it('is true for admins even when they are not on the allowlist', async () => {
    const store = mem();
    await expect(isAllowed('admin@example.com', store)).resolves.toBe(true);
    await expect(isAllowed(' ADMIN@example.com ', store)).resolves.toBe(true);
    expect(isAdminEmail('admin@example.com')).toBe(true);
  });

  it('is true for allowlisted emails, case-insensitive and trimmed', async () => {
    const store = mem();
    await addToAllowlist('User@Example.com', 'admin@example.com', store);
    invalidateAllowlistCache();
    await expect(isAllowed(' user@example.com ', store)).resolves.toBe(true);
  });

  it('is false for unknown emails', async () => {
    const store = mem();
    await expect(isAllowed('stranger@example.com', store)).resolves.toBe(false);
    await expect(isAllowed(null, store)).resolves.toBe(false);
  });
});

describe('getAllowlist seed', () => {
  it('seeds from ALLOWED_EMAILS once when the seeded marker is absent', async () => {
    vi.stubEnv('ALLOWED_EMAILS', 'a@x.com, B@Y.com');
    const store = mem();
    await ensureAllowlistSeeded(store);
    await expect(getAllowlist(store)).resolves.toEqual(['a@x.com', 'b@y.com']);
    const raw = await store.get('allowlist');
    expect(JSON.parse(raw ?? '{}')).toMatchObject({
      version: 1,
      emails: ['a@x.com', 'b@y.com'],
      updatedBy: 'seed',
    });
    expect(await store.get('allowlist:seeded')).toBeTruthy();
  });

  it('getAllowlist is a pure read and does not write', async () => {
    vi.stubEnv('ALLOWED_EMAILS', 'a@x.com');
    const store = mem();
    const putsBefore = store.puts;
    await expect(getAllowlist(store)).resolves.toEqual([]);
    expect(store.puts).toBe(putsBefore);
    expect(await store.get('allowlist')).toBeNull();
  });

  it('does not rewrite the seed or wipe approvals on a later null allowlist read', async () => {
    const store = mem();
    await ensureAllowlistSeeded(store);
    await addToAllowlist('approved@x.com', 'admin@example.com', store);
    invalidateAllowlistCache();
    const before = await getAllowlist(store);
    expect(before).toEqual(expect.arrayContaining(['approved@x.com', 'seed@example.com']));

    const isolate = mem();
    await isolate.put('allowlist:seeded', (await store.get('allowlist:seeded'))!);
    const putsAfterMarker = isolate.puts;
    invalidateAllowlistCache();
    await expect(getAllowlist(isolate)).resolves.toEqual([]);
    expect(isolate.puts).toBe(putsAfterMarker);
    expect(await isolate.get('allowlist')).toBeNull();

    invalidateAllowlistCache();
    await expect(getAllowlist(store)).resolves.toEqual(before);
  });

  it('does not write an empty allowlist when ALLOWED_EMAILS is unset after seeding', async () => {
    const store = mem();
    await ensureAllowlistSeeded(store);
    await addToAllowlist('approved@x.com', 'admin@example.com', store);

    vi.stubEnv('ALLOWED_EMAILS', '');
    const isolate = mem();
    await isolate.put('allowlist:seeded', (await store.get('allowlist:seeded'))!);
    const putsAfterMarker = isolate.puts;
    invalidateAllowlistCache();
    await expect(getAllowlist(isolate)).resolves.toEqual([]);
    expect(isolate.puts).toBe(putsAfterMarker);
    expect(await isolate.get('allowlist')).toBeNull();

    await ensureAllowlistSeeded(isolate);
    expect(isolate.puts).toBe(putsAfterMarker);
    expect(await isolate.get('allowlist')).toBeNull();
  });

  it('does not repopulate from ALLOWED_EMAILS once the marker exists', async () => {
    vi.stubEnv('ALLOWED_EMAILS', 'a@x.com');
    const store = mem();
    await ensureAllowlistSeeded(store);
    store.data.delete('allowlist');
    vi.stubEnv('ALLOWED_EMAILS', 'a@x.com,b@y.com');
    invalidateAllowlistCache();
    await ensureAllowlistSeeded(store);
    await expect(getAllowlist(store)).resolves.toEqual([]);
    expect(store.data.has('allowlist')).toBe(false);
  });
});

describe('allowlist writes', () => {
  it('addToAllowlist dedupes', async () => {
    const store = mem();
    await addToAllowlist('user@x.com', 'admin@example.com', store);
    const again = await addToAllowlist('USER@x.com', 'admin@example.com', store);
    expect(again.filter((e) => e === 'user@x.com')).toHaveLength(1);
  });

  it('removeFromAllowlist refuses admins', async () => {
    const store = mem();
    await addToAllowlist('admin@example.com', 'admin@example.com', store);
    await expect(removeFromAllowlist('admin@example.com', 'admin@example.com', store)).rejects.toMatchObject({
      status: 400,
      message: 'cannot remove an admin',
    });
  });
});

describe('requests', () => {
  it('upsertRequest dedupes per email and updates note', async () => {
    const store = mem();
    await upsertRequest({ email: 'new@x.com', name: 'N', note: 'first' }, store);
    const second = await upsertRequest({ email: 'NEW@x.com', note: 'updated' }, store);
    expect(second.note).toBe('updated');
    expect(second.status).toBe('pending');
    const { getRequests } = await import('../access');
    const items = await getRequests(store);
    expect(items.filter((i) => i.email === 'new@x.com')).toHaveLength(1);
  });

  it("decideRequest('approved') adds to the allowlist", async () => {
    const store = mem();
    await upsertRequest({ email: 'new@x.com', note: 'please' }, store);
    const decided = await decideRequest('new@x.com', 'approved', 'admin@example.com', store);
    expect(decided.status).toBe('approved');
    invalidateAllowlistCache();
    await expect(isAllowed('new@x.com', store)).resolves.toBe(true);
  });

  it('leaves the request pending when the allowlist write throws', async () => {
    const store = mem();
    await ensureAllowlistSeeded(store);
    await upsertRequest({ email: 'new@x.com' }, store);
    const failing: AccessStore = {
      get: (key) => store.get(key),
      async put(key, value) {
        if (key === 'allowlist') throw new Error('kv write failed');
        return store.put(key, value);
      },
    };
    await expect(decideRequest('new@x.com', 'approved', 'admin@example.com', failing)).rejects.toThrow(
      'kv write failed',
    );
    const items = await getRequests(store);
    expect(items.find((i) => i.email === 'new@x.com')?.status).toBe('pending');
    invalidateAllowlistCache();
    await expect(isAllowed('new@x.com', store)).resolves.toBe(false);
  });

  it('enforces the 200 cap when every request is still pending', () => {
    const items = Array.from({ length: 205 }, (_, i) => ({
      email: `u${i}@x.com`,
      requestedAt: new Date(1_700_000_000_000 + i * 1000).toISOString(),
      status: 'pending' as const,
    }));
    const pruned = pruneRequests(items, 200);
    expect(pruned).toHaveLength(200);
    expect(pruned[0]?.email).toBe('u5@x.com');
    expect(pruned.at(-1)?.email).toBe('u204@x.com');
  });

  it('drops oldest decided requests before oldest pending ones', () => {
    const items = [
      { email: 'old-decided@x.com', requestedAt: '2020-01-01T00:00:00.000Z', status: 'approved' as const, decidedAt: '2020-01-02T00:00:00.000Z' },
      { email: 'old-pending@x.com', requestedAt: '2020-01-01T00:00:00.000Z', status: 'pending' as const },
      { email: 'new-pending@x.com', requestedAt: '2024-01-01T00:00:00.000Z', status: 'pending' as const },
    ];
    const pruned = pruneRequests(items, 2);
    expect(pruned.map((i) => i.email)).toEqual(['old-pending@x.com', 'new-pending@x.com']);
  });

  it('rejects a re-request within 7 days of a decline', async () => {
    const store = mem();
    await upsertRequest({ email: 'new@x.com' }, store);
    await decideRequest('new@x.com', 'declined', 'admin@example.com', store);
    await expect(upsertRequest({ email: 'new@x.com', note: 'again' }, store)).rejects.toMatchObject({
      status: 429,
    });
  });
});

describe('allowlist cache', () => {
  it('second getAllowlist within 60s does not hit the store; invalidate forces a read', async () => {
    const store = mem();
    await store.put(
      'allowlist',
      JSON.stringify({
        version: 1,
        emails: ['cached@example.com'],
        updatedAt: new Date().toISOString(),
        updatedBy: 't',
      }),
    );
    store.gets = 0;

    await getAllowlist(store);
    expect(store.gets).toBe(1);
    await getAllowlist(store);
    expect(store.gets).toBe(1);

    invalidateAllowlistCache();
    await getAllowlist(store);
    expect(store.gets).toBe(2);
  });
});
