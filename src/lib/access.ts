/**
 * KV-backed user registry for open signup behind a hard cap. No next-auth
 * import — unit testable like `token.ts`. Falls back to an in-memory Map when
 * the ACCESS binding is missing (tests, misconfiguration).
 *
 * One key, `users`, holds every non-admin account that has ever signed in.
 * Admins (`ADMIN_EMAILS`) are always allowed, are never stored, and never count
 * against the cap. Blocked users keep their slot until an admin removes them —
 * and removing is only allowed once a user is blocked, because an unblocked
 * account simply re-registers on its next page load.
 *
 * KV has no compare-and-swap, so every whole-document mutation goes through
 * `mutateUsers`: it re-reads `users` past the cache immediately before the put
 * and, if the stored document moved, re-applies the mutation to the fresh copy
 * (up to `MAX_MUTATION_ATTEMPTS` times). The residual window is the few
 * milliseconds between that read and the put; see SPEC.md.
 *
 * Every write goes through `guardedPut` so a runaway isolate cannot burn the
 * Cloudflare KV free-tier allowance of 1,000 writes/day.
 */

import { guardedPut, wouldWrite } from './kv-budget';
import type { AccessDecision, UserRecord, UsersDoc } from './types';

export type { AccessDecision, UserRecord, UsersDoc };

export interface AccessStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export class AccessError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AccessError';
    this.status = status;
  }
}

const USERS_KEY = 'users';
/** Phase-2 allowlist key. Read once, for migration, then never again. */
const LEGACY_ALLOWLIST_KEY = 'allowlist';
const CACHE_MS = 60_000;
/** Refresh `lastSeenAt` at most once per user per day. */
const LAST_SEEN_REFRESH_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_USERS = 30;
const MAX_USERS_CEILING = 100;
/** Optimistic-retry budget for a whole-document mutation. */
const MAX_MUTATION_ATTEMPTS = 3;

const memory = new Map<string, string>();
const memoryStore: AccessStore = {
  async get(key) {
    return memory.get(key) ?? null;
  },
  async put(key, value) {
    memory.set(key, value);
  },
};

let missingBindingWarned = false;
let maxUsersWarned = false;
let usersCache: { doc: UsersDoc; expiresAt: number } | null = null;
/** Set once the legacy allowlist has been considered in this isolate — per-isolate is safe because the import is idempotent (it only runs while `users` is absent), so a cold isolate re-checking costs at most one extra read. */
let migrationChecked = false;

function parseEmailList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function adminEmails(): string[] {
  return parseEmailList(process.env.ADMIN_EMAILS);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(normalizeEmail(email));
}

/**
 * `MAX_USERS`, a positive integer clamped to 1..100. Default 30.
 *
 * Only a bare run of digits is accepted — `1e2`, `30.5`, `-5` and `abc` are all
 * malformed and fall back to the default with one warning per isolate.
 */
export function maxUsers(): number {
  const raw = (process.env.MAX_USERS ?? '').trim();
  if (!raw) return DEFAULT_MAX_USERS;
  const parsed = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1) {
    if (!maxUsersWarned) {
      maxUsersWarned = true;
      console.warn(
        `[access] MAX_USERS="${raw}" is not a positive integer; using ${DEFAULT_MAX_USERS}`,
      );
    }
    return DEFAULT_MAX_USERS;
  }
  return Math.min(parsed, MAX_USERS_CEILING);
}

export function sanitizeName(name: string): string {
  return name.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, 300);
}

export function invalidateCache(): void {
  usersCache = null;
}

/** Clears the in-memory fallback and cache. Tests only. */
export function resetAccessStateForTests(): void {
  memory.clear();
  missingBindingWarned = false;
  maxUsersWarned = false;
  migrationChecked = false;
  invalidateCache();
}

async function kvBinding(): Promise<AccessStore | undefined> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { ACCESS?: KVNamespace }).ACCESS;
    if (!kv) return undefined;
    return {
      get: (key) => kv.get(key),
      put: (key, value) => kv.put(key, value),
    };
  } catch {
    return undefined;
  }
}

export async function getStore(): Promise<AccessStore> {
  const kv = await kvBinding();
  if (kv) return kv;
  if (!missingBindingWarned) {
    missingBindingWarned = true;
    console.warn('[access] ACCESS KV binding missing; using in-memory store');
  }
  return memoryStore;
}

async function resolveStore(store?: AccessStore): Promise<AccessStore> {
  return store ?? (await getStore());
}

function parseUsers(raw: string | null): UsersDoc | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<UsersDoc>;
    if (parsed.version !== 1 || !Array.isArray(parsed.users)) return null;
    const users: UserRecord[] = [];
    for (const entry of parsed.users) {
      const record = entry as Partial<UserRecord>;
      const email = typeof record.email === 'string' ? normalizeEmail(record.email) : '';
      if (!email) continue;
      const firstSeenAt =
        typeof record.firstSeenAt === 'string' ? record.firstSeenAt : new Date(0).toISOString();
      users.push({
        email,
        name: typeof record.name === 'string' && record.name ? record.name : undefined,
        firstSeenAt,
        lastSeenAt: typeof record.lastSeenAt === 'string' ? record.lastSeenAt : firstSeenAt,
        ...(record.blocked === true ? { blocked: true } : null),
      });
    }
    return { version: 1, users };
  } catch {
    return null;
  }
}

function parseLegacyEmails(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; emails?: unknown };
    if (!Array.isArray(parsed.emails)) return [];
    return [...new Set(parsed.emails.map((e) => normalizeEmail(String(e))).filter(Boolean))];
  } catch {
    return [];
  }
}

/**
 * One-time migration: when `users` is absent but the phase-2 `allowlist` key
 * still holds addresses, import them as user records in a single write. The legacy keys are never deleted and never read again once
 * `users` exists.
 */
async function readUsersDoc(store: AccessStore, now: number): Promise<UsersDoc> {
  const existing = parseUsers(await store.get(USERS_KEY));
  if (existing) {
    migrationChecked = true;
    return existing;
  }

  if (!migrationChecked) {
    migrationChecked = true;
    const legacy = parseLegacyEmails(await store.get(LEGACY_ALLOWLIST_KEY));
    const importable = legacy.filter((email) => !isAdminEmail(email));
    if (importable.length > 0) {
      const iso = new Date(now).toISOString();
      const doc: UsersDoc = {
        version: 1,
        users: importable.map((email) => ({ email, firstSeenAt: iso, lastSeenAt: iso })),
      };
      await guardedPut(store, USERS_KEY, JSON.stringify(doc), 'essential', now);
      return doc;
    }
  }

  return { version: 1, users: [] };
}

async function loadUsers(store: AccessStore, now: number, fresh = false): Promise<UsersDoc> {
  if (!fresh && usersCache && now < usersCache.expiresAt) return usersCache.doc;
  const doc = await readUsersDoc(store, now);
  usersCache = { doc, expiresAt: now + CACHE_MS };
  return doc;
}

/**
 * Writes the whole document. A `'written'` put invalidates the cache so the next
 * read sees KV; a `'skipped'` put (the budget dropped an `optional` write) leaves
 * KV alone but folds the new value into the cached document, so a `lastSeenAt`
 * refresh that was dropped is not retried on every subsequent request.
 */
async function writeUsers(
  store: AccessStore,
  users: UserRecord[],
  kind: 'essential' | 'optional',
  now: number,
): Promise<UserRecord[]> {
  const doc: UsersDoc = { version: 1, users };
  const result = await guardedPut(store, USERS_KEY, JSON.stringify(doc), kind, now);
  if (result === 'written') invalidateCache();
  else usersCache = { doc, expiresAt: usersCache?.expiresAt ?? now + CACHE_MS };
  return users;
}

/** `null` in `next` means "nothing to write"; `value` is what the caller gets. */
interface MutationOutcome<T> {
  next: UserRecord[] | null;
  value: T;
}

function sameDoc(a: UserRecord[], b: UserRecord[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Optimistic, bounded compare-and-swap over the whole `users` document.
 *
 * KV offers no CAS, so immediately before the put we re-read `users` past the
 * cache. If the stored document differs from the snapshot the mutation was based
 * on, the mutation is re-applied to the fresh document and re-validated (so a
 * registration that has just lost the last seat returns `full` instead of
 * overwriting the winner, and a `Block` landing in the window is not reverted).
 * After `MAX_MUTATION_ATTEMPTS` the final re-application is written anyway —
 * last-writer-wins — unless the mutation itself declines to write.
 *
 * `freshBase: true` reads past the cache for the first attempt too; admin
 * mutations use it so their not-found / no-op checks never run on a stale view.
 */
async function mutateUsers<T>(
  store: AccessStore,
  fn: (users: UserRecord[]) => MutationOutcome<T>,
  kind: 'essential' | 'optional',
  opts: { now: number; freshBase?: boolean },
): Promise<T> {
  const { now } = opts;
  let base = (await loadUsers(store, now, opts.freshBase === true)).users;

  for (let attempt = 1; attempt <= MAX_MUTATION_ATTEMPTS; attempt += 1) {
    const outcome = fn(base);
    if (!outcome.next) return outcome.value;
    if (!wouldWrite(kind, now)) {
      // The budget is going to drop this put — don't spend a KV read verifying
      // a document that will never be written. `writeUsers` folds the value
      // into the cache so the request stops retrying.
      await writeUsers(store, outcome.next, kind, now);
      return outcome.value;
    }

    const fresh = (await loadUsers(store, now, true)).users;
    if (sameDoc(fresh, base)) {
      await writeUsers(store, outcome.next, kind, now);
      return outcome.value;
    }

    base = fresh;
    if (attempt === MAX_MUTATION_ATTEMPTS) {
      // Out of retries: re-apply once more and take last-writer-wins, but never
      // write a document the mutation itself has just refused.
      const last = fn(base);
      if (!last.next) return last.value;
      await writeUsers(store, last.next, kind, now);
      return last.value;
    }
  }

  /* c8 ignore next */
  throw new AccessError(500, 'users mutation did not settle');
}

function withBlocked(user: UserRecord, blocked: boolean): UserRecord {
  if (blocked) return { ...user, blocked: true };
  const next = { ...user };
  delete next.blocked;
  return next;
}

/** Non-admin records held against the cap — blocked users still hold a slot. */
function countAgainstCap(users: UserRecord[]): number {
  return users.filter((u) => !isAdminEmail(u.email)).length;
}

/**
 * The single access gate. Registers the caller on first sight, refuses once the
 * registry is full, and refuses blocked users. Admins short-circuit with no
 * read and no write.
 */
export async function resolveAccess(
  email: string | null | undefined,
  name?: string,
  store?: AccessStore,
  opts?: { now?: number },
): Promise<AccessDecision> {
  const now = opts?.now ?? Date.now();
  const normalized = email ? normalizeEmail(email) : '';
  if (!normalized) return { allowed: false, reason: 'blocked' };
  if (isAdminEmail(normalized)) return { allowed: true, isAdmin: true };

  const s = await resolveStore(store);
  const cleanName = name ? sanitizeName(name) || undefined : undefined;
  const cached = await loadUsers(s, now);
  const found = cached.users.find((u) => u.email === normalized);

  if (found) {
    if (found.blocked) return { allowed: false, reason: 'blocked' };
    const last = Date.parse(found.lastSeenAt);
    if (!Number.isNaN(last) && now - last < LAST_SEEN_REFRESH_MS) {
      return { allowed: true, isAdmin: false };
    }
    // The refresh rewrites the whole document, so it goes through the same
    // compare-and-swap: a Block (or a removal) that landed while our view was
    // cached must not be reverted by a last-seen touch.
    const refreshed = new Date(now).toISOString();
    return mutateUsers<AccessDecision>(
      s,
      (current) => {
        const record = current.find((u) => u.email === normalized);
        // Removed under us: serve this request, and the next one re-registers.
        if (!record) return { next: null, value: { allowed: true, isAdmin: false } };
        if (record.blocked) return { next: null, value: { allowed: false, reason: 'blocked' } };
        return {
          next: current.map((u) =>
            u.email === normalized ? { ...u, name: cleanName ?? u.name, lastSeenAt: refreshed } : u,
          ),
          value: { allowed: true, isAdmin: false },
        };
      },
      'optional',
      { now },
    );
  }

  // Unknown to the cached view. The cap is checked on the cached document first:
  // a registry that is already full refuses straight from cache, so refused
  // users cost no KV reads. Only when a seat looks free do we pay for the
  // compare-and-swap read inside `mutateUsers`.
  const iso = new Date(now).toISOString();
  return mutateUsers<AccessDecision>(
    s,
    (current) => {
      const raced = current.find((u) => u.email === normalized);
      if (raced) {
        return {
          next: null,
          value: raced.blocked
            ? { allowed: false, reason: 'blocked' }
            : { allowed: true, isAdmin: false },
        };
      }
      if (countAgainstCap(current) >= maxUsers()) {
        return { next: null, value: { allowed: false, reason: 'full' } };
      }
      return {
        next: [...current, { email: normalized, name: cleanName, firstSeenAt: iso, lastSeenAt: iso }],
        value: { allowed: true, isAdmin: false },
      };
    },
    'essential',
    { now },
  );
}

export async function listUsers(store?: AccessStore): Promise<UserRecord[]> {
  const s = await resolveStore(store);
  return (await loadUsers(s, Date.now())).users;
}

async function setBlocked(
  email: string,
  blocked: boolean,
  by: string,
  store?: AccessStore,
): Promise<UserRecord[]> {
  const normalized = normalizeEmail(email);
  if (isAdminEmail(normalized)) throw new AccessError(400, 'cannot block an admin');
  const s = await resolveStore(store);
  const now = Date.now();
  let logged = false;

  return mutateUsers<UserRecord[]>(
    s,
    (current) => {
      const found = current.find((u) => u.email === normalized);
      if (!found) throw new AccessError(404, 'user not found');
      if ((found.blocked === true) === blocked) return { next: null, value: current };

      const next = current.map((u) => (u.email === normalized ? withBlocked(u, blocked) : u));
      if (!logged) {
        logged = true;
        console.info(`[access] ${blocked ? 'blocked' : 'unblocked'} ${normalized} by ${by}`);
      }
      return { next, value: next };
    },
    'essential',
    { now, freshBase: true },
  );
}

export function blockUser(email: string, by: string, store?: AccessStore): Promise<UserRecord[]> {
  return setBlocked(email, true, by, store);
}

export function unblockUser(email: string, by: string, store?: AccessStore): Promise<UserRecord[]> {
  return setBlocked(email, false, by, store);
}

/**
 * Removes a user and frees their slot. KV only — nothing in Drive is touched.
 *
 * Removal is not a ban: an unblocked account re-registers on its next page load
 * and takes a new seat. So a user must be blocked first — that is the state that
 * actually denies sign-in — and removing is the separate step that frees the
 * seat.
 */
export async function removeUser(
  email: string,
  by: string,
  store?: AccessStore,
): Promise<UserRecord[]> {
  const normalized = normalizeEmail(email);
  if (isAdminEmail(normalized)) throw new AccessError(400, 'cannot remove an admin');
  const s = await resolveStore(store);
  const now = Date.now();
  let logged = false;

  return mutateUsers<UserRecord[]>(
    s,
    (current) => {
      const found = current.find((u) => u.email === normalized);
      if (!found) return { next: null, value: current };
      if (!found.blocked) throw new AccessError(400, 'block the user before removing');

      const next = current.filter((u) => u.email !== normalized);
      if (!logged) {
        logged = true;
        console.info(`[access] removed ${normalized} by ${by}`);
      }
      return { next, value: next };
    },
    'essential',
    { now, freshBase: true },
  );
}
