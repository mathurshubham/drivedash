import { describe, expect, it } from 'vitest';

import { placeCoachmark, type Rect } from '../coachmark';

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
