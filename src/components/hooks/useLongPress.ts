'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import {
  LONG_PRESS_MS,
  initialLongPress,
  longPressReducer,
  type LongPressOptions,
  type LongPressState,
} from '@/components/hooks/longPress';

export type {
  LongPressOptions,
  LongPressState,
  LongPressEvent,
} from '@/components/hooks/longPress';
export { longPressReducer, initialLongPress } from '@/components/hooks/longPress';

export interface LongPressHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
  onContextMenu: (e: ReactMouseEvent) => void;
  onClickCapture: (e: ReactMouseEvent) => void;
}

/**
 * 450ms hold → `cb()`, cancelled by ~8px of travel. Buzzes for 10ms where
 * `navigator.vibrate` exists, and eats the click that a completed long press
 * would otherwise also produce, so "tap opens, long-press acts" stays true.
 *
 * Spread the returned handlers onto the element.
 */
export function useLongPress(cb: () => void, options: LongPressOptions = {}): LongPressHandlers {
  const ms = options.ms ?? LONG_PRESS_MS;
  const moveTolerance = options.moveTolerance;
  // Rebuilt from primitives so an inline options object cannot churn the
  // memoised handlers on every render.
  const opts = useMemo<LongPressOptions>(() => ({ ms, moveTolerance }), [ms, moveTolerance]);
  const state = useRef<LongPressState>(initialLongPress);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppress = useRef(false);
  const cbRef = useRef(cb);
  // Assigned in an effect, not during render: the handlers below are memoised
  // and only ever read this after a pointer event.
  useEffect(() => {
    cbRef.current = cb;
  }, [cb]);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      // Only a primary press starts a long press.
      if (e.button !== undefined && e.button !== 0) return;
      suppress.current = false;
      state.current = longPressReducer(
        state.current,
        { type: 'down', x: e.clientX, y: e.clientY, at: Date.now() },
        opts,
      ).state;
      clear();
      timer.current = setTimeout(() => {
        timer.current = null;
        const res = longPressReducer(state.current, { type: 'timer' }, opts);
        state.current = res.state;
        if (res.fire) {
          try {
            navigator.vibrate?.(10);
          } catch {
            // Vibration is best-effort.
          }
          cbRef.current();
        }
      }, ms);
    },
    [clear, ms, opts],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const before = state.current.phase;
      state.current = longPressReducer(
        state.current,
        { type: 'move', x: e.clientX, y: e.clientY },
        opts,
      ).state;
      if (before === 'pressing' && state.current.phase === 'idle') clear();
    },
    [clear, opts],
  );

  const onPointerUp = useCallback(() => {
    clear();
    const res = longPressReducer(state.current, { type: 'up' }, opts);
    state.current = res.state;
    suppress.current = res.suppressClick;
  }, [clear, opts]);

  const onPointerCancel = useCallback(() => {
    clear();
    state.current = longPressReducer(state.current, { type: 'cancel' }, opts).state;
    suppress.current = false;
  }, [clear, opts]);

  const onContextMenu = useCallback((e: ReactMouseEvent) => {
    // Touch devices raise a context menu at roughly the same moment; ours wins.
    if (state.current.phase === 'fired' || suppress.current) e.preventDefault();
  }, []);

  const onClickCapture = useCallback((e: ReactMouseEvent) => {
    if (!suppress.current) return;
    suppress.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu, onClickCapture };
}

export default useLongPress;
