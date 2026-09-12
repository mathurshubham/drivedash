'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import Portal from '@/components/ui/Portal';
import { lockNav, showNav } from '@/components/hooks/useScrollDirection';
import {
  coachmarkMaxBottom,
  coachmarkWidth,
  cutoutTop,
  placeCoachmark,
  placeCoachmarkAboveNav,
  type CoachmarkPosition,
  type Rect,
} from './coachmark';
import { nextVisibleStep } from './stepVisibility';
import type { TourStep } from './tourSteps';
import { waitForStable } from './waitForStable';

export interface SpotlightProps {
  steps: TourStep[];
  open: boolean;
  onClose: (completed: boolean) => void;
}

const PADDING = 8;
const RADIUS = 14;
const DEFAULT_CARD_SIZE = { width: 320, height: 180 };
/** How long to wait for the nav's slide-in before measuring anyway. */
const SETTLE_MAX_MS = 350;
/** Ring inset around the target rect, and its corner radius. */
const RING_PADDING = 4;
const RING_RADIUS = 8;
/**
 * z-layers, see `ui/README.md`. The card is a *sibling* of the dim overlay at
 * its own layer: the overlay is a stacking context, and the nav is raised to 55
 * on nav steps, so a card nested inside the z-50 overlay was painted under the
 * nav — the Skip/Next row disappeared behind it on a 555x701 window.
 */
const CARD_Z = 57;
const RING_Z = 56;

function bottomNavEl(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>('[data-bottom-nav]');
}

function greetingBarEl(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>('[data-greeting-bar]');
}

/** One animation frame, awaitable. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') {
      setTimeout(resolve, 16);
      return;
    }
    requestAnimationFrame(() => resolve());
  });
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
  // Sanitised: raw useId() ids contain ':' which some browsers mis-handle
  // inside an SVG mask="url(#...)" reference.
  const rawId = useId();
  const maskId = `spotlight-mask-${rawId.replace(/:/g, '')}`;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cardObserverRef = useRef<ResizeObserver | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  const [stepIndex, setStepIndex] = useState(-1);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [cardSize, setCardSize] = useState(DEFAULT_CARD_SIZE);
  /**
   * Geometry of everything the card and the cutout have to dodge, read in one
   * pass with the target rect so the two can never disagree.
   *
   * - `navTop`: top edge of the bottom nav whenever it is on screen — not only
   *   when the nav is the thing being spotlighted. It is the card's floor.
   * - `inNav`: the target lives inside the nav, so the step uses "raise and
   *   ring" instead of a mask cutout.
   * - `headerBottom`: bottom edge of the sticky greeting bar, if any.
   */
  const [bounds, setBounds] = useState<{
    navTop: number | null;
    inNav: boolean;
    safeBottom: number;
    headerBottom: number | null;
  }>({ navTop: null, inNav: false, safeBottom: 0, headerBottom: null });
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
  //
  // Measuring is asynchronous on purpose. `showNav()`/`lockNav()` animate the
  // nav back on screen, and that slide is a motion transform: it fires no
  // ResizeObserver and — being JS-driven rather than a CSS transition — no
  // `transitionend` either. A rect read on the next frame is therefore the
  // nav's *hidden* position, which is exactly what put the cutout and the card
  // in the wrong place on a 412x915 phone. Two frames, then `waitForStable`,
  // then measure.
  useLayoutEffect(() => {
    if (!step) return;

    showNav();

    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let remeasure: (() => void) | null = null;
    let litNav: HTMLElement | null = null;
    let litItem: HTMLElement | null = null;

    const read = (el: HTMLElement, inNav: boolean) => {
      const nav = bottomNavEl();
      const navRect = nav ? nav.getBoundingClientRect() : null;
      // "Visible" means occupying screen, not merely mounted: a translated-out
      // nav still has a rect, just one below the fold.
      const navVisible =
        navRect !== null && navRect.height > 0 && navRect.top < window.innerHeight - 1;
      const header = greetingBarEl();
      const headerRect = header ? header.getBoundingClientRect() : null;

      setTargetRect(rectOf(el));
      setBounds({
        navTop: navVisible && navRect ? navRect.top : null,
        inNav,
        safeBottom: safeAreaBottom(),
        headerBottom: headerRect && headerRect.height > 0 ? headerRect.bottom : null,
      });
    };

    void (async () => {
      // Two frames (style + layout flush), then wait out the nav's slide.
      await nextFrame();
      await nextFrame();
      if (cancelled) return;
      await waitForStable(bottomNavEl(), { maxMs: SETTLE_MAX_MS });
      if (cancelled) return;

      const el = targetElOf(step);
      if (!el) {
        // Target vanished (or never existed) even after the nav-show attempt;
        // skip forward automatically. Depends on live DOM state, so it can't
        // be derived during render.
        advance(stepIndex);
        return;
      }

      const nav = bottomNavEl();
      const inNav = el.closest('[data-bottom-nav]') !== null;

      if (inNav && nav) {
        // Raise and ring: the nav goes *above* the overlay and every item but
        // the spotlighted one dims in place. A mask cutout cannot work here —
        // the nav is a translucent, blurred surface sitting under the overlay,
        // so the hole revealed the page behind it as a blank white rectangle.
        nav.setAttribute('data-tour-active', 'true');
        el.setAttribute('data-tour-spotlight', 'true');
        litNav = nav;
        litItem = el;
      } else {
        // A `fixed` nav item cannot be scrolled to; only page content is.
        el.scrollIntoView({ block: 'center', behavior: 'auto' });
        await waitForStable(el, { maxMs: SETTLE_MAX_MS });
        if (cancelled) return;
      }

      const onChange = () => read(el, inNav);
      remeasure = onChange;
      onChange();

      ro = new ResizeObserver(onChange);
      ro.observe(el);
      window.addEventListener('resize', onChange);
      window.addEventListener('scroll', onChange, true);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      if (remeasure) {
        window.removeEventListener('resize', remeasure);
        window.removeEventListener('scroll', remeasure, true);
      }
      // Step change or close: drop the nav back under the overlay and undim it.
      litNav?.removeAttribute('data-tour-active');
      litItem?.removeAttribute('data-tour-spotlight');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stepIndex]);

  /**
   * Measures the card's real height, and keeps measuring it.
   *
   * A ref *callback* rather than a `useLayoutEffect([step])`, because the card
   * only enters the DOM on the second render of a step: the first render bails
   * at `!targetRect` and returns `null`, so a layout effect keyed on `step` ran
   * with `cardRef.current === null` and never ran again for that step. The
   * height therefore stayed at the 180px estimate for the card's whole life,
   * and every clamp — `maxBottom`, the nav floor — was computed against a card
   * ~40px shorter than the one on screen, which is how the Skip/Next row ended
   * up past the top of the bottom nav. Attaching on mount cannot miss it.
   */
  const attachCard = useCallback((node: HTMLDivElement | null) => {
    cardRef.current = node;
    cardObserverRef.current?.disconnect();
    cardObserverRef.current = null;
    if (!node) return;
    const measure = () => setCardSize({ width: node.offsetWidth, height: node.offsetHeight });
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(node);
      cardObserverRef.current = ro;
    }
  }, []);

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

  const paddedTop = targetRect.top - PADDING;
  const paddedBottom = targetRect.bottom + PADDING;
  // The sticky greeting bar sits *inside* the shelves cutout, so the "hole"
  // framed a translucent header rather than the shelves. Start the hole below
  // the bar whenever the two overlap.
  const holeTop = cutoutTop(paddedTop, paddedBottom, bounds.headerBottom);
  const padded: Rect = {
    top: holeTop,
    left: targetRect.left - PADDING,
    right: targetRect.right + PADDING,
    bottom: paddedBottom,
    width: targetRect.width + PADDING * 2,
    height: Math.max(0, paddedBottom - holeTop),
  };

  const cardWidth = coachmarkWidth(viewport.width);
  // Never let the card run off the bottom, and never let it cover the nav —
  // on any step, not only the two that spotlight a nav item.
  const maxBottom = coachmarkMaxBottom(viewport.height, bounds.safeBottom, bounds.navTop);
  const placed: CoachmarkPosition = placeCoachmark(
    targetRect,
    { width: cardWidth, height: cardSize.height },
    viewport,
    bounds.inNav ? 'top' : step.placement,
    maxBottom,
  );
  // A nav target has no usable "above the target" — the target *is* the nav.
  // Anchor the card's bottom edge one gap above the nav instead.
  const position: CoachmarkPosition =
    bounds.inNav && bounds.navTop !== null
      ? placeCoachmarkAboveNav(targetRect, { width: cardWidth, height: cardSize.height }, viewport, bounds.navTop)
      : placed;
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

      Three *siblings*, never nested: dim overlay (z 50), nav ring (56), card
      (57). Each is its own stacking context, so a child can never out-rank a
      sibling layer above it however high its own z-index — which is exactly how
      the card's Skip/Next row ended up painted under the tour-raised nav (55).
      See the z-layer table in `ui/README.md`.
    */
    <Portal>
      {/*
        CSS keyframe, not a motion animation: `domAnimation` is lazy-loaded, so
        a motion `initial={{ opacity: 0 }}` left the dim layer sitting at its
        initial value until the feature bundle landed — measured at 0.21 three
        seconds in. `.animate-fade-in` is 150ms and runs on the first painted
        frame. See `globals.css`.
      */}
      <div className="fixed inset-0 z-50 animate-fade-in motion-reduce:animate-none" role="presentation">
        {/* Click-blocker: covers the full screen, including the cutout.
            See the pointer-events decision documented above. */}
        <div className="absolute inset-0" onClick={skip} />

        {/* Purely decorative dimmed mask with a cutout around the target. */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse">
              <rect x={0} y={0} width={viewport.width} height={viewport.height} fill="white" />
              {/* Nav targets get no hole at all — the nav itself is raised
                  above this overlay and ringed instead. */}
              {bounds.inNav ? null : (
                <rect
                  x={padded.left}
                  y={padded.top}
                  width={padded.width}
                  height={padded.height}
                  rx={RADIUS}
                  fill="black"
                />
              )}
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
      </div>

      {/*
        Highlight ring for a nav target. z 56 — above the tour-raised nav (55),
        below the card (57).
      */}
      {bounds.inNav ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed border-2"
          style={{
            zIndex: RING_Z,
            top: targetRect.top - RING_PADDING,
            left: targetRect.left - RING_PADDING,
            width: targetRect.width + RING_PADDING * 2,
            height: targetRect.height + RING_PADDING * 2,
            borderRadius: RING_RADIUS,
            // `--color-accent` resolves light/dark on its own (see globals.css).
            borderColor: 'var(--color-accent)',
            boxShadow: '0 0 0 4px color-mix(in oklab, var(--color-accent) 24%, transparent)',
          }}
        />
      ) : null}

      <div
        ref={attachCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${maskId}-title`}
        aria-describedby={`${maskId}-body`}
        className="fixed max-h-[calc(100dvh-24px)] animate-coachmark-in overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900"
        style={
          {
            top: position.top,
            left: position.left,
            width: cardWidth,
            zIndex: CARD_Z,
            '--coachmark-from': `${slideFrom}px`,
          } as CSSProperties
        }
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
      </div>
    </Portal>
  );
}
