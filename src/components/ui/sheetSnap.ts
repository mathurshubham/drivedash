/**
 * Snap points for the bottom sheet. Pure, so it can be unit-tested without
 * pulling vaul (and the Radix dialog behind it) into a node test run.
 */

/** Tallest the first rest position is ever allowed to be. */
export const SHEET_CONTENT_MAX = 560;
/** Fraction of the viewport the fully expanded sheet occupies. */
export const SHEET_FULL = 0.92;
/** Below this gap the two rest positions are indistinguishable, so we drop one. */
const MIN_GAP = 48;

/**
 * First snap = `min(560px, 92dvh)`, second = 92% of the viewport.
 *
 * The old `[0.55, 0.92]` put the first rest position at 55% of the viewport —
 * 386px on a 701px-tall window, less than the action sheet's own content, so
 * most of the sheet sat below the fold with nothing to suggest it could be
 * dragged. A px first point is content-sized instead, clamped so it can never
 * meet or exceed the expanded point (vaul needs the points distinct and
 * ascending).
 *
 * Returns vaul's `(number | string)[]`: numbers are viewport fractions,
 * strings are pixels. vaul runs `parseInt` over strings, so only plain
 * `"560px"` forms survive — never a `calc()` or `min()`.
 */
export function sheetSnapPoints(viewportHeight: number): (number | string)[] {
  const full = viewportHeight * SHEET_FULL;
  const content = Math.min(SHEET_CONTENT_MAX, Math.round(full));
  if (content >= full - MIN_GAP) return [SHEET_FULL];
  return [`${content}px`, SHEET_FULL];
}
