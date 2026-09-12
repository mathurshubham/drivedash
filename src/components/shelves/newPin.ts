/**
 * sessionStorage key holding the file id pinned from `/search` most recently.
 * Home reads it once on mount, clears it, and hands the id to `HotList` so the
 * matching tile gets its one-shot rise-in (`[data-new]` in `shelves.css`).
 *
 * sessionStorage rather than a router param: the pin happens on another route
 * and the user may or may not come back, and a stale query string on `/` would
 * survive a reload and replay the animation.
 */
export const NEW_PIN_KEY = 'dd.new-pin';

/** Reads and clears the marker. Safe to call during an effect on any device. */
export function takeNewPin(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const id = window.sessionStorage.getItem(NEW_PIN_KEY);
    if (id) window.sessionStorage.removeItem(NEW_PIN_KEY);
    return id ?? undefined;
  } catch {
    return undefined;
  }
}
