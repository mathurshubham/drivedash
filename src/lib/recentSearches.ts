export const RECENT_SEARCHES_KEY = 'dd.recent-searches';
export const RECENT_SEARCHES_MAX = 6;

/**
 * Newest first, de-duplicated case-insensitively, capped. Pure so the ordering
 * rule is testable without a DOM.
 */
export function mergeRecentSearch(
  list: string[],
  query: string,
  max: number = RECENT_SEARCHES_MAX,
): string[] {
  const trimmed = query.trim();
  if (!trimmed) return list.slice(0, max);
  const lower = trimmed.toLowerCase();
  return [trimmed, ...list.filter((q) => q.toLowerCase() !== lower)].slice(0, max);
}

export function readRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((q): q is string => typeof q === 'string').slice(0, RECENT_SEARCHES_MAX);
  } catch {
    // Unparseable or unavailable storage: start from nothing.
    return [];
  }
}

export function writeRecentSearches(list: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
  } catch {
    // Private mode; the chips just will not persist.
  }
}
