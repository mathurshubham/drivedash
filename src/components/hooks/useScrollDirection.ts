'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  NAV_IDLE_MS,
  decideNavVisibility,
  initialNavVisibility,
  type NavVisibilityState,
  type ScrollSample,
} from '@/components/hooks/scrollDirection';

export {
  decideNavVisibility,
  initialNavVisibility,
  NAV_EDGE_ZONE,
  NAV_HIDE_AFTER,
  NAV_IDLE_MS,
  NAV_MIN_SCROLLABLE,
  NAV_SCROLL_THRESHOLD,
} from '@/components/hooks/scrollDirection';
export type { NavVisibilityState, ScrollSample } from '@/components/hooks/scrollDirection';

/**
 * Anything that wants the bottom nav back on screen dispatches this. The nav
 * listens; `Spotlight` and `TourOffer` fire it before they measure, so a step
 * that spotlights a nav item has something to spotlight.
 */
export const NAV_SHOW_EVENT = 'dd:nav:show';

/** Ask for the nav, wherever you are. No-op on the server. */
export function showNav(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NAV_SHOW_EVENT));
}

/* --------------------------------------------------------------------------
 * Nav lock: "any sheet or tour is open" pins the nav visible.
 * Ref-counted, because two overlays can overlap (the action sheet opened from
 * inside the tour, say), and releasing one must not un-pin the other.
 * ------------------------------------------------------------------------ */

let lockCount = 0;
const lockListeners = new Set<(locked: boolean) => void>();

export function isNavLocked(): boolean {
  return lockCount > 0;
}

/** Pin the nav visible until the returned release function is called. */
export function lockNav(): () => void {
  lockCount += 1;
  if (lockCount === 1) for (const fn of lockListeners) fn(true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) for (const fn of lockListeners) fn(false);
  };
}

function subscribeLock(onChange: () => void): () => void {
  lockListeners.add(onChange);
  return () => {
    lockListeners.delete(onChange);
  };
}

/** True while any sheet/tour holds a `lockNav()` handle. */
export function useNavLocked(): boolean {
  // An external store, not an effect + setState: the lock count lives outside
  // React and can flip before this component has ever rendered.
  return useSyncExternalStore(subscribeLock, isNavLocked, () => false);
}

/** Hold the lock for as long as `active` is true. */
export function useNavLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return lockNav();
  }, [active]);
}

/* --------------------------------------------------------------------------
 * One rAF-throttled scroll sampler, shared by every subscriber.
 * The nav and the greeting bar both react to scrolling; two listeners reading
 * layout on the same frame is two forced reflows, and they could disagree
 * about where the page is. One sampler, one reading, fanned out.
 * ------------------------------------------------------------------------ */

type SampleListener = (sample: ScrollSample) => void;

const sampleListeners = new Set<SampleListener>();
let frame = 0;
let idleTimer = 0;
let lastEmit = 0;
let attached = false;

function readSample(dt: number): ScrollSample {
  return {
    scrollY: window.scrollY,
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    dt,
  };
}

function emit(dt: number) {
  lastEmit = performance.now();
  const sample = readSample(dt);
  for (const fn of sampleListeners) fn(sample);
}

function armIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  // One sample after the finger stops, carrying enough `dt` to trip the idle
  // rule in `decideNavVisibility`.
  idleTimer = window.setTimeout(() => {
    idleTimer = 0;
    emit(performance.now() - lastEmit);
  }, NAV_IDLE_MS + 50);
}

function onScroll() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    emit(performance.now() - lastEmit);
    armIdle();
  });
}

/** Subscribe to the shared sampler; returns an unsubscribe. */
export function subscribeScroll(fn: SampleListener): () => void {
  sampleListeners.add(fn);
  if (!attached) {
    attached = true;
    lastEmit = performance.now();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }
  fn(readSample(0));
  return () => {
    sampleListeners.delete(fn);
    if (sampleListeners.size === 0) {
      attached = false;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
      if (idleTimer) clearTimeout(idleTimer);
      frame = 0;
      idleTimer = 0;
    }
  };
}

export interface NavVisibilityOptions {
  /** True while a sheet or the tour is open: the nav stays put. */
  locked?: boolean;
  /** Changing this (the pathname) forces the nav back into view. */
  resetKey?: string;
}

/**
 * `true` when the bottom nav should be translated out of view. See
 * `decideNavVisibility` for the rules; this hook adds the three non-scroll
 * reveals: route change, open overlay, and the `dd:nav:show` event.
 */
export function useNavVisibility({ locked = false, resetKey }: NavVisibilityOptions = {}): boolean {
  const [hidden, setHidden] = useState(false);
  const state = useRef<NavVisibilityState>(initialNavVisibility);

  useEffect(() => {
    const apply = (next: NavVisibilityState) => {
      if (next === state.current) return;
      state.current = next;
      setHidden(next.hidden);
    };

    const reveal = () => {
      state.current = { ...state.current, hidden: false, idleMs: NAV_IDLE_MS };
      setHidden(false);
    };

    const unsubscribe = subscribeScroll((sample) => {
      apply(decideNavVisibility(state.current, sample));
    });
    window.addEventListener(NAV_SHOW_EVENT, reveal);
    return () => {
      unsubscribe();
      window.removeEventListener(NAV_SHOW_EVENT, reveal);
    };
  }, []);

  // Route change: a fresh page always starts with its nav. The visible flip is
  // adjusted during render (React's documented "derive from a prop change"
  // pattern) so the new route never paints a frame without a nav; the
  // accumulated scroll state is reset alongside it.
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    if (hidden) setHidden(false);
  }
  useEffect(() => {
    state.current = { lastY: 0, hidden: false, idleMs: 0 };
  }, [resetKey]);

  return hidden && !locked;
}

/**
 * `true` once the window is scrolled further than `px`, with a small
 * hysteresis band so a page resting exactly on the threshold cannot flicker.
 * Drives the greeting bar's compact state off the same sampler as the nav.
 */
export function useScrolledPast(px: number): boolean {
  const [past, setPast] = useState(false);
  const value = useRef(false);

  useEffect(() => {
    return subscribeScroll(({ scrollY }) => {
      const next = value.current ? scrollY > px - 8 : scrollY > px;
      if (next === value.current) return;
      value.current = next;
      setPast(next);
    });
  }, [px]);

  return past;
}
