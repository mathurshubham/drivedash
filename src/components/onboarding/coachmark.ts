/**
 * Pure geometry for the Spotlight coachmark card. Kept dependency-free (no
 * DOM types beyond plain numbers) so it is trivially unit-testable in a node
 * test environment.
 */

export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export type Placement = 'auto' | 'top' | 'bottom';

export interface CoachmarkPosition {
  top: number;
  left: number;
  /** Resolved side, after considering available space. */
  placement: 'top' | 'bottom';
}

/** Gap between the spotlighted target and the coachmark card, in px. */
export const COACHMARK_GAP = 16;
/** Minimum horizontal distance from the viewport edge, in px. */
export const COACHMARK_MARGIN = 12;
/** Minimum vertical distance from either vertical bound, in px. */
export const COACHMARK_VERTICAL_MARGIN = 12;
/** The card is never wider than this, nor than `innerWidth - 24`. */
export const COACHMARK_MAX_WIDTH = 320;

/** `min(320, innerWidth - 24)` — the card's width at any viewport. */
export function coachmarkWidth(viewportWidth: number): number {
  return Math.max(0, Math.min(COACHMARK_MAX_WIDTH, viewportWidth - COACHMARK_MARGIN * 2));
}

/**
 * Places the coachmark card relative to the (already-measured) target rect.
 *
 * Rule (per DESIGN_PLAN §3): show the card above the target if the space
 * above is >= card height + 16px, else below. A `preferred` placement of
 * 'top' or 'bottom' forces that side (still clamped into the viewport so the
 * card never renders off-screen); 'auto' applies the space-based rule.
 * Horizontally the card is centred on the target and clamped so it never
 * comes within 12px of either viewport edge.
 *
 * `maxBottom` is the lowest y the card may reach — `innerHeight` minus the
 * safe-area inset, or the top of the bottom nav when the nav is what is being
 * spotlighted. Without it the phone pass cut the Skip/Next buttons off the
 * bottom of the screen on the last step.
 */
export function placeCoachmark(
  targetRect: Rect,
  cardSize: Size,
  viewport: Viewport,
  preferred: Placement = 'auto',
  maxBottom: number = viewport.height,
): CoachmarkPosition {
  const spaceAbove = targetRect.top;
  const needed = cardSize.height + COACHMARK_GAP;

  let placement: 'top' | 'bottom';
  if (preferred === 'top') {
    placement = 'top';
  } else if (preferred === 'bottom') {
    placement = 'bottom';
  } else {
    placement = spaceAbove >= needed ? 'top' : 'bottom';
  }

  // If the forced side genuinely has no room but the other side does, still
  // honour the forced side (design intent) but clamp vertically below so it
  // stays on-screen rather than overlapping the target illegibly.
  let top =
    placement === 'top'
      ? targetRect.top - COACHMARK_GAP - cardSize.height
      : targetRect.bottom + COACHMARK_GAP;

  const minTop = COACHMARK_VERTICAL_MARGIN;
  const bottomBound = Math.min(maxBottom, viewport.height);
  const maxTop = bottomBound - cardSize.height - COACHMARK_VERTICAL_MARGIN;
  if (maxTop >= minTop) {
    top = Math.min(Math.max(top, minTop), maxTop);
  } else {
    top = minTop;
  }

  const centeredLeft = targetRect.left + targetRect.width / 2 - cardSize.width / 2;
  const minLeft = COACHMARK_MARGIN;
  const maxLeft = viewport.width - cardSize.width - COACHMARK_MARGIN;
  const left = maxLeft >= minLeft ? Math.min(Math.max(centeredLeft, minLeft), maxLeft) : minLeft;

  return { top, left, placement };
}
