import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  SWIPE_BOUND,
  SWIPE_THRESHOLD,
  clampSwipe,
  resolveSwipe,
  swipeProgress,
} from '@/components/ui/swipe';
import { POPOVER_MARGIN, placePopover } from '@/components/ui/placePopover';
import {
  initialLongPress,
  longPressReducer,
  type LongPressState,
} from '@/components/hooks/longPress';
import {
  NAV_EDGE_ZONE,
  NAV_HIDE_AFTER,
  NAV_IDLE_MS,
  NAV_MIN_SCROLLABLE,
  NAV_SCROLL_THRESHOLD,
  decideNavVisibility,
  initialNavVisibility,
  type NavVisibilityState,
  type ScrollSample,
} from '@/components/hooks/scrollDirection';
import {
  HINT_PREFIX,
  dismissHint,
  hintStorageKey,
  isHintDismissed,
  resetHint,
} from '@/components/ui/hintStorage';

describe('resolveSwipe', () => {
  it('ignores a drag shorter than the threshold', () => {
    expect(resolveSwipe(0, 0)).toBe('none');
    expect(resolveSwipe(20, 0.1)).toBe('none');
    expect(resolveSwipe(-55, 0)).toBe('none');
  });

  it('triggers on distance alone', () => {
    expect(resolveSwipe(SWIPE_THRESHOLD, 0)).toBe('right');
    expect(resolveSwipe(-SWIPE_THRESHOLD, 0)).toBe('left');
    expect(resolveSwipe(90, 0)).toBe('right');
  });

  it('triggers on a fast flick that did not travel far', () => {
    expect(resolveSwipe(30, 0.9)).toBe('right');
    expect(resolveSwipe(-30, -0.9)).toBe('left');
  });

  it('needs the flick to be in the same direction as the drag', () => {
    // Finger retreating toward centre must not fire the action it left.
    expect(resolveSwipe(30, -0.9)).toBe('none');
    expect(resolveSwipe(-30, 0.9)).toBe('none');
  });

  it('treats a fast micro-movement as a tap, not a swipe', () => {
    expect(resolveSwipe(5, 2)).toBe('none');
  });

  it('still fires past the threshold even with a backwards flick', () => {
    expect(resolveSwipe(80, -0.9)).toBe('right');
  });
});

describe('clampSwipe', () => {
  it('clamps to the bound', () => {
    expect(clampSwipe(500, true, true)).toBe(SWIPE_BOUND);
    expect(clampSwipe(-500, true, true)).toBe(-SWIPE_BOUND);
  });

  it('refuses directions with no action', () => {
    expect(clampSwipe(40, false, true)).toBe(0);
    expect(clampSwipe(-40, true, false)).toBe(0);
    expect(clampSwipe(-40, true, true)).toBe(-40);
  });
});

describe('swipeProgress', () => {
  it('saturates at a full reveal', () => {
    expect(swipeProgress(0)).toBe(0);
    expect(swipeProgress(36)).toBeCloseTo(0.5);
    expect(swipeProgress(-200)).toBe(1);
  });
});

describe('longPressReducer', () => {
  const down = (x = 0, y = 0) => ({ type: 'down', x, y, at: 1000 }) as const;

  it('fires only after a timer while still pressing', () => {
    const pressing = longPressReducer(initialLongPress, down()).state;
    expect(pressing.phase).toBe('pressing');

    const fired = longPressReducer(pressing, { type: 'timer' });
    expect(fired.fire).toBe(true);
    expect(fired.state.phase).toBe('fired');
  });

  it('does not fire twice', () => {
    let s: LongPressState = longPressReducer(initialLongPress, down()).state;
    s = longPressReducer(s, { type: 'timer' }).state;
    expect(longPressReducer(s, { type: 'timer' }).fire).toBe(false);
  });

  it('cancels once the finger moves past the tolerance', () => {
    const pressing = longPressReducer(initialLongPress, down(10, 10)).state;
    expect(longPressReducer(pressing, { type: 'move', x: 15, y: 12 }).state.phase).toBe('pressing');

    const moved = longPressReducer(pressing, { type: 'move', x: 30, y: 10 }).state;
    expect(moved.phase).toBe('idle');
    expect(longPressReducer(moved, { type: 'timer' }).fire).toBe(false);
  });

  it('honours a custom tolerance', () => {
    const pressing = longPressReducer(initialLongPress, down(0, 0)).state;
    const res = longPressReducer(pressing, { type: 'move', x: 20, y: 0 }, { moveTolerance: 32 });
    expect(res.state.phase).toBe('pressing');
  });

  it('suppresses the click only after a press that fired', () => {
    const pressing = longPressReducer(initialLongPress, down()).state;
    expect(longPressReducer(pressing, { type: 'up' }).suppressClick).toBe(false);

    const fired = longPressReducer(pressing, { type: 'timer' }).state;
    const up = longPressReducer(fired, { type: 'up' });
    expect(up.suppressClick).toBe(true);
    expect(up.state).toEqual(initialLongPress);
  });

  it('resets on cancel', () => {
    const pressing = longPressReducer(initialLongPress, down()).state;
    expect(longPressReducer(pressing, { type: 'cancel' }).state).toEqual(initialLongPress);
  });
});

describe('placePopover', () => {
  const viewport = { width: 390, height: 844 };
  const size = { width: 200, height: 100 };

  it('prefers above when there is room', () => {
    const p = placePopover({ top: 400, left: 100, width: 28, height: 28 }, size, viewport);
    expect(p.side).toBe('top');
    expect(p.top).toBe(400 - 100 - 8);
  });

  it('flips below when the top is crowded', () => {
    const p = placePopover({ top: 20, left: 100, width: 28, height: 28 }, size, viewport);
    expect(p.side).toBe('bottom');
    expect(p.top).toBe(20 + 28 + 8);
  });

  it('centres horizontally on the anchor', () => {
    const p = placePopover({ top: 400, left: 100, width: 28, height: 28 }, size, viewport);
    expect(p.left).toBe(100 + 14 - 100);
  });

  it('clamps to a 12px margin on both edges', () => {
    const left = placePopover({ top: 400, left: 0, width: 28, height: 28 }, size, viewport);
    expect(left.left).toBe(POPOVER_MARGIN);

    const right = placePopover({ top: 400, left: 380, width: 28, height: 28 }, size, viewport);
    expect(right.left).toBe(viewport.width - size.width - POPOVER_MARGIN);
  });

  it('takes the roomier side when neither fits', () => {
    const tall = { width: 200, height: 800 };
    const p = placePopover({ top: 600, left: 100, width: 28, height: 28 }, tall, viewport);
    expect(p.side).toBe('top');
    expect(p.top).toBeGreaterThanOrEqual(POPOVER_MARGIN);
  });
});

describe('decideNavVisibility', () => {
  const TALL = 4000;
  const VIEWPORT = 915;

  function sample(partial: Partial<ScrollSample> = {}): ScrollSample {
    return { scrollY: 0, scrollHeight: TALL, innerHeight: VIEWPORT, dt: 16, ...partial };
  }

  function scrollTo(state: NavVisibilityState, scrollY: number, extra: Partial<ScrollSample> = {}) {
    return decideNavVisibility(state, sample({ scrollY, ...extra }));
  }

  it('never hides on a page barely taller than the viewport', () => {
    // 200px of overflow: there is no scroll-up gesture available to undo a
    // hide, so a hide must never happen. This is the phone-test defect.
    const shortDoc = { scrollHeight: VIEWPORT + NAV_MIN_SCROLLABLE - 40, innerHeight: VIEWPORT };
    let state = initialNavVisibility;
    for (const y of [40, 100, 150, 199]) {
      state = decideNavVisibility(state, sample({ scrollY: y, ...shortDoc }));
      expect(state.hidden).toBe(false);
    }
  });

  it('hides only after scrolling down past 96px from the top', () => {
    let state = scrollTo(initialNavVisibility, NAV_HIDE_AFTER - 10);
    expect(state.hidden).toBe(false);
    state = scrollTo(state, NAV_HIDE_AFTER + 10);
    expect(state.hidden).toBe(true);
  });

  it('shows again within 48px of the top of the document', () => {
    let state = scrollTo(initialNavVisibility, 600);
    expect(state.hidden).toBe(true);
    state = scrollTo(state, NAV_EDGE_ZONE);
    expect(state.hidden).toBe(false);
  });

  it('shows again within 48px of the bottom of the document', () => {
    const maxScroll = TALL - VIEWPORT;
    let state = scrollTo(initialNavVisibility, 600);
    expect(state.hidden).toBe(true);
    // Still descending, but now at the end of the document.
    state = scrollTo(state, maxScroll - NAV_EDGE_ZONE + 1);
    expect(state.hidden).toBe(false);
  });

  it('shows again once scrolling stops for 700ms', () => {
    let state = scrollTo(initialNavVisibility, 600);
    expect(state.hidden).toBe(true);
    // Idle samples: same offset, time passing.
    state = scrollTo(state, 600, { dt: NAV_IDLE_MS - 100 });
    expect(state.hidden).toBe(true);
    state = scrollTo(state, 600, { dt: 200 });
    expect(state.hidden).toBe(false);
    expect(state.idleMs).toBeGreaterThanOrEqual(NAV_IDLE_MS);
  });

  it('reveals on any decisive upward move', () => {
    let state = scrollTo(initialNavVisibility, 600);
    expect(state.hidden).toBe(true);
    state = scrollTo(state, 600 - NAV_SCROLL_THRESHOLD);
    expect(state.hidden).toBe(false);
  });

  it('ignores jitter smaller than the threshold', () => {
    const state = scrollTo(initialNavVisibility, 600);
    const jittered = scrollTo(state, 600 + NAV_SCROLL_THRESHOLD - 1, { dt: 16 });
    expect(jittered.hidden).toBe(true);
    expect(jittered.lastY).toBe(600);
  });

  it('resets the idle clock on real movement', () => {
    let state = scrollTo(initialNavVisibility, 600, { dt: NAV_IDLE_MS });
    state = scrollTo(state, 900, { dt: 16 });
    expect(state.idleMs).toBe(0);
    expect(state.hidden).toBe(true);
  });

  it('never records a negative offset (rubber-band overscroll)', () => {
    const state = decideNavVisibility({ lastY: 300, hidden: true, idleMs: 0 }, sample({ scrollY: -40 }));
    expect(state.lastY).toBe(0);
    expect(state.hidden).toBe(false);
  });

  it('returns the same state object when nothing changed', () => {
    const state: NavVisibilityState = { lastY: 600, hidden: true, idleMs: 0 };
    expect(decideNavVisibility(state, sample({ scrollY: 600, dt: 0 }))).toBe(state);
  });
});

describe('hint storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubStorage(initial: Record<string, string> = {}) {
    const store = new Map(Object.entries(initial));
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    return store;
  }

  it('namespaces ids and leaves an already-prefixed key alone', () => {
    expect(hintStorageKey('swipe-pin')).toBe(`${HINT_PREFIX}swipe-pin`);
    expect(hintStorageKey(`${HINT_PREFIX}swipe-pin`)).toBe(`${HINT_PREFIX}swipe-pin`);
  });

  it('round-trips dismissal', () => {
    const store = stubStorage();
    expect(isHintDismissed('swipe-pin')).toBe(false);
    dismissHint('swipe-pin');
    expect(store.get(`${HINT_PREFIX}swipe-pin`)).toBe('1');
    expect(isHintDismissed('swipe-pin')).toBe(true);
    resetHint('swipe-pin');
    expect(isHintDismissed('swipe-pin')).toBe(false);
  });

  it('shows the hint rather than throwing when storage is unavailable', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('SecurityError');
      },
    });
    expect(isHintDismissed('swipe-pin')).toBe(false);
    expect(() => dismissHint('swipe-pin')).not.toThrow();
    expect(() => resetHint('swipe-pin')).not.toThrow();
  });
});
