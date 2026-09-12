import { describe, expect, it } from 'vitest';

import { SHEET_CONTENT_MAX, SHEET_FULL, sheetSnapPoints } from '@/components/ui/sheetSnap';

/**
 * The points are fractions of `window.innerHeight` because that is what vaul
 * 1.1.2 multiplies them by: `offset = innerHeight - point * innerHeight`, so
 * `point * innerHeight` is the visible height of a full-height panel.
 */
const visibleHeight = (points: number[], index: number, viewport: number) =>
  points[index] * viewport;

describe('sheetSnapPoints', () => {
  it('opens a 701px viewport at the 560px content height, then 92%', () => {
    const points = sheetSnapPoints(701);
    expect(points).toHaveLength(2);
    expect(points[0]).toBeCloseTo(560 / 701, 10);
    expect(points[1]).toBe(SHEET_FULL);
    expect(visibleHeight(points, 0, 701)).toBeCloseTo(560, 6);
  });

  it('keeps the first point at 560px on a tall 915px phone rather than growing with the screen', () => {
    const points = sheetSnapPoints(915);
    expect(points[0]).toBeCloseTo(560 / 915, 10);
    expect(visibleHeight(points, 0, 915)).toBeCloseTo(560, 6);
    expect(points[1]).toBe(SHEET_FULL);
  });

  it('collapses to a single 92% point on a short viewport', () => {
    expect(sheetSnapPoints(500)).toEqual([SHEET_FULL]);
  });

  it('never opens at a fraction small enough to hide the list', () => {
    // The regression: `[0.55, 0.92]` left 386px showing on a 701px window.
    for (const viewport of [360, 500, 640, 661, 701, 740, 844, 915, 1180]) {
      const points = sheetSnapPoints(viewport);
      const first = visibleHeight(points, 0, viewport);
      // The first rest position is always the full content height (or the
      // whole expanded sheet when that is shorter) — never a bare fraction.
      expect(first).toBeGreaterThanOrEqual(Math.min(SHEET_CONTENT_MAX, viewport * SHEET_FULL) - 1e-6);
      // What the old `[0.55, 0.92]` got wrong: on every viewport where 55%
      // was short of the content, the list opened below the fold.
      if (0.55 * viewport < SHEET_CONTENT_MAX) expect(first).toBeGreaterThan(0.55 * viewport);
    }
  });

  it('returns ascending, distinct points capped at 92%', () => {
    for (const viewport of [320, 480, 500, 600, 661, 700, 701, 800, 915, 1024, 1440]) {
      const points = sheetSnapPoints(viewport);
      expect(points.length).toBeGreaterThanOrEqual(1);
      expect(points[points.length - 1]).toBe(SHEET_FULL);
      for (let i = 1; i < points.length; i += 1) {
        expect(points[i]).toBeGreaterThan(points[i - 1]);
        // Two rest positions closer than 48px read as a stuck drag.
        expect((points[i] - points[i - 1]) * viewport).toBeGreaterThanOrEqual(48);
      }
      for (const point of points) expect(point).toBeLessThanOrEqual(SHEET_FULL);
    }
  });

  it('falls back to the single expanded point when there is no viewport to measure', () => {
    // `useSyncExternalStore`'s server snapshot, and any non-browser renderer.
    expect(sheetSnapPoints(0)).toEqual([SHEET_FULL]);
    expect(sheetSnapPoints(Number.NaN)).toEqual([SHEET_FULL]);
    expect(sheetSnapPoints(-100)).toEqual([SHEET_FULL]);
  });
});
