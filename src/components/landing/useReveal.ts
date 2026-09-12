'use client';

import { useEffect, useRef } from 'react';

/** Class the CSS transition in `globals.css` keys off. */
export const REVEALED = 'is-revealed';

/**
 * Reveal-on-scroll, as small as it gets: one `IntersectionObserver` per
 * element, which adds a class and then disconnects. The animation itself is a
 * CSS transition (`.reveal` → `.reveal.is-revealed`), so nothing from motion
 * is pulled into this public page's bundle, and reduced motion is handled once
 * in the stylesheet rather than per component.
 */
export function useReveal<T extends HTMLElement>(): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No observer (or reduced motion): show it, immediately and for good.
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      el.classList.add(REVEALED);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add(REVEALED);
          observer.disconnect();
        }
      },
      // Fires a little before the element's top edge arrives, so the motion
      // has finished by the time it is properly in view.
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
