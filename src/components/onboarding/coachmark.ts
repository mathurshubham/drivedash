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
/** Minimum vertical distance from the viewport edge, in px (safety clamp). */
export const COACHMARK_VERTICAL_MARGIN = 8;

/**
 * Places the coachmark card relative to the (already-measured) target rect.
 *
 * Rule (per DESIGN_PLAN §3): show the card above the target if the space
 * above is >= card height + 16px, else below. A `preferred` placement of
 * 'top' or 'bottom' forces that side (still clamped into the viewport so the
 * card never renders off-screen); 'auto' applies the space-based rule.
 * Horizontally the card is centred on the target and clamped so it never
 * comes within 12px of either viewport edge.
 */
export function placeCoachmark(
  targetRect: Rect,
  cardSize: Size,
  viewport: Viewport,
  preferred: Placement = 'auto',
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
  const maxTop = viewport.height - cardSize.height - COACHMARK_VERTICAL_MARGIN;
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
