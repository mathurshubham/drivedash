import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  SWIPE_BOUND,
  SWIPE_THRESHOLD,
  clampSwipe,
  resolveSwipe,
  swipeProgress,
} from '@/components/ui/swipe';
import { POPOVER_MARGIN, placePopover } from '@/components/ui/placePopover';
import { SHEET_CONTENT_MAX, SHEET_FULL, sheetSnapPoints } from '@/components/ui/sheetSnap';
import {
  initialLongPress,
  longPressReducer,
  type LongPressState,
} from '@/components/hooks/longPress';
import {
  SCROLL_THRESHOLD,
  initialScrollState,
  scrollDirectionReducer,
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

describe('scrollDirectionReducer', () => {
  it('stays up near the top of the page', () => {
    expect(scrollDirectionReducer(initialScrollState, 10).direction).toBe('up');
    expect(scrollDirectionReducer({ lastY: 400, direction: 'down' }, 0).direction).toBe('up');
  });

  it('ignores movement below the threshold', () => {
    const state = { lastY: 200, direction: 'up' as const };
    expect(scrollDirectionReducer(state, 200 + SCROLL_THRESHOLD - 1)).toBe(state);
    expect(scrollDirectionReducer(state, 200 - SCROLL_THRESHOLD + 1)).toBe(state);
  });

  it('flips on a decisive move in each direction', () => {
    const down = scrollDirectionReducer({ lastY: 200, direction: 'up' }, 240);
    expect(down).toEqual({ lastY: 240, direction: 'down' });
    expect(scrollDirectionReducer(down, 190)).toEqual({ lastY: 190, direction: 'up' });
  });

  it('never records a negative offset (rubber-band overscroll)', () => {
    expect(scrollDirectionReducer({ lastY: 300, direction: 'down' }, -40).lastY).toBe(0);
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

describe('sheetSnapPoints', () => {
  it('caps the first rest position at the content maximum on a tall viewport', () => {
    expect(sheetSnapPoints(844)).toEqual([`${SHEET_CONTENT_MAX}px`, SHEET_FULL]);
  });

  it('keeps the first rest position inside a short viewport', () => {
    // 701 * 0.92 = 645, so the 560px content cap still fits.
    expect(sheetSnapPoints(701)).toEqual([`${SHEET_CONTENT_MAX}px`, SHEET_FULL]);
    // 600 * 0.92 = 552 — the cap would land within 48px of the expanded point.
    expect(sheetSnapPoints(600)).toEqual([SHEET_FULL]);
  });

  it('never returns points that are equal or out of order', () => {
    for (const h of [320, 480, 600, 640, 667, 701, 844, 1024, 1600]) {
      const points = sheetSnapPoints(h);
      const px = points.map((p) => (typeof p === 'string' ? parseInt(p, 10) : p * h));
      expect(px.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
      for (let i = 1; i < px.length; i += 1) expect(px[i]).toBeGreaterThan(px[i - 1]);
      expect(px[px.length - 1]).toBeLessThanOrEqual(h);
    }
  });
});
