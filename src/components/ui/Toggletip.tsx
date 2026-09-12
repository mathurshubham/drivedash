'use client';

import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Info } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { placePopover, type Placement } from '@/components/ui/placePopover';

export interface ToggletipProps {
  /** Accessible name for the trigger, e.g. "About link expiry". */
  label: string;
  /** Popover body. */
  children: ReactNode;
  className?: string;
}

/**
 * Tap-to-open explainer. A toggletip, not a tooltip: it opens on click (not
 * hover), holds focusable content, and closes on outside pointerdown, Escape
 * or scroll.
 */
export default function Toggletip({ label, children, className = '' }: ToggletipProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const measure = useCallback(() => {
    const anchor = anchorRef.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;
    const a = anchor.getBoundingClientRect();
    setPlacement(
      placePopover(
        { top: a.top, left: a.left, width: a.width, height: a.height },
        { width: pop.offsetWidth, height: pop.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, []);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    /**
     * Capture phase on `window`, so this runs before vaul's own document-level
     * Escape handler: otherwise Escape inside a toggletip closed the popover
     * *and* the sheet around it. `stopImmediatePropagation` also stops any
     * other capture listener registered on window after this one.
     */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
      anchorRef.current?.focus();
    };
    const onScroll = () => setOpen(false);

    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  // Placement is only meaningful while open; a stale value is never read.
  const pos = open ? placement : null;

  return (
    <span className={`inline-flex ${className}`.trim()}>
      <button
        type="button"
        ref={anchorRef}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <Info aria-hidden="true" className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open ? (
          <m.div
            id={id}
            ref={popRef}
            role="dialog"
            aria-label={label}
            initial={reduced ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            transition={{ duration: reduced ? 0 : 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              // Hidden until measured so it never flashes at 0,0.
              visibility: pos ? 'visible' : 'hidden',
            }}
            className="fixed z-50 w-[min(20rem,calc(100vw-24px))] rounded-md border border-subtle surface p-3 text-sm shadow-pop"
          >
            {children}
          </m.div>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
