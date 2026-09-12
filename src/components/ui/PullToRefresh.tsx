'use client';

import { RefreshCw } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useCallback, useRef, useState, type ReactNode, type TouchEvent } from 'react';

export const PULL_THRESHOLD = 64;
/** Keep the spinner on screen long enough to read, even on a fast refresh. */
const MIN_VISIBLE_MS = 500;
/** Resistance, so the sheet of content lags the finger. */
const DAMPING = 0.5;

export interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  /** Disables the gesture, e.g. while a sheet is open. */
  disabled?: boolean;
  /**
   * Which scroller must be at the top for the pull to engage. `'self'` (the
   * default) reads the wrapper's own `scrollTop`; use `'window'` when the
   * document scrolls instead — otherwise `scrollTop` is always 0 and the pull
   * would fire halfway down the page.
   */
  scrollRoot?: 'self' | 'window';
  className?: string;
  children: ReactNode;
}

/**
 * Touch-only pull-to-refresh around a scroll container. Engages only when the
 * container is already at the top and the finger moves down, so it never
 * fights a normal scroll. Mouse and keyboard users refresh by navigating.
 */
export default function PullToRefresh({
  onRefresh,
  disabled = false,
  scrollRoot = 'self',
  className = '',
  children,
}: PullToRefreshProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const scrolled = useCallback(
    () => (scrollRoot === 'window' ? window.scrollY > 0 : (ref.current?.scrollTop ?? 0) > 0),
    [scrollRoot],
  );

  const onTouchStart = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (disabled || refreshing) return;
      if (!ref.current || scrolled()) return;
      startY.current = e.touches[0].clientY;
    },
    [disabled, refreshing, scrolled],
  );

  const onTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (startY.current === null) return;
      if (scrolled()) {
        startY.current = null;
        setPull(0);
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      setPull(Math.min(dy * DAMPING, PULL_THRESHOLD * 1.5));
    },
    [scrolled],
  );

  const onTouchEnd = useCallback(async () => {
    const travelled = pull;
    startY.current = null;
    setPull(0);
    if (travelled < PULL_THRESHOLD || refreshing) return;

    setRefreshing(true);
    const started = Date.now();
    try {
      await onRefresh();
    } finally {
      const remaining = MIN_VISIBLE_MS - (Date.now() - started);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setRefreshing(false);
    }
  }, [onRefresh, pull, refreshing]);

  const progress = Math.min(1, pull / PULL_THRESHOLD);
  const active = refreshing || pull > 0;

  return (
    <div className="relative">
      <div
        aria-hidden={!refreshing}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
        style={{
          height: refreshing ? PULL_THRESHOLD : pull,
          opacity: refreshing ? 1 : progress,
        }}
      >
        <m.span
          className="mt-3 flex h-8 w-8 items-center justify-center rounded-full border border-subtle surface text-muted shadow-pop"
          animate={refreshing && !reduced ? { rotate: 360 } : { rotate: progress * 270 }}
          transition={
            refreshing && !reduced
              ? { repeat: Infinity, ease: 'linear', duration: 0.8 }
              : { duration: 0 }
          }
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
        </m.span>
      </div>

      <div
        ref={ref}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        // `contain` stops the pull from becoming the browser's own overscroll.
        style={{
          overscrollBehaviorY: 'contain',
          transform: active && !reduced ? `translateY(${refreshing ? PULL_THRESHOLD : pull}px)` : undefined,
          transition: pull > 0 ? 'none' : 'transform 200ms cubic-bezier(.2,.8,.2,1)',
        }}
        className={className}
      >
        {children}
      </div>
      <span aria-live="polite" className="sr-only">
        {refreshing ? 'Refreshing' : ''}
      </span>
    </div>
  );
}
