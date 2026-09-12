/** Pure placement maths for `Toggletip`. */

export interface Rect {
  top: number;
  left: number;
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

export interface Placement {
  top: number;
  left: number;
  side: 'top' | 'bottom';
}

/** Gap between anchor and popover, and the minimum inset from any edge. */
export const POPOVER_GAP = 8;
export const POPOVER_MARGIN = 12;

/**
 * Place `size` next to `anchor` in viewport coordinates: above if it fits,
 * otherwise below, then clamped so it never leaves a 12px margin.
 */
export function placePopover(anchor: Rect, size: Size, viewport: Viewport): Placement {
  const roomAbove = anchor.top - POPOVER_MARGIN;
  const roomBelow = viewport.height - (anchor.top + anchor.height) - POPOVER_MARGIN;
  const needed = size.height + POPOVER_GAP;

  // Prefer above; fall back to below; if neither fits, take the roomier side.
  let side: 'top' | 'bottom';
  if (needed <= roomAbove) side = 'top';
  else if (needed <= roomBelow) side = 'bottom';
  else side = roomAbove >= roomBelow ? 'top' : 'bottom';

  const rawTop =
    side === 'top' ? anchor.top - size.height - POPOVER_GAP : anchor.top + anchor.height + POPOVER_GAP;

  const maxTop = Math.max(POPOVER_MARGIN, viewport.height - size.height - POPOVER_MARGIN);
  const top = Math.min(Math.max(rawTop, POPOVER_MARGIN), maxTop);

  const rawLeft = anchor.left + anchor.width / 2 - size.width / 2;
  const maxLeft = Math.max(POPOVER_MARGIN, viewport.width - size.width - POPOVER_MARGIN);
  const left = Math.min(Math.max(rawLeft, POPOVER_MARGIN), maxLeft);

  return { top, left, side };
}
