'use client';

import { useEffect, useRef, useState } from 'react';
import {
  initialScrollState,
  scrollDirectionReducer,
  type ScrollState,
} from '@/components/hooks/scrollDirection';

export { scrollDirectionReducer, initialScrollState } from '@/components/hooks/scrollDirection';
export type { ScrollState } from '@/components/hooks/scrollDirection';

/**
 * `'down'` once the page has scrolled more than 8px downward, `'up'` again on
 * any upward move or near the top. Reads are rAF-throttled so the listener
 * costs one layout read per frame at most.
 */
export function useScrollDirection(): 'up' | 'down' {
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const state = useRef<ScrollState>(initialScrollState);

  useEffect(() => {
    let frame = 0;

    const read = () => {
      frame = 0;
      const next = scrollDirectionReducer(state.current, window.scrollY);
      if (next === state.current) return;
      state.current = next;
      setDirection(next.direction);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(read);
    };

    state.current = scrollDirectionReducer(initialScrollState, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return direction;
}

export default useScrollDirection;
