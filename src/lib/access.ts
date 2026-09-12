/**
 * KV-backed allowlist and access-request store. No next-auth import — unit
 * testable like `token.ts`. Falls back to an in-memory Map when the ACCESS
 * binding is missing (tests, misconfiguration).
 */

import { envAllowedEmails } from './token';
import type { AccessRequest } from './types';

export type { AccessRequest };

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

const ALLOWLIST_KEY = 'allowlist';
const SEEDED_KEY = 'allowlist:seeded';
const REQUESTS_KEY = 'requests';
const CACHE_MS = 60_000;
const REQUESTS_CAP = 200;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

interface AllowlistDoc {
  version: 1;
  emails: string[];
  updatedAt: string;
  updatedBy: string;
}

interface RequestsDoc {
  version: 1;
  items: AccessRequest[];
}

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

let allowlistCache: { emails: string[]; expiresAt: number } | null = null;

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

function sanitizeText(value: string, max: number): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

export function sanitizeNote(note: string): string {
  return sanitizeText(note, 300);
}

export function sanitizeName(name: string): string {
  return sanitizeText(name, 300);
}

export function invalidateAllowlistCache(): void {
  allowlistCache = null;
}

/** Clears the in-memory fallback and cache. Tests only. */
export function resetAccessStateForTests(): void {
  memory.clear();
  missingBindingWarned = false;
  invalidateAllowlistCache();
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

function parseAllowlist(raw: string | null): AllowlistDoc | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AllowlistDoc>;
    if (parsed.version !== 1 || !Array.isArray(parsed.emails)) return null;
    return {
      version: 1,
      emails: parsed.emails.map((e) => normalizeEmail(String(e))).filter(Boolean),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      updatedBy: typeof parsed.updatedBy === 'string' ? parsed.updatedBy : 'unknown',
    };
  } catch {
    return null;
  }
}

function parseRequests(raw: string | null): RequestsDoc {
  if (!raw) return { version: 1, items: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<RequestsDoc>;
    if (parsed.version !== 1 || !Array.isArray(parsed.items)) return { version: 1, items: [] };
    return { version: 1, items: parsed.items };
  } catch {
    return { version: 1, items: [] };
  }
}

async function resolveStore(store?: AccessStore): Promise<AccessStore> {
  return store ?? (await getStore());
}

/** Read-only. Missing or invalid allowlist is empty — never written here. */
async function readAllowlistDoc(store: AccessStore): Promise<AllowlistDoc> {
  const existing = parseAllowlist(await store.get(ALLOWLIST_KEY));
  if (existing) return existing;
  return {
    version: 1,
    emails: [],
    updatedAt: new Date().toISOString(),
    updatedBy: 'unknown',
  };
}

/**
 * One-time seed from `ALLOWED_EMAILS`. No-ops once `allowlist:seeded` exists.
 * Does not overwrite an allowlist that is already present, and does not write
 * an empty allowlist when the env var is unset.
 */
export async function ensureAllowlistSeeded(store?: AccessStore): Promise<void> {
  const s = await resolveStore(store);
  if ((await s.get(SEEDED_KEY)) !== null) return;

  const existing = parseAllowlist(await s.get(ALLOWLIST_KEY));
  if (!existing) {
    const emails = envAllowedEmails();
    if (emails.length > 0) {
      const seeded: AllowlistDoc = {
        version: 1,
        emails,
        updatedAt: new Date().toISOString(),
        updatedBy: 'seed',
      };
      await s.put(ALLOWLIST_KEY, JSON.stringify(seeded));
    }
  }
  await s.put(SEEDED_KEY, new Date().toISOString());
  invalidateAllowlistCache();
}

export async function getAllowlist(store?: AccessStore): Promise<string[]> {
  if (allowlistCache && Date.now() < allowlistCache.expiresAt) return allowlistCache.emails;
  const s = await resolveStore(store);
  const emails = (await readAllowlistDoc(s)).emails;
  allowlistCache = { emails, expiresAt: Date.now() + CACHE_MS };
  return emails;
}

export async function isAllowed(
  email: string | null | undefined,
  store?: AccessStore,
): Promise<boolean> {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  if (isAdminEmail(normalized)) return true;
  await ensureAllowlistSeeded(store);
  const list = await getAllowlist(store);
  return list.includes(normalized);
}

async function writeAllowlist(
  store: AccessStore,
  emails: string[],
  by: string,
): Promise<string[]> {
  const unique = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  const doc: AllowlistDoc = {
    version: 1,
    emails: unique,
    updatedAt: new Date().toISOString(),
    updatedBy: by,
  };
  await store.put(ALLOWLIST_KEY, JSON.stringify(doc));
  invalidateAllowlistCache();
  return unique;
}

export async function addToAllowlist(
  email: string,
  by: string,
  store?: AccessStore,
): Promise<string[]> {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes('@')) throw new AccessError(400, 'invalid email');
  const s = await resolveStore(store);
  await ensureAllowlistSeeded(s);
  const doc = await readAllowlistDoc(s);
  if (doc.emails.includes(normalized)) return doc.emails;
  return writeAllowlist(s, [...doc.emails, normalized], by);
}

export async function removeFromAllowlist(
  email: string,
  by: string,
  store?: AccessStore,
): Promise<string[]> {
  const normalized = normalizeEmail(email);
  if (isAdminEmail(normalized)) throw new AccessError(400, 'cannot remove an admin');
  const s = await resolveStore(store);
  await ensureAllowlistSeeded(s);
  const doc = await readAllowlistDoc(s);
  if (!doc.emails.includes(normalized)) return doc.emails;
  return writeAllowlist(
    s,
    doc.emails.filter((e) => e !== normalized),
    by,
  );
}

export async function getRequests(store?: AccessStore): Promise<AccessRequest[]> {
  const s = await resolveStore(store);
  return parseRequests(await s.get(REQUESTS_KEY)).items;
}

/** Drop oldest decided first, then oldest overall, until `max` remains. */
export function pruneRequests(items: AccessRequest[], max = REQUESTS_CAP): AccessRequest[] {
  if (items.length <= max) return items;
  const age = (r: AccessRequest) => Date.parse(r.decidedAt ?? r.requestedAt);
  const drop = new Set<AccessRequest>();
  let need = items.length - max;

  const decided = items
    .filter((i) => i.status !== 'pending')
    .slice()
    .sort((a, b) => age(a) - age(b));
  for (const item of decided) {
    if (need <= 0) break;
    drop.add(item);
    need -= 1;
  }

  if (need > 0) {
    const remaining = items
      .filter((i) => !drop.has(i))
      .slice()
      .sort((a, b) => age(a) - age(b));
    for (const item of remaining) {
      if (need <= 0) break;
      drop.add(item);
      need -= 1;
    }
  }

  return items.filter((i) => !drop.has(i));
}

async function writeRequests(store: AccessStore, items: AccessRequest[]): Promise<void> {
  const doc: RequestsDoc = { version: 1, items: pruneRequests(items) };
  await store.put(REQUESTS_KEY, JSON.stringify(doc));
}

export async function upsertRequest(
  r: { email: string; name?: string; note?: string },
  store?: AccessStore,
): Promise<AccessRequest> {
  const email = normalizeEmail(r.email);
  if (!email || !email.includes('@')) throw new AccessError(400, 'invalid email');
  const s = await resolveStore(store);
  const items = parseRequests(await s.get(REQUESTS_KEY)).items;
  const existing = items.find((i) => i.email === email);
  const now = new Date().toISOString();
  const note = r.note !== undefined ? sanitizeNote(r.note) : existing?.note;
  const name = r.name !== undefined ? sanitizeName(r.name) : existing?.name;

  if (existing?.status === 'declined') {
    const decided = Date.parse(existing.decidedAt ?? existing.requestedAt);
    if (!Number.isNaN(decided) && Date.now() - decided < COOLDOWN_MS) {
      throw new AccessError(429, 'try again in 7 days');
    }
  }

  const next: AccessRequest = {
    email,
    name: name || undefined,
    note: note || undefined,
    requestedAt: now,
    status: 'pending',
  };

  const updated = existing
    ? items.map((i) => (i.email === email ? next : i))
    : [...items, next];
  await writeRequests(s, updated);
  return next;
}

export async function decideRequest(
  email: string,
  decision: 'approved' | 'declined',
  by: string,
  store?: AccessStore,
): Promise<AccessRequest> {
  const normalized = normalizeEmail(email);
  const s = await resolveStore(store);
  const items = parseRequests(await s.get(REQUESTS_KEY)).items;
  const existing = items.find((i) => i.email === normalized && i.status === 'pending');
  if (!existing) throw new AccessError(404, 'request not found');

  if (decision === 'approved') await addToAllowlist(normalized, by, s);

  const decided: AccessRequest = {
    ...existing,
    status: decision,
    decidedAt: new Date().toISOString(),
    decidedBy: by,
  };

  await writeRequests(
    s,
    items.map((i) => (i.email === normalized && i.status === 'pending' ? decided : i)),
  );

  return decided;
}

export function findPending(items: AccessRequest[], email: string): AccessRequest | null {
  return items.find((i) => i.email === normalizeEmail(email) && i.status === 'pending') ?? null;
}
