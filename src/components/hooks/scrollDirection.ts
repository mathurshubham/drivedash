/**
 * Pure reducer behind `useNavVisibility` — the rules that decide whether the
 * bottom nav is hidden.
 *
 * The first phone pass hid the nav on scroll-down and never got it back: on a
 * page only a little taller than the viewport there is no room to scroll *up*
 * again, so the reveal gesture did not exist. The rules below are therefore
 * biased hard towards showing:
 *
 * 1. A page that barely scrolls (`scrollHeight - innerHeight < 240`) never
 *    hides the nav at all.
 * 2. Hiding only starts once the page is more than 96px from the top.
 * 3. Within 48px of the top *or* the bottom of the document the nav is shown.
 * 4. When scrolling stops for 700ms the nav comes back on its own.
 *
 * Route changes, open sheets/tours and the `dd:nav:show` event force it back
 * too; those are not scroll samples, so they live in the hook.
 */

/** Movement smaller than this is jitter and does not change direction. */
export const NAV_SCROLL_THRESHOLD = 8;
/** A page with less than this much scrollable overflow never hides the nav. */
export const NAV_MIN_SCROLLABLE = 240;
/** Hiding only begins once the page is this far from the top. */
export const NAV_HIDE_AFTER = 96;
/** Distance from either end of the document inside which the nav is shown. */
export const NAV_EDGE_ZONE = 48;
/** Scrolling stopped for this long reveals the nav again. */
export const NAV_IDLE_MS = 700;

export interface NavVisibilityState {
  /** Last scroll offset that actually moved more than the threshold. */
  lastY: number;
  hidden: boolean;
  /** Milliseconds since the last real movement. */
  idleMs: number;
}

export interface ScrollSample {
  scrollY: number;
  /** `document.documentElement.scrollHeight`. */
  scrollHeight: number;
  /** `window.innerHeight`. */
  innerHeight: number;
  /** Milliseconds since the previous sample. */
  dt: number;
}

export const initialNavVisibility: NavVisibilityState = { lastY: 0, hidden: false, idleMs: 0 };

/**
 * Fold one scroll sample into the nav's visibility state. Returns the same
 * object when nothing changed, so callers can skip a re-render on identity.
 */
export function decideNavVisibility(
  state: NavVisibilityState,
  sample: ScrollSample,
): NavVisibilityState {
  const y = Math.max(0, sample.scrollY);
  const maxScroll = Math.max(0, sample.scrollHeight - sample.innerHeight);
  const delta = y - state.lastY;
  const moved = Math.abs(delta) >= NAV_SCROLL_THRESHOLD;
  const idleMs = moved ? 0 : state.idleMs + Math.max(0, sample.dt);
  const lastY = moved ? y : state.lastY;

  let hidden: boolean;
  if (maxScroll < NAV_MIN_SCROLLABLE) {
    // Rule 1: nothing to scroll back up through, so never hide.
    hidden = false;
  } else if (y <= NAV_EDGE_ZONE || y >= maxScroll - NAV_EDGE_ZONE) {
    // Rule 3: at either end of the document.
    hidden = false;
  } else if (idleMs >= NAV_IDLE_MS) {
    // Rule 4: the finger stopped.
    hidden = false;
  } else if (moved && delta > 0) {
    // Rule 2: downward, and past the top zone.
    hidden = y > NAV_HIDE_AFTER;
  } else if (moved) {
    hidden = false;
  } else {
    hidden = state.hidden;
  }

  if (hidden === state.hidden && lastY === state.lastY && idleMs === state.idleMs) return state;
  return { lastY, hidden, idleMs };
}
