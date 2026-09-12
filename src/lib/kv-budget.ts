/**
 * Per-isolate, day-bucketed KV write budget.
 *
 * Cloudflare's KV free tier allows 1,000 writes per day for the whole account.
 * This module cannot see other isolates, so it is a best-effort brake rather
 * than a hard quota: each isolate counts its own writes since the start of the
 * current UTC day and refuses to spend more than its share.
 *
 * - `optional` writes (last-seen refreshes) stop once the isolate has written
 *   `SOFT_LIMIT` times today; `guardedPut` returns `'skipped'`.
 * - `essential` writes (registering a user, blocking, removing) throw
 *   `KvBudgetExceeded` once the isolate has written `HARD_LIMIT` times today.
 *   API routes map that to `503 { error: 'kv_budget_exceeded' }`.
 *
 * Pure module: it knows nothing about KV or about `access.ts` beyond the
 * two-method store shape below.
 */

export const SOFT_LIMIT = 200;
export const HARD_LIMIT = 500;

export interface BudgetStore {
  put(key: string, value: string): Promise<void>;
}

export type WriteKind = 'essential' | 'optional';
export type PutResult = 'written' | 'skipped';

export class KvBudgetExceeded extends Error {
  readonly status = 503;

  constructor() {
    super('kv_budget_exceeded');
    this.name = 'KvBudgetExceeded';
  }
}

/** UTC day bucket, e.g. `2026-09-13`. */
function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

let bucket: { day: string; writes: number } = { day: dayKey(Date.now()), writes: 0 };

function currentBucket(now: number): { day: string; writes: number } {
  const day = dayKey(now);
  if (bucket.day !== day) bucket = { day, writes: 0 };
  return bucket;
}

export interface BudgetSnapshot {
  writesToday: number;
  softLimit: number;
  hardLimit: number;
}

/** Counters for the current UTC day in this isolate. */
export function budgetSnapshot(now: number = Date.now()): BudgetSnapshot {
  return {
    writesToday: currentBucket(now).writes,
    softLimit: SOFT_LIMIT,
    hardLimit: HARD_LIMIT,
  };
}

/** Tests only. */
export function resetKvBudgetForTests(now: number = Date.now()): void {
  bucket = { day: dayKey(now), writes: 0 };
}

/**
 * Whether a write of this kind would still be attempted right now, without
 * touching the counter. Callers use it to skip work they only need when the put
 * will actually reach KV (e.g. a compare-and-swap re-read). `essential` is
 * always "yes" — past the hard limit `guardedPut` throws rather than skipping.
 */
export function wouldWrite(kind: WriteKind, now: number = Date.now()): boolean {
  if (kind !== 'optional') return true;
  return currentBucket(now).writes < SOFT_LIMIT;
}

/**
 * Write through the budget. `optional` writes are dropped past the soft limit;
 * `essential` writes throw past the hard limit. The counter only advances when
 * the underlying put actually succeeds.
 */
export async function guardedPut(
  store: BudgetStore,
  key: string,
  value: string,
  kind: WriteKind,
  now: number = Date.now(),
): Promise<PutResult> {
  const current = currentBucket(now);

  if (kind === 'optional' && current.writes >= SOFT_LIMIT) return 'skipped';
  if (kind === 'essential' && current.writes >= HARD_LIMIT) throw new KvBudgetExceeded();

  await store.put(key, value);
  current.writes += 1;
  return 'written';
}
