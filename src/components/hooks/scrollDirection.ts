/** Pure reducer behind `useScrollDirection`. */

export const SCROLL_THRESHOLD = 8;
/** Never hide the nav while the page is still near the top. */
export const SCROLL_TOP_ZONE = 24;

export interface ScrollState {
  /** Last scroll offset that actually moved the direction. */
  lastY: number;
  direction: 'up' | 'down';
}

export const initialScrollState: ScrollState = { lastY: 0, direction: 'up' };

/**
 * Fold a new scroll offset in. Movements smaller than the threshold are
 * ignored so a jittery finger cannot flip the nav on every frame.
 */
export function scrollDirectionReducer(state: ScrollState, y: number): ScrollState {
  const next = Math.max(0, y);

  if (next <= SCROLL_TOP_ZONE) {
    return state.direction === 'up' && state.lastY === next
      ? state
      : { lastY: next, direction: 'up' };
  }

  const delta = next - state.lastY;
  if (Math.abs(delta) < SCROLL_THRESHOLD) return state;

  const direction = delta > 0 ? 'down' : 'up';
  return { lastY: next, direction };
}
