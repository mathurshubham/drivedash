'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';

export interface SwipeHintProps {
  /** localStorage key, e.g. 'dd.hint.swipe-pin'. Set to 'dismissed' once shown-and-dismissed. */
  storageKey: string;
  label?: string;
  children: ReactNode;
  className?: string;
}

function readDismissed(storageKey: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(storageKey) === 'dismissed';
  } catch {
    return true;
  }
}

function writeDismissed(storageKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, 'dismissed');
  } catch {
    // Storage unavailable (private mode etc); nothing to persist.
  }
}

/**
 * First-time hint badge anchored to a child, e.g. the first file row:
 *
 *   <SwipeHint storageKey="dd.hint.swipe-pin"><FileRow .../></SwipeHint>
 *
 * Self-contained (no dependency on Agent A's `HintBadge` — Agent C may swap
 * this shell for that primitive later without changing the call site props).
 * SSR-safe: renders hidden on the server/first paint, then an effect reveals
 * it if the storage key hasn't been dismissed yet. Dismissed on any
 * pointerdown inside (i.e. the user interacting with the child at all).
 */
export default function SwipeHint({
  storageKey,
  label = 'Swipe → to pin',
  children,
  className,
}: SwipeHintProps) {
  const reducedMotion = useReducedMotion();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Reads localStorage (unavailable during SSR/first paint, hence the
    // effect rather than a lazy useState initializer that must match
    // between server and client render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissed(storageKey));
  }, [storageKey]);

  const dismiss = () => {
    if (dismissed) return;
    writeDismissed(storageKey);
    setDismissed(true);
  };

  return (
    <div className={`relative ${className ?? ''}`} onPointerDown={dismiss}>
      {children}
      {!dismissed ? (
        <span
          role="status"
          className="pointer-events-none absolute -top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-accent-600 px-2 py-1 text-[11px] font-medium text-white shadow dark:bg-accent-500"
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full bg-white ${reducedMotion ? '' : 'animate-pulse'}`}
          />
          {label}
        </span>
      ) : null}
    </div>
  );
}
