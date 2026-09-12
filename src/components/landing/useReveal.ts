'use client';

import { useEffect, useRef } from 'react';

/** Applies the hidden-and-offset start state. Added by JS, never by the server. */
export const REVEAL = 'reveal';
/** Class the CSS transition in `globals.css` transitions *to*. */
export const REVEALED = 'is-revealed';

/**
 * Reveal-on-scroll, as small as it gets: one `IntersectionObserver` per
 * element, which adds a class and then disconnects. The movement itself is a
 * CSS transition (`.reveal` → `.reveal.is-revealed`), so nothing from motion
 * is pulled into this public page's bundle and reduced motion is handled once
 * in the stylesheet rather than per component.
 *
 * The start state is applied *by this hook*, not by the server-rendered class
 * list, and only to elements that are below the fold. That ordering matters:
 * markup that ships at `opacity: 0` and waits for JS to un-hide it is the same
 * failure mode as a motion `initial` that never animates — if the script is
 * slow, blocked or broken, the page is simply blank. Here the server sends a
 * finished page, and the animation is something JS adds on top.
 */
export function useReveal<T extends HTMLElement>(): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    // Already on screen: leave it alone rather than hiding it just to fade it
    // straight back in.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;

    el.classList.add(REVEAL);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add(REVEALED);
          observer.disconnect();
        }
      },
      // Fires a little before the element's top edge arrives, so the movement
      // has finished by the time it is properly in view.
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
