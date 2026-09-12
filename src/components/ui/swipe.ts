/**
 * Pure swipe maths for `SwipeableRow`. Kept out of the component so it can be
 * unit tested without a DOM renderer.
 */

/** Horizontal travel at which an action pane is fully revealed. */
export const SWIPE_REVEAL = 72;
/** Travel past which a release triggers, regardless of velocity. */
export const SWIPE_THRESHOLD = 56;
/** A flick this fast triggers even from a short drag. */
export const SWIPE_VELOCITY = 0.4;
/** Hard stop on how far a row can be dragged. */
export const SWIPE_BOUND = 96;

export type SwipeOutcome = 'left' | 'right' | 'none';

/**
 * Decide what a release at offset `dx` (px, positive = dragged right) with
 * velocity `vx` (px/ms, signed) should do.
 *
 * Direction always comes from the offset, never the velocity: a flick back
 * toward centre must not fire the action it is retreating from.
 */
export function resolveSwipe(dx: number, vx: number): SwipeOutcome {
  const distance = Math.abs(dx);
  if (distance === 0) return 'none';

  const sameDirection = Math.sign(vx) === Math.sign(dx);
  const fast = sameDirection && Math.abs(vx) > SWIPE_VELOCITY;

  if (distance < SWIPE_THRESHOLD && !fast) return 'none';
  // A flick still needs to have moved far enough to be a drag, not a tap.
  if (distance < 12) return 'none';

  return dx > 0 ? 'right' : 'left';
}

/** Clamp a live drag offset to the bound, and to the directions that have an action. */
export function clampSwipe(dx: number, hasLeft: boolean, hasRight: boolean): number {
  const clamped = Math.max(-SWIPE_BOUND, Math.min(SWIPE_BOUND, dx));
  // `leftAction` is revealed by dragging right, and vice versa.
  if (clamped > 0 && !hasLeft) return 0;
  if (clamped < 0 && !hasRight) return 0;
  return clamped;
}

/** 0..1 progress toward a full reveal, for tinting the action pane. */
export function swipeProgress(dx: number): number {
  return Math.min(1, Math.abs(dx) / SWIPE_REVEAL);
}
