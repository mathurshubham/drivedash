/**
 * KV-backed user registry for open signup behind a hard cap. No next-auth
 * import — unit testable like `token.ts`. Falls back to an in-memory Map when
 * the ACCESS binding is missing (tests, misconfiguration).
 *
 * One key, `users`, holds every non-admin account that has ever signed in.
 * Admins (`ADMIN_EMAILS`) are always allowed, are never stored, and never count
 * against the cap. Blocked users keep their slot until an admin removes them.
 *
 * Every write goes through `guardedPut` so a runaway isolate cannot burn the
 * Cloudflare KV free-tier allowance of 1,000 writes/day.
 */

import { guardedPut } from './kv-budget';
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
let usersCache: { doc: UsersDoc; expiresAt: number } | null = null;
/** Set once the legacy allowlist has been considered in this isolate. */
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

/** `MAX_USERS`, a positive integer clamped to 1..100. Default 30. */
export function maxUsers(): number {
  const raw = (process.env.MAX_USERS ?? '').trim();
  const parsed = Number(raw);
  if (!raw || !Number.isInteger(parsed) || parsed < 1) return DEFAULT_MAX_USERS;
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

async function writeUsers(
  store: AccessStore,
  users: UserRecord[],
  kind: 'essential' | 'optional',
  now: number,
): Promise<UserRecord[]> {
  const doc: UsersDoc = { version: 1, users };
  await guardedPut(store, USERS_KEY, JSON.stringify(doc), kind, now);
  invalidateCache();
  return users;
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
    if (Number.isNaN(last) || now - last >= LAST_SEEN_REFRESH_MS) {
      const iso = new Date(now).toISOString();
      await writeUsers(
        s,
        cached.users.map((u) =>
          u.email === normalized ? { ...u, name: cleanName ?? u.name, lastSeenAt: iso } : u,
        ),
        'optional',
        now,
      );
    }
    return { allowed: true, isAdmin: false };
  }

  // Unknown to the cached view: re-read past the cache so the cap check sees
  // the newest registry. Beyond this it is last-writer-wins.
  const fresh = await loadUsers(s, now, true);
  const raced = fresh.users.find((u) => u.email === normalized);
  if (raced) {
    return raced.blocked ? { allowed: false, reason: 'blocked' } : { allowed: true, isAdmin: false };
  }

  if (countAgainstCap(fresh.users) >= maxUsers()) return { allowed: false, reason: 'full' };

  const iso = new Date(now).toISOString();
  await writeUsers(
    s,
    [...fresh.users, { email: normalized, name: cleanName, firstSeenAt: iso, lastSeenAt: iso }],
    'essential',
    now,
  );
  return { allowed: true, isAdmin: false };
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
  const doc = await loadUsers(s, now, true);
  const found = doc.users.find((u) => u.email === normalized);
  if (!found) throw new AccessError(404, 'user not found');
  if ((found.blocked === true) === blocked) return doc.users;

  console.info(`[access] ${blocked ? 'blocked' : 'unblocked'} ${normalized} by ${by}`);
  return writeUsers(
    s,
    doc.users.map((u) =>
      u.email === normalized ? withBlocked(u, blocked) : u,
    ),
    'essential',
    now,
  );
}

export function blockUser(email: string, by: string, store?: AccessStore): Promise<UserRecord[]> {
  return setBlocked(email, true, by, store);
}

export function unblockUser(email: string, by: string, store?: AccessStore): Promise<UserRecord[]> {
  return setBlocked(email, false, by, store);
}

/** Removes a user and frees their slot. KV only — nothing in Drive is touched. */
export async function removeUser(
  email: string,
  by: string,
  store?: AccessStore,
): Promise<UserRecord[]> {
  const normalized = normalizeEmail(email);
  if (isAdminEmail(normalized)) throw new AccessError(400, 'cannot remove an admin');
  const s = await resolveStore(store);
  const now = Date.now();
  const doc = await loadUsers(s, now, true);
  if (!doc.users.some((u) => u.email === normalized)) return doc.users;

  console.info(`[access] removed ${normalized} by ${by}`);
  return writeUsers(
    s,
    doc.users.filter((u) => u.email !== normalized),
    'essential',
    now,
  );
}
