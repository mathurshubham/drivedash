import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AccessError,
  blockUser,
  invalidateCache,
  isAdminEmail,
  listUsers,
  maxUsers,
  normalizeEmail,
  removeUser,
  resetAccessStateForTests,
  resolveAccess,
  sanitizeName,
  unblockUser,
  type AccessStore,
} from '../access';
import { SOFT_LIMIT, guardedPut, resetKvBudgetForTests } from '../kv-budget';
import type { UserRecord, UsersDoc } from '../types';

const T0 = Date.parse('2026-09-13T09:00:00.000Z');
const HOUR = 60 * 60 * 1000;

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

function users(store: { data: Map<string, string> }): UserRecord[] {
  const raw = store.data.get('users');
  return raw ? (JSON.parse(raw) as UsersDoc).users : [];
}

beforeEach(() => {
  resetAccessStateForTests();
  resetKvBudgetForTests(T0);
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');
  vi.stubEnv('MAX_USERS', '3');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('maxUsers', () => {
  it('defaults to 30 and clamps to 1..100', () => {
    vi.stubEnv('MAX_USERS', '');
    expect(maxUsers()).toBe(30);
    vi.stubEnv('MAX_USERS', 'lots');
    expect(maxUsers()).toBe(30);
    vi.stubEnv('MAX_USERS', '0');
    expect(maxUsers()).toBe(30);
    vi.stubEnv('MAX_USERS', '-5');
    expect(maxUsers()).toBe(30);
    vi.stubEnv('MAX_USERS', '2.5');
    expect(maxUsers()).toBe(30);
    vi.stubEnv('MAX_USERS', '1');
    expect(maxUsers()).toBe(1);
    vi.stubEnv('MAX_USERS', '250');
    expect(maxUsers()).toBe(100);
  });
});

describe('helpers', () => {
  it('normalizes emails and sanitizes names', () => {
    expect(normalizeEmail(' USER@Example.com ')).toBe('user@example.com');
    const name = `${'A'.repeat(320)}\u0007`;
    expect(sanitizeName(name)).toHaveLength(300);
    expect(sanitizeName(name)).not.toContain('\u0007');
  });
});

describe('resolveAccess — admins', () => {
  it('allows admins without reading or writing the registry', async () => {
    const store = mem();
    await expect(resolveAccess(' ADMIN@Example.com ', 'A', store)).resolves.toEqual({
      allowed: true,
      isAdmin: true,
    });
    expect(store.gets).toBe(0);
    expect(store.puts).toBe(0);
    expect(isAdminEmail('admin@example.com')).toBe(true);
  });

  it('does not count admins against the cap', async () => {
    vi.stubEnv('MAX_USERS', '1');
    const store = mem();
    await resolveAccess('admin@example.com', undefined, store);
    await expect(resolveAccess('one@x.com', undefined, store)).resolves.toEqual({
      allowed: true,
      isAdmin: false,
    });
    expect(users(store).map((u) => u.email)).toEqual(['one@x.com']);
  });
});

describe('resolveAccess — registration', () => {
  it('registers a new user under the cap in one write', async () => {
    const store = mem();
    await expect(
      resolveAccess('New@X.com', ' New User ', store, { now: T0 }),
    ).resolves.toEqual({ allowed: true, isAdmin: false });
    expect(store.puts).toBe(1);
    expect(users(store)).toEqual([
      {
        email: 'new@x.com',
        name: 'New User',
        firstSeenAt: new Date(T0).toISOString(),
        lastSeenAt: new Date(T0).toISOString(),
      },
    ]);
  });

  it('refuses with reason "full" at the cap and writes nothing', async () => {
    vi.stubEnv('MAX_USERS', '2');
    const store = mem();
    await resolveAccess('a@x.com', undefined, store, { now: T0 });
    await resolveAccess('b@x.com', undefined, store, { now: T0 });
    const putsBefore = store.puts;

    await expect(resolveAccess('c@x.com', undefined, store, { now: T0 })).resolves.toEqual({
      allowed: false,
      reason: 'full',
    });
    expect(store.puts).toBe(putsBefore);
    expect(users(store)).toHaveLength(2);
  });

  it('re-reads past the cache before appending so the cap sees fresh data', async () => {
    vi.stubEnv('MAX_USERS', '1');
    const store = mem();
    await resolveAccess('a@x.com', undefined, store, { now: T0 });

    // Another isolate took the last slot; our cache still says the registry is empty.
    store.data.set(
      'users',
      JSON.stringify({
        version: 1,
        users: [{ email: 'other@x.com', firstSeenAt: 'x', lastSeenAt: 'x' }],
      }),
    );
    await expect(resolveAccess('b@x.com', undefined, store, { now: T0 })).resolves.toEqual({
      allowed: false,
      reason: 'full',
    });
  });
});

describe('resolveAccess — lastSeenAt refresh', () => {
  it('skips the write inside 24h and refreshes after it', async () => {
    const store = mem();
    await resolveAccess('u@x.com', 'Old', store, { now: T0 });
    const putsAfterRegister = store.puts;

    await resolveAccess('u@x.com', 'Old', store, { now: T0 + 23 * HOUR });
    expect(store.puts).toBe(putsAfterRegister);

    await resolveAccess('u@x.com', 'New Name', store, { now: T0 + 25 * HOUR });
    expect(store.puts).toBe(putsAfterRegister + 1);
    expect(users(store)[0]).toMatchObject({
      lastSeenAt: new Date(T0 + 25 * HOUR).toISOString(),
      firstSeenAt: new Date(T0).toISOString(),
      name: 'New Name',
    });
  });

  it('treats the refresh as an optional write that the budget may drop', async () => {
    const store = mem();
    const stale = new Date(T0 - 48 * HOUR).toISOString();
    store.data.set(
      'users',
      JSON.stringify({ version: 1, users: [{ email: 'u@x.com', firstSeenAt: stale, lastSeenAt: stale }] }),
    );
    // Burn the isolate's soft budget for this UTC day on unrelated essential writes.
    for (let i = 0; i < SOFT_LIMIT; i += 1) {
      await guardedPut({ async put() {} }, 'noop', '{}', 'essential', T0);
    }
    const putsBefore = store.puts;
    await resolveAccess('u@x.com', undefined, store, { now: T0 });
    expect(store.puts).toBe(putsBefore);
    expect(users(store)[0]?.lastSeenAt).toBe(stale);
  });
});

describe('block / unblock / remove', () => {
  it('blocks, unblocks, and keeps the slot while blocked', async () => {
    vi.stubEnv('MAX_USERS', '1');
    const store = mem();
    await resolveAccess('u@x.com', undefined, store, { now: T0 });

    await blockUser('U@X.com', 'admin@example.com', store);
    await expect(resolveAccess('u@x.com', undefined, store, { now: T0 })).resolves.toEqual({
      allowed: false,
      reason: 'blocked',
    });
    // The blocked record still holds the only slot.
    await expect(resolveAccess('other@x.com', undefined, store, { now: T0 })).resolves.toEqual({
      allowed: false,
      reason: 'full',
    });

    await unblockUser('u@x.com', 'admin@example.com', store);
    await expect(resolveAccess('u@x.com', undefined, store, { now: T0 })).resolves.toEqual({
      allowed: true,
      isAdmin: false,
    });
    expect(users(store)[0]?.blocked).toBeUndefined();
  });

  it('skips no-op block writes and 404s on unknown users', async () => {
    const store = mem();
    await resolveAccess('u@x.com', undefined, store, { now: T0 });
    await blockUser('u@x.com', 'admin@example.com', store);
    const putsBefore = store.puts;
    await blockUser('u@x.com', 'admin@example.com', store);
    expect(store.puts).toBe(putsBefore);

    await expect(blockUser('ghost@x.com', 'admin@example.com', store)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('refuses to block or remove an admin', async () => {
    const store = mem();
    await expect(blockUser('admin@example.com', 'admin@example.com', store)).rejects.toBeInstanceOf(
      AccessError,
    );
    await expect(removeUser('admin@example.com', 'admin@example.com', store)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('removing a user frees a slot; removing an unknown user writes nothing', async () => {
    vi.stubEnv('MAX_USERS', '1');
    const store = mem();
    await resolveAccess('u@x.com', undefined, store, { now: T0 });
    await expect(resolveAccess('next@x.com', undefined, store, { now: T0 })).resolves.toEqual({
      allowed: false,
      reason: 'full',
    });

    await removeUser('u@x.com', 'admin@example.com', store);
    expect(users(store)).toHaveLength(0);
    await expect(resolveAccess('next@x.com', undefined, store, { now: T0 })).resolves.toEqual({
      allowed: true,
      isAdmin: false,
    });

    const putsBefore = store.puts;
    await removeUser('ghost@x.com', 'admin@example.com', store);
    expect(store.puts).toBe(putsBefore);
  });
});

describe('migration from the legacy allowlist', () => {
  it('imports legacy emails once, in a single write, and never re-reads the key', async () => {
    const store = mem();
    store.data.set(
      'allowlist',
      JSON.stringify({
        version: 1,
        emails: ['Legacy@X.com', 'legacy@x.com', 'admin@example.com', 'second@x.com'],
        updatedAt: new Date(T0).toISOString(),
        updatedBy: 'seed',
      }),
    );

    await expect(resolveAccess('legacy@x.com', undefined, store, { now: T0 })).resolves.toEqual({
      allowed: true,
      isAdmin: false,
    });
    // One write for the migration; the known user needs no second write.
    expect(store.puts).toBe(1);
    expect(users(store).map((u) => u.email)).toEqual(['legacy@x.com', 'second@x.com']);

    const getsBefore = store.gets;
    invalidateCache();
    await listUsers(store);
    // Only the `users` key is read from now on.
    expect(store.gets).toBe(getsBefore + 1);
  });

  it('writes nothing when there is no legacy allowlist', async () => {
    const store = mem();
    await expect(listUsers(store)).resolves.toEqual([]);
    expect(store.puts).toBe(0);
  });
});

describe('cache', () => {
  it('caches reads for 60s and invalidates after a write', async () => {
    const store = mem();
    store.data.set(
      'users',
      JSON.stringify({
        version: 1,
        users: [{ email: 'cached@x.com', firstSeenAt: 'x', lastSeenAt: 'x' }],
      }),
    );
    store.gets = 0;

    await listUsers(store);
    expect(store.gets).toBe(1);
    await listUsers(store);
    expect(store.gets).toBe(1);

    invalidateCache();
    await listUsers(store);
    expect(store.gets).toBe(2);

    await removeUser('cached@x.com', 'admin@example.com', store);
    const getsAfterWrite = store.gets;
    await listUsers(store);
    expect(store.gets).toBe(getsAfterWrite + 1);
  });
});
