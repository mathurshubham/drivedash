'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Share } from 'lucide-react';
import Portal from '@/components/ui/Portal';
import Pressable from '@/components/ui/Pressable';
import { lockNav, showNav } from '@/components/hooks/useScrollDirection';
import {
  TOUR_STORAGE_KEY,
  decideInstallHint,
  readInstallFlag,
  readVisitCount,
  recordVisit,
  writeInstallFlag,
  type InstallPlatform,
} from './installState';

/**
 * The event Chromium fires once, early, offering a native install prompt.
 * Not in `lib.dom.d.ts` yet.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/*
 * Module-level capture (README "initial trap": a hook or effect only runs
 * once something has mounted, but `beforeinstallprompt` can fire before
 * anything below `<AppShell>` has — Chromium dispatches it once, early, and
 * never again). The listener is registered as soon as this module is
 * evaluated, not inside an effect, so the event is stashed no matter which UI
 * (this card, or the Menu sheet's "Install app" row) asks for it later.
 */
let stashedPrompt: BeforeInstallPromptEvent | null = null;
let eventCaptured = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getEventCaptured(): boolean {
  return eventCaptured;
}

function getServerEventCaptured(): boolean {
  return false;
}

function persistFlagSafely(flag: 'dismissed' | 'installed'): void {
  try {
    writeInstallFlag(window.localStorage, flag);
  } catch {
    // No storage available — nothing to persist to.
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    stashedPrompt = e as BeforeInstallPromptEvent;
    eventCaptured = true;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    stashedPrompt = null;
    persistFlagSafely('installed');
    notify();
  });
}

/** The stashed `beforeinstallprompt` event, if one has fired this session. */
export function getStashedPrompt(): BeforeInstallPromptEvent | null {
  return stashedPrompt;
}

/** True once a `beforeinstallprompt` event has been captured this session. */
export function useInstallEventCaptured(): boolean {
  return useSyncExternalStore(subscribe, getEventCaptured, getServerEventCaptured);
}

/** Consumes the stashed prompt (Chrome only offers it once) and persists the outcome. */
export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const prompt = stashedPrompt;
  if (!prompt) return 'unavailable';
  stashedPrompt = null;
  notify();
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    persistFlagSafely(choice.outcome === 'accepted' ? 'installed' : 'dismissed');
    return choice.outcome;
  } catch {
    persistFlagSafely('dismissed');
    return 'dismissed';
  }
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

export function isIOSUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports "Macintosh" but is touch-only, unlike a real Mac —
  // `beforeinstallprompt` never fires there either, so it needs its own check.
  const iPadOS13Plus = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOS13Plus;
}

export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

function readLocalStorage(): globalThis.Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const APPEAR_DELAY_MS = 3000;

const COPY: Record<Exclude<InstallPlatform, 'none'>, string> = {
  'android-chrome': 'Add it to your home screen for a full-screen, one-tap launch.',
  desktop: 'Add it to your home screen for a full-screen, one-tap launch.',
  'ios-safari': '', // rendered inline below, with the Share glyph.
};

/**
 * One-time "Install DriveDash" nudge. Portalled to `document.body` above the
 * bottom nav — same slot and z-layer as `onboarding/TourOffer`, and mutually
 * exclusive with it: while `dd.tour.v1` is unset the tour offer may still
 * appear there this session, so this component renders nothing until that
 * flag has settled. See `ui/README.md`'s z-layer table and "initial trap".
 */
export default function InstallHint() {
  const pathname = usePathname() ?? '/';
  const initialPathname = useRef(pathname);
  const eventCaptured = useInstallEventCaptured();
  const [elapsed, setElapsed] = useState(false);
  const [dismissedLocally, setDismissedLocally] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('none');

  // Count this load as a visit to `/`, exactly once, at mount.
  useEffect(() => {
    if (initialPathname.current !== '/') return;
    const storage = readLocalStorage();
    if (storage) recordVisit(storage);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setElapsed(true), APPEAR_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const storage = readLocalStorage();
    if (!storage) return;
    // Reads localStorage + platform signals (unavailable during SSR/first
    // paint, hence the effect rather than a lazy useState initializer that
    // must match between server and client render) — see `useTour`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(
      decideInstallHint({
        isStandalone: isStandaloneDisplay(),
        installFlag: readInstallFlag(storage),
        visitCount: readVisitCount(storage),
        tourFlagSet: storage.getItem(TOUR_STORAGE_KEY) !== null,
        elapsedMs: elapsed ? APPEAR_DELAY_MS : 0,
        hasInstallEvent: eventCaptured,
        isIOSUA: isIOSUserAgent(),
        isCoarsePointer: isCoarsePointer(),
      }),
    );
  }, [eventCaptured, elapsed]);

  const visible = platform !== 'none' && !dismissedLocally;

  // The card sits directly above the nav, so hold the nav visible for as
  // long as the card is (same reasoning as `TourOffer`).
  useEffect(() => {
    if (!visible) return;
    showNav();
    return lockNav();
  }, [visible]);

  if (!visible) return null;

  const isIOS = platform === 'ios-safari';

  function dismiss() {
    persistFlagSafely('dismissed');
    setDismissedLocally(true);
  }

  async function install() {
    const outcome = await triggerInstallPrompt();
    if (outcome === 'unavailable') {
      // The event vanished (or was never captured for this platform) between
      // eligibility and the tap — nothing to prompt with, so just retire it.
      persistFlagSafely('dismissed');
    }
    setDismissedLocally(true);
  }

  return (
    <Portal>
      <div
        role="dialog"
        aria-live="polite"
        aria-label="Install DriveDash"
        className="fixed inset-x-4 z-[45] mx-auto max-w-[400px] animate-install-hint-in motion-reduce:animate-none rounded-lg border border-subtle surface p-4 shadow-pop"
        style={{ bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 12px)' }}
      >
        <div className="flex items-start gap-3">
          <span className="h-10 w-10 flex-none overflow-hidden rounded-md surface-2">
            <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">Install DriveDash</p>
            <p className="mt-1 text-xs text-muted">
              {isIOS ? (
                <>
                  Tap the Share button{' '}
                  <Share aria-hidden="true" className="inline h-3.5 w-3.5 -translate-y-px" />, then{' '}
                  <strong className="font-medium text-fg">Add to Home Screen</strong>.
                </>
              ) : (
                COPY[platform as Exclude<InstallPlatform, 'none'>]
              )}
            </p>
            <div className="mt-3 flex gap-2">
              {isIOS ? (
                <Pressable variant="primary" size="md" block onClick={dismiss}>
                  Got it
                </Pressable>
              ) : (
                <>
                  <Pressable variant="ghost" size="md" block onClick={dismiss}>
                    Not now
                  </Pressable>
                  <Pressable variant="primary" size="md" block onClick={install}>
                    Install
                  </Pressable>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
