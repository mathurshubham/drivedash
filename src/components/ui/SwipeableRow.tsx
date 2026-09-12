'use client';

import { useDrag } from '@use-gesture/react';
import { m, useReducedMotion } from 'motion/react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  SWIPE_BOUND,
  SWIPE_REVEAL,
  clampSwipe,
  resolveSwipe,
  swipeProgress,
} from '@/components/ui/swipe';

export type SwipeTone = 'accent' | 'neutral' | 'danger';

export interface SwipeAction {
  label: string;
  icon?: ReactNode;
  tone?: SwipeTone;
  onTrigger: () => void;
}

const TONE: Record<SwipeTone, string> = {
  accent: 'bg-accent-600 text-white',
  neutral: 'surface-2 text-fg',
  danger: 'bg-danger text-white',
};

export interface SwipeableRowProps {
  /** Revealed by dragging right (e.g. Pin). */
  leftAction?: SwipeAction;
  /** Revealed by dragging left (e.g. Share, Revoke). */
  rightAction?: SwipeAction;
  className?: string;
  children: ReactNode;
}

/**
 * Horizontal swipe-to-reveal. Releasing past 56px — or flicking faster than
 * 0.4px/ms — fires the action and snaps closed.
 *
 * `axis: 'x'` plus `filterTaps` means the gesture never claims a vertical
 * drag, so the list still scrolls normally. Under `prefers-reduced-motion` the
 * whole gesture layer is dropped and children render plainly; every action is
 * also reachable from the long-press sheet, so nothing becomes unavailable.
 */
export default function SwipeableRow({
  leftAction,
  rightAction,
  className = '',
  children,
}: SwipeableRowProps) {
  const reduced = useReducedMotion();
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pending = useRef<SwipeAction | null>(null);

  const hasLeft = Boolean(leftAction);
  const hasRight = Boolean(rightAction);

  const settle = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    action?.onTrigger();
  }, []);

  const bind = useDrag(
    ({ down, movement: [mx], velocity: [vx], direction: [dx], last }) => {
      if (last) {
        const outcome = resolveSwipe(mx, vx * (dx || Math.sign(mx)));
        if (outcome === 'right' && leftAction) pending.current = leftAction;
        else if (outcome === 'left' && rightAction) pending.current = rightAction;
        setDragging(false);
        setX(0);
        return;
      }
      setDragging(down);
      setX(clampSwipe(mx, hasLeft, hasRight));
    },
    {
      axis: 'x',
      filterTaps: true,
      pointer: { touch: true },
      bounds: { left: -SWIPE_BOUND, right: SWIPE_BOUND },
      rubberband: 0.2,
      from: () => [x, 0],
    },
  );

  if (reduced || (!hasLeft && !hasRight)) {
    return <div className={className}>{children}</div>;
  }

  const progress = swipeProgress(x);
  const showLeft = x > 0 && leftAction;
  const showRight = x < 0 && rightAction;
  const revealed = Math.min(Math.abs(x), SWIPE_REVEAL);

  return (
    <div className={`relative overflow-hidden ${className}`.trim()}>
      {showLeft ? (
        <div
          aria-hidden="true"
          style={{ width: revealed, opacity: progress }}
          className={`absolute inset-y-0 left-0 flex items-center justify-start overflow-hidden ${TONE[leftAction.tone ?? 'accent']}`}
        >
          <span className="flex w-[72px] shrink-0 flex-col items-center gap-0.5 text-[11px] font-semibold">
            {leftAction.icon}
            {leftAction.label}
          </span>
        </div>
      ) : null}

      {showRight ? (
        <div
          aria-hidden="true"
          style={{ width: revealed, opacity: progress }}
          className={`absolute inset-y-0 right-0 flex items-center justify-end overflow-hidden ${TONE[rightAction.tone ?? 'neutral']}`}
        >
          <span className="flex w-[72px] shrink-0 flex-col items-center gap-0.5 text-[11px] font-semibold">
            {rightAction.icon}
            {rightAction.label}
          </span>
        </div>
      ) : null}

      <m.div
        className="relative surface"
        animate={{ x }}
        transition={
          dragging ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }
        }
        onAnimationComplete={settle}
      >
        {/* The gesture binds to a plain element: its `onAnimationStart` is the
            DOM one, which clashes with motion's callback of the same name. */}
        {/* Vertical panning must stay with the scroller. */}
        <div {...bind()} style={{ touchAction: 'pan-y' }}>
          {children}
        </div>
      </m.div>
    </div>
  );
}

export { resolveSwipe } from '@/components/ui/swipe';
