/**
 * Snap points for the bottom sheet. Pure, so it can be unit-tested without
 * pulling vaul (and the Radix dialog behind it) into a node test run.
 */

/** Tallest the first rest position is ever allowed to be, in px. */
export const SHEET_CONTENT_MAX = 560;
/** Fraction of the viewport the fully expanded sheet occupies. */
export const SHEET_FULL = 0.92;
/** Below this gap (px) the two rest positions are indistinguishable, so we drop one. */
const MIN_GAP = 48;

/**
 * First snap = `min(560px, 92dvh)`, second = 92% of the viewport — both as
 * **fractions of `window.innerHeight`**.
 *
 * Why fractions and not `"560px"`: vaul 1.1.2 turns every snap point into a
 * `translateY` offset with
 *
 *     offset = containerHeight - (isPx ? parseInt(point) : point * containerHeight)
 *
 * and `containerHeight` is `window.innerHeight` unless a custom `container`
 * is passed (`useSnapPoints` → `snapPointsOffset`, dist/index.mjs). It never
 * measures the drawer. So the visible height is only equal to the snap point
 * when the drawer element is itself exactly `innerHeight` tall — which is why
 * `SheetImpl` no longer caps the panel at `92dvh`. Once the panel is
 * `h-full`, px strings and fractions are equivalent; fractions are used
 * because they keep this function's output one type and make the last point
 * (`0.92`) and the first commensurable.
 *
 * The old `[0.55, 0.92]` put the first rest position at 55% of the viewport —
 * 386px on a 701px-tall window, less than the action sheet's own content, so
 * most of the sheet sat below the fold with nothing to suggest it could be
 * dragged. A content-sized first point fixes that, clamped so it can never
 * meet or exceed the expanded point (vaul needs the points distinct and
 * ascending).
 */
export function sheetSnapPoints(viewportHeight: number): number[] {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return [SHEET_FULL];
  const full = viewportHeight * SHEET_FULL;
  const content = Math.min(SHEET_CONTENT_MAX, full);
  // On a short viewport the content-sized point lands within a thumb's travel
  // of the expanded one; two rest positions that close read as a stuck drag.
  if (content >= full - MIN_GAP) return [SHEET_FULL];
  return [content / viewportHeight, SHEET_FULL];
}
