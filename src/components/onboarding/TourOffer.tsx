'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';

export interface TourOfferProps {
  onStart: () => void;
  onNotNow: () => void;
}

const APPEAR_DELAY_MS = 400;

/**
 * "New here? Take a 30-second tour" card. Non-modal (`role="dialog"` without
 * `aria-modal`) so it doesn't trap focus or block the page; announced via
 * `aria-live="polite"` once it appears.
 */
export default function TourOffer({ onStart, onNotNow }: TourOfferProps) {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {visible ? (
          <m.div
            role="dialog"
            aria-live="polite"
            aria-label="Tour offer"
            // z-45, not z-40: at the nav's own layer the card lost the tie on
            // DOM order and its buttons took no clicks. See the z-layer table
            // in `src/components/ui/README.md`.
            className="fixed inset-x-4 bottom-4 z-[45] mx-auto max-w-[400px] rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg pb-safe dark:border-neutral-800 dark:bg-neutral-900"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <p className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">
              New here?
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Take a 30-second tour to see where everything lives.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onNotNow}
                className="min-h-[44px] flex-1 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={onStart}
                className="min-h-[44px] flex-1 rounded-xl bg-accent-600 text-sm font-medium text-white hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:bg-accent-500 dark:hover:bg-accent-600"
              >
                Start
              </button>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </LazyMotion>
  );
}
