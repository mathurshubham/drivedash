import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addToAllowlist,
  decideRequest,
  getAllowlist,
  invalidateAllowlistCache,
  isAllowed,
  isAdminEmail,
  removeFromAllowlist,
  resetAccessStateForTests,
  upsertRequest,
  type AccessStore,
} from '../access';

function mem(): AccessStore & { gets: number } {
  const map = new Map<string, string>();
  const store = {
    gets: 0,
    async get(key: string) {
      store.gets += 1;
      return map.get(key) ?? null;
    },
    async put(key: string, value: string) {
      map.set(key, value);
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
  it('seeds from ALLOWED_EMAILS when KV has no allowlist and writes it', async () => {
    vi.stubEnv('ALLOWED_EMAILS', 'a@x.com, B@Y.com');
    const store = mem();
    await expect(getAllowlist(store)).resolves.toEqual(['a@x.com', 'b@y.com']);
    const raw = await store.get('allowlist');
    expect(JSON.parse(raw ?? '{}')).toMatchObject({
      version: 1,
      emails: ['a@x.com', 'b@y.com'],
      updatedBy: 'seed',
    });
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
