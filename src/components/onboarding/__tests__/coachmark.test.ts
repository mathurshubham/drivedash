import { describe, expect, it } from 'vitest';

import {
  COACHMARK_MAX_WIDTH,
  COACHMARK_VERTICAL_MARGIN,
  coachmarkWidth,
  placeCoachmark,
  type Rect,
} from '../coachmark';

const viewport = { width: 390, height: 844 };
const cardSize = { width: 320, height: 160 };

function rect(partial: Partial<Rect>): Rect {
  return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, ...partial };
}

describe('placeCoachmark', () => {
  it('places the card above when there is enough room above (auto)', () => {
    // Target near the bottom: plenty of space above, little below.
    const target = rect({ top: 700, left: 100, right: 200, bottom: 740, width: 100, height: 40 });
    const pos = placeCoachmark(target, cardSize, viewport, 'auto');
    expect(pos.placement).toBe('top');
    expect(pos.top).toBeCloseTo(700 - 16 - 160);
  });

  it('places the card below when there is not enough room above (auto)', () => {
    // Target near the top: little space above.
    const target = rect({ top: 20, left: 100, right: 200, bottom: 60, width: 100, height: 40 });
    const pos = placeCoachmark(target, cardSize, viewport, 'auto');
    expect(pos.placement).toBe('bottom');
    expect(pos.top).toBeCloseTo(60 + 16);
  });

  it('honours a forced top/bottom preference', () => {
    const target = rect({ top: 20, left: 100, right: 200, bottom: 60, width: 100, height: 40 });
    expect(placeCoachmark(target, cardSize, viewport, 'bottom').placement).toBe('bottom');
    // Forcing 'top' near the top edge still resolves to 'top', clamped so it
    // stays on-screen rather than flipping sides.
    expect(placeCoachmark(target, cardSize, viewport, 'top').placement).toBe('top');
  });

  it('clamps horizontally within 12px of the viewport edges', () => {
    const nearLeftEdge = rect({ top: 400, left: 0, right: 20, bottom: 440, width: 20, height: 40 });
    const posLeft = placeCoachmark(nearLeftEdge, cardSize, viewport, 'auto');
    expect(posLeft.left).toBe(12);

    const nearRightEdge = rect({
      top: 400,
      left: viewport.width - 20,
      right: viewport.width,
      bottom: 440,
      width: 20,
      height: 40,
    });
    const posRight = placeCoachmark(nearRightEdge, cardSize, viewport, 'auto');
    expect(posRight.left).toBe(viewport.width - cardSize.width - 12);
  });

  it('centres the card on the target horizontally when there is room', () => {
    const target = rect({ top: 400, left: 140, right: 250, bottom: 440, width: 110, height: 40 });
    const pos = placeCoachmark(target, cardSize, viewport, 'auto');
    const expectedLeft = target.left + target.width / 2 - cardSize.width / 2;
    expect(pos.left).toBeCloseTo(expectedLeft);
  });

  it('never places the card above the top of the viewport', () => {
    const target = rect({ top: 0, left: 100, right: 200, bottom: 20, width: 100, height: 20 });
    const pos = placeCoachmark(target, cardSize, viewport, 'top');
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });
});

describe('placeCoachmark maxBottom', () => {
  // The real phone: 412x915 with a 24px gesture-bar inset and a 56px nav.
  const phone = { width: 412, height: 915 };
  const safeBottom = 24;

  it('keeps the whole card above maxBottom', () => {
    // Forced below a target near the bottom: without the bound the card's
    // buttons ran off the screen.
    const target = rect({ top: 820, left: 100, right: 200, bottom: 860, width: 100, height: 40 });
    const maxBottom = phone.height - safeBottom;
    const pos = placeCoachmark(target, cardSize, phone, 'bottom', maxBottom);
    expect(pos.top + cardSize.height).toBeLessThanOrEqual(maxBottom - COACHMARK_VERTICAL_MARGIN);
    expect(pos.top).toBeGreaterThanOrEqual(COACHMARK_VERTICAL_MARGIN);
  });

  it('sits above the bottom nav when the nav is the target', () => {
    // Step 1 spotlights the Search tab: the nav's top is the bound.
    const navTop = phone.height - safeBottom - 56;
    const target = rect({
      top: navTop + 6,
      left: 103,
      right: 206,
      bottom: navTop + 50,
      width: 103,
      height: 44,
    });
    const pos = placeCoachmark(target, cardSize, phone, 'top', navTop);
    expect(pos.placement).toBe('top');
    expect(pos.top + cardSize.height).toBeLessThanOrEqual(navTop - COACHMARK_VERTICAL_MARGIN);
  });

  it('clamps to the top margin when the card cannot fit above maxBottom', () => {
    const target = rect({ top: 60, left: 100, right: 200, bottom: 100, width: 100, height: 40 });
    const pos = placeCoachmark(target, cardSize, phone, 'bottom', 100);
    expect(pos.top).toBe(COACHMARK_VERTICAL_MARGIN);
  });

  it('defaults maxBottom to the viewport height', () => {
    const target = rect({ top: 820, left: 100, right: 200, bottom: 860, width: 100, height: 40 });
    const withDefault = placeCoachmark(target, cardSize, phone, 'bottom');
    const explicit = placeCoachmark(target, cardSize, phone, 'bottom', phone.height);
    expect(withDefault).toEqual(explicit);
  });
});

describe('coachmarkWidth', () => {
  it('never exceeds 320px', () => {
    expect(coachmarkWidth(1200)).toBe(COACHMARK_MAX_WIDTH);
    expect(coachmarkWidth(412)).toBe(COACHMARK_MAX_WIDTH);
  });

  it('leaves 12px either side on a narrow viewport', () => {
    expect(coachmarkWidth(320)).toBe(320 - 24);
    expect(coachmarkWidth(280)).toBe(256);
  });

  it('never goes negative', () => {
    expect(coachmarkWidth(10)).toBe(0);
  });
});
