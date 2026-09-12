'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export interface IndicatorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The `layoutId` stand-in.
 *
 * DESIGN_PLAN asks for a `layoutId` selection pill, but layout animations are
 * only in motion's `domMax` feature bundle and we are pinned to `domAnimation`
 * for size. Measuring the active element and animating a single absolutely
 * positioned `m.span` to that box gives the same effect for ~0 extra bytes.
 *
 * Returns a ref for the container, a registrar for each item, and the box the
 * indicator should occupy (null until measured, so render nothing then).
 */
export function useSlidingIndicator<K extends string>(activeKey: K | null) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const items = useRef(new Map<string, HTMLElement>());
  const [rect, setRect] = useState<IndicatorRect | null>(null);

  const register = useCallback((key: string, el: HTMLElement | null) => {
    if (el) items.current.set(key, el);
    else items.current.delete(key);
  }, []);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const el = activeKey === null ? undefined : items.current.get(activeKey);
    if (!container || !el) {
      setRect(null);
      return;
    }
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setRect({ x: r.left - c.left, y: r.top - c.top, width: r.width, height: r.height });
  }, [activeKey]);

  useLayoutEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    return () => ro.disconnect();
  }, [measure]);

  return { containerRef, register, rect, measure };
}
