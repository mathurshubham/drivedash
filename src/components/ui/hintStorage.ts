/**
 * `localStorage` helpers for one-time hints. Every access is wrapped because
 * Safari private mode throws on `localStorage` rather than returning null.
 */

export const HINT_PREFIX = 'dd.hint.';

/** `"swipe-pin"` → `"dd.hint.swipe-pin"`; an already-prefixed key is left alone. */
export function hintStorageKey(id: string): string {
  return id.startsWith(HINT_PREFIX) ? id : `${HINT_PREFIX}${id}`;
}

export function isHintDismissed(id: string): boolean {
  try {
    return window.localStorage.getItem(hintStorageKey(id)) === '1';
  } catch {
    // No storage available — show the hint rather than crash.
    return false;
  }
}

export function dismissHint(id: string): void {
  try {
    window.localStorage.setItem(hintStorageKey(id), '1');
  } catch {
    // Nothing to persist to; the hint reappears next session.
  }
  notify();
}

export function resetHint(id: string): void {
  try {
    window.localStorage.removeItem(hintStorageKey(id));
  } catch {
    // Ignore.
  }
  notify();
}

/*
 * `localStorage` is an external store, so badges read it through
 * `useSyncExternalStore` rather than an effect. These two make it subscribable.
 */
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribeHints(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
