import { describe, expect, it } from 'vitest';

import {
  COACHMARK_MAX_WIDTH,
  COACHMARK_NAV_GAP,
  COACHMARK_VERTICAL_MARGIN,
  CUTOUT_HEADER_GAP,
  coachmarkMaxBottom,
  coachmarkWidth,
  cutoutTop,
  placeCoachmark,
  placeCoachmarkAboveNav,
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

describe('coachmarkMaxBottom', () => {
  it('falls back to the safe-area floor when no nav is visible', () => {
    expect(coachmarkMaxBottom(915, 24, null)).toBe(891);
  });

  it('lifts the floor to nav top minus the gap when the nav is visible', () => {
    expect(coachmarkMaxBottom(915, 24, 820)).toBe(820 - COACHMARK_NAV_GAP);
  });

  it('never returns a floor below the safe-area inset', () => {
    // A nav whose top is under the inset (mid-slide) must not push the floor
    // back down past the safe area.
    expect(coachmarkMaxBottom(915, 24, 910)).toBe(891);
  });
});

describe('placeCoachmark with the nav visible', () => {
  // The reported device: Android Chrome, 412x915.
  const phoneViewport = { width: 412, height: 915 };
  const navTop = 835;
  const maxBottom = coachmarkMaxBottom(phoneViewport.height, 24, navTop);

  it('keeps the card clear of the nav for a target near the bottom of content', () => {
    // A shelf tile sitting just above the nav: without the floor, 'auto' puts
    // the card below the target and straight over the nav.
    const target = rect({ top: 700, left: 20, right: 392, bottom: 780, width: 372, height: 80 });
    const pos = placeCoachmark(target, cardSize, phoneViewport, 'auto', maxBottom);
    expect(pos.top + cardSize.height).toBeLessThanOrEqual(navTop - COACHMARK_NAV_GAP);
  });

  it('keeps the card clear of the nav even when "bottom" is forced', () => {
    const target = rect({ top: 700, left: 20, right: 392, bottom: 780, width: 372, height: 80 });
    const pos = placeCoachmark(target, cardSize, phoneViewport, 'bottom', maxBottom);
    expect(pos.placement).toBe('bottom');
    expect(pos.top + cardSize.height).toBeLessThanOrEqual(navTop - COACHMARK_NAV_GAP);
  });
});

describe('placeCoachmarkAboveNav', () => {
  // The reported desktop-narrow window: Chrome at 555x701, tour step 1, whose
  // target is the Search item inside the bottom nav.
  const window555 = { width: 555, height: 701 };
  const navTop = 644;
  const navItem = rect({ top: 648, left: 222, right: 333, bottom: 700, width: 111, height: 52 });

  it('anchors the card exactly one nav gap above the nav', () => {
    // The real measured card height. The bug was a *stale* one (the 180px
    // estimate), which left the card's bottom edge inside the nav.
    const card = { width: 320, height: 217 };
    const pos = placeCoachmarkAboveNav(navItem, card, window555, navTop);
    expect(pos.placement).toBe('top');
    expect(pos.top).toBe(644 - COACHMARK_NAV_GAP - 217);
    expect(pos.top).toBe(415);
    expect(pos.top + card.height).toBe(navTop - COACHMARK_NAV_GAP);
  });

  it('never pushes the card off the top of the viewport', () => {
    const tall = { width: 320, height: 900 };
    const pos = placeCoachmarkAboveNav(navItem, tall, window555, navTop);
    expect(pos.top).toBe(COACHMARK_VERTICAL_MARGIN);
  });

  it('centres on the nav item and clamps to the viewport like placeCoachmark', () => {
    const card = { width: 320, height: 217 };
    const pos = placeCoachmarkAboveNav(navItem, card, window555, navTop);
    expect(pos.left).toBeCloseTo(placeCoachmark(navItem, card, window555, 'top').left);
    expect(pos.left).toBeGreaterThanOrEqual(12);
    expect(pos.left + card.width).toBeLessThanOrEqual(window555.width - 12);
  });
});

describe('cutoutTop', () => {
  it('leaves the rect alone when there is no sticky header', () => {
    expect(cutoutTop(100, 400, null)).toBe(100);
  });

  it('pushes the hole below a header that overlaps it', () => {
    // Greeting bar ends at 92; the shelves cutout starts at 60, so the hole
    // would otherwise frame the translucent header.
    expect(cutoutTop(60, 400, 92)).toBe(92 + CUTOUT_HEADER_GAP);
  });

  it('leaves the rect alone when the header sits entirely above it', () => {
    expect(cutoutTop(300, 500, 92)).toBe(300);
  });

  it('leaves the rect alone when the header covers the whole cutout', () => {
    // Nothing useful left to reveal; moving the top would invert the rect.
    expect(cutoutTop(60, 80, 92)).toBe(60);
  });
});
