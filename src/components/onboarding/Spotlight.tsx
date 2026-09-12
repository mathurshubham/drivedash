'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import Portal from '@/components/ui/Portal';
import { lockNav, showNav } from '@/components/hooks/useScrollDirection';
import { coachmarkWidth, placeCoachmark, type CoachmarkPosition, type Rect } from './coachmark';
import { nextVisibleStep } from './stepVisibility';
import type { TourStep } from './tourSteps';

export interface SpotlightProps {
  steps: TourStep[];
  open: boolean;
  onClose: (completed: boolean) => void;
}

const PADDING = 8;
const RADIUS = 14;
const DEFAULT_CARD_SIZE = { width: 320, height: 180 };
/**
 * The nav animates back in over 200ms (`BottomNav`), and a transform fires no
 * ResizeObserver, so a rect read on the first frame after `dd:nav:show` is the
 * nav's *hidden* position. Re-read across the transition instead.
 */
const REMEASURE_AFTER_MS = [0, 120, 260];

function bottomNavEl(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>('nav[aria-label="Primary"]');
}

/** `env(safe-area-inset-bottom)` in px, measured off a throwaway probe. */
function safeAreaBottom(): number {
  if (typeof document === 'undefined') return 0;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  const value = Number.parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  return value;
}

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

function hasTargetInDom(step: TourStep): boolean {
  return typeof document !== 'undefined' && document.querySelector(`[data-tour="${step.target}"]`) !== null;
}

function targetElOf(step: TourStep): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
}

/**
 * Hand-rolled first-run guided tour overlay. Dynamically imported by
 * `TourLauncher` (see DESIGN_PLAN §3 / §0 bundle discipline).
 *
 * Pointer-events decision (documented per task spec): the overlay blocks
 * *all* pointer events, including the area directly over the spotlighted
 * cutout. The cutout is a purely visual affordance (via an SVG mask) that
 * shows the user which element the copy refers to; it is not an interactive
 * passthrough to the app underneath. This keeps the tour modal-like and
 * avoids users accidentally triggering app actions mid-tour. A dedicated,
 * fully opaque-to-pointer click-catcher div sits under the SVG (which is
 * itself `pointer-events-none`, purely decorative) so blocking behaviour
 * does not depend on SVG mask/paint hit-testing quirks.
 */
export default function Spotlight({ steps, open, onClose }: SpotlightProps) {
  const reducedMotion = useReducedMotion();
  // Sanitised: raw useId() ids contain ':' which some browsers mis-handle
  // inside an SVG mask="url(#...)" reference.
  const rawId = useId();
  const maskId = `spotlight-mask-${rawId.replace(/:/g, '')}`;
  const cardRef = useRef<HTMLDivElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  const [stepIndex, setStepIndex] = useState(-1);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [cardSize, setCardSize] = useState(DEFAULT_CARD_SIZE);
  /**
   * `navTop` is set only when the step's target lives inside the bottom nav —
   * the card then sits above the nav rather than on top of it.
   */
  const [bounds, setBounds] = useState<{ navTop: number | null; safeBottom: number }>({
    navTop: null,
    safeBottom: 0,
  });
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }));

  const step = stepIndex >= 0 ? steps[stepIndex] : null;

  const advance = useCallback(
    (fromIndex: number) => {
      const next = nextVisibleStep(steps, hasTargetInDom, fromIndex, 1);
      if (next === -1) {
        onClose(true);
        setStepIndex(-1);
      } else {
        setStepIndex(next);
      }
    },
    [steps, onClose],
  );

  const skip = useCallback(() => {
    onClose(false);
    setStepIndex(-1);
  }, [onClose]);

  // Open/close lifecycle: find the first visible step, or close immediately
  // if none of the steps have a target on the page.
  // Synchronizes internal step/target state with the `open` prop (an
  // external, parent-controlled lifecycle signal) and the DOM (which steps
  // currently have a live `[data-tour]` target) — not derivable from
  // props/state alone, so the direct setState calls below are intentional.
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStepIndex(-1);
      setTargetRect(null);
      return;
    }
    const first = nextVisibleStep(steps, hasTargetInDom, -1, 1);
    if (first === -1) {
      onClose(false);
      return;
    }
    setStepIndex(first);
    // Only re-run when `open` flips; step navigation is handled by
    // advance/skip so we intentionally don't depend on `steps`/`onClose`
    // identity here to avoid restarting mid-tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Pin the nav visible for the whole tour: step 1 spotlights the Search tab,
  // and a hidden nav gives it nothing to point at.
  useEffect(() => {
    if (!open) return;
    return lockNav();
  }, [open]);

  // Measure (and scroll into view) whenever the current step changes.
  useLayoutEffect(() => {
    if (!step) return;

    // Ask for the nav *before* measuring, then let a frame pass so it is on
    // screen (and its target hit-testable) when the rect is read.
    showNav();

    let ro: ResizeObserver | null = null;
    let raf = 0;
    const timers: number[] = [];
    let remeasure: (() => void) | null = null;

    const start = () => {
      const el = targetElOf(step);
      if (!el) {
        // Target vanished (or never existed) even after the nav-show attempt;
        // skip forward automatically. Depends on live DOM state, so it can't
        // be derived during render.
        advance(stepIndex);
        return;
      }
      el.scrollIntoView({ block: 'center', behavior: 'auto' });

      const read = () => {
        setTargetRect(rectOf(el));
        const nav = bottomNavEl();
        const navTop = nav && nav.contains(el) ? nav.getBoundingClientRect().top : null;
        setBounds({ navTop, safeBottom: safeAreaBottom() });
      };
      remeasure = read;
      read();
      for (const ms of REMEASURE_AFTER_MS.slice(1)) {
        timers.push(window.setTimeout(read, ms));
      }

      ro = new ResizeObserver(read);
      ro.observe(el);
      window.addEventListener('resize', read);
      window.addEventListener('scroll', read, true);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    raf = requestAnimationFrame(start);

    return () => {
      cancelAnimationFrame(raf);
      for (const t of timers) clearTimeout(t);
      ro?.disconnect();
      if (remeasure) {
        window.removeEventListener('resize', remeasure);
        window.removeEventListener('scroll', remeasure, true);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stepIndex]);

  // Track card size so positioning accounts for actual (variable) content
  // height, not just the default estimate.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const measure = () => setCardSize({ width: card.offsetWidth, height: card.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(card);
    return () => ro.disconnect();
  }, [step]);

  // Focus the primary action whenever a step becomes visible.
  useEffect(() => {
    if (step) nextButtonRef.current?.focus();
  }, [step]);

  // Escape closes as skip; Tab/Shift+Tab trap focus inside the card.
  useEffect(() => {
    if (!step) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skip();
        return;
      }
      if (e.key === 'Tab') {
        const card = cardRef.current;
        if (!card) return;
        const focusables = card.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [step, skip]);

  if (!step || !targetRect) return null;

  const padded: Rect = {
    top: targetRect.top - PADDING,
    left: targetRect.left - PADDING,
    right: targetRect.right + PADDING,
    bottom: targetRect.bottom + PADDING,
    width: targetRect.width + PADDING * 2,
    height: targetRect.height + PADDING * 2,
  };

  const cardWidth = coachmarkWidth(viewport.width);
  // Never let the card run off the bottom: stop at the safe-area inset, or at
  // the top of the nav when the nav itself is what is spotlighted.
  const maxBottom =
    bounds.navTop !== null
      ? Math.min(bounds.navTop, viewport.height - bounds.safeBottom)
      : viewport.height - bounds.safeBottom;
  const position: CoachmarkPosition = placeCoachmark(
    targetRect,
    { width: cardWidth, height: cardSize.height },
    viewport,
    bounds.navTop !== null ? 'top' : step.placement,
    maxBottom,
  );
  const isLast = stepIndex === steps.length - 1;
  const slideFrom = position.placement === 'top' ? 12 : -12;

  return (
    /*
      Portalled to `document.body`. The overlay is `position: fixed`, which only
      means "fixed to the viewport, on the root stacking context" while no
      ancestor has a transform — and the page-transition wrapper in `AppShell`
      animates one. Rendered in place, the dimming layer could not reach over
      the bottom nav (`fixed z-40`) no matter what z-index it carried, so the
      nav stayed lit during the tour. See `ui/Portal.tsx`.
    */
    <Portal>
      <LazyMotion features={domAnimation}>
        <AnimatePresence>
          {open ? (
          <m.div
            key="spotlight-overlay"
            className="fixed inset-0 z-50"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
          >
            {/* Click-blocker: covers the full screen, including the cutout.
                See the pointer-events decision documented above. */}
            <div className="absolute inset-0" onClick={skip} />

            {/* Purely decorative dimmed mask with a cutout around the target. */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse">
                  <rect x={0} y={0} width={viewport.width} height={viewport.height} fill="white" />
                  <rect
                    x={padded.left}
                    y={padded.top}
                    width={padded.width}
                    height={padded.height}
                    rx={RADIUS}
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                x={0}
                y={0}
                width={viewport.width}
                height={viewport.height}
                fill="rgba(0,0,0,.55)"
                mask={`url(#${maskId})`}
              />
            </svg>

            <m.div
              ref={cardRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${maskId}-title`}
              aria-describedby={`${maskId}-body`}
              className="absolute max-h-[calc(100dvh-24px)] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
              style={{ top: position.top, left: position.left, width: cardWidth }}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: slideFrom }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: slideFrom }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
            >
              <div className="flex items-center gap-1.5">
                {steps.map((s, i) => (
                  <span
                    key={s.id}
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                      i === stepIndex ? 'bg-accent-600 dark:bg-accent-400' : 'bg-neutral-300 dark:bg-neutral-700'
                    }`}
                  />
                ))}
                <span className="sr-only">
                  Step {stepIndex + 1} of {steps.length}
                </span>
              </div>

              <h2 id={`${maskId}-title`} className="mt-2 text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">
                {step.title}
              </h2>
              <p id={`${maskId}-body`} className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {step.body}
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={skip}
                  className="min-h-[44px] flex-1 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                  Skip
                </button>
                <button
                  ref={nextButtonRef}
                  type="button"
                  onClick={() => advance(stepIndex)}
                  className="min-h-[44px] flex-1 rounded-xl bg-accent-600 text-sm font-medium text-white hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:bg-accent-500 dark:hover:bg-accent-600"
                >
                  {isLast ? 'Done' : 'Next'}
                </button>
              </div>
            </m.div>
            </m.div>
          ) : null}
        </AnimatePresence>
      </LazyMotion>
    </Portal>
  );
}
