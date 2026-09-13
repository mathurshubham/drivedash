/**
 * Pure, injectable-storage logic for the "Install DriveDash" hint. Mirrors
 * `onboarding/tourState.ts`: kept DOM-free so eligibility and the visit
 * counter are unit-testable without a real `localStorage`. `InstallHint.tsx`
 * is the only place that touches `window`/`localStorage`/`matchMedia`
 * directly and feeds their results in here.
 */

import { TOUR_STORAGE_KEY } from '@/components/onboarding/tourState';

export { TOUR_STORAGE_KEY };

export const INSTALL_STORAGE_KEY = 'dd.install.v1';
export const VISITS_STORAGE_KEY = 'dd.visits';

export type InstallFlag = 'dismissed' | 'installed';

/**
 * `android-chrome`/`desktop` come from a captured `beforeinstallprompt`
 * (Chromium only, split by pointer coarseness); `ios-safari` is inferred from
 * the UA, since iOS never fires that event; `none` means never show.
 */
export type InstallPlatform = 'android-chrome' | 'ios-safari' | 'desktop' | 'none';

/** Minimal localStorage-shaped interface so tests can inject a fake. */
export interface InstallStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readInstallFlag(storage: InstallStorage): InstallFlag | null {
  const value = storage.getItem(INSTALL_STORAGE_KEY);
  return value === 'dismissed' || value === 'installed' ? value : null;
}

export function writeInstallFlag(storage: InstallStorage, value: InstallFlag): void {
  storage.setItem(INSTALL_STORAGE_KEY, value);
}

/** `0` for unset or a garbage (non-numeric, negative) value. */
export function readVisitCount(storage: InstallStorage): number {
  const raw = storage.getItem(VISITS_STORAGE_KEY);
  if (raw === null) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Increments and persists the visit counter, returning the new count. */
export function recordVisit(storage: InstallStorage): number {
  const next = readVisitCount(storage) + 1;
  storage.setItem(VISITS_STORAGE_KEY, String(next));
  return next;
}

export interface DecideInstallHintInput {
  /** `matchMedia('(display-mode: standalone)').matches || navigator.standalone`. */
  isStandalone: boolean;
  /** `dd.install.v1`, already parsed via `readInstallFlag`. */
  installFlag: InstallFlag | null;
  /** `dd.visits`, already parsed via `readVisitCount`. */
  visitCount: number;
  /**
   * Whether `dd.tour.v1` has any value at all. While it is unset the tour
   * offer may still appear this session in the same bottom-nav-adjacent
   * slot, so the install hint stays off entirely until the tour flag has
   * settled to `'done'` or `'skipped'`.
   */
  tourFlagSet: boolean;
  /** Milliseconds since this hint mounted. */
  elapsedMs: number;
  /** A `beforeinstallprompt` event was captured this session. */
  hasInstallEvent: boolean;
  /** iOS Safari (or iPadOS masquerading as desktop Safari) user agent. */
  isIOSUA: boolean;
  /** `matchMedia('(pointer: coarse)').matches` — a touch-primary pointer. */
  isCoarsePointer: boolean;
}

const MIN_VISITS = 2;
const MIN_ELAPSED_MS = 3000;

/**
 * Whether — and for which platform — to render the install hint this
 * session. Returns `'none'` when any eligibility condition fails.
 */
export function decideInstallHint(input: DecideInstallHintInput): InstallPlatform {
  if (input.isStandalone) return 'none';
  if (input.installFlag !== null) return 'none';
  if (input.visitCount < MIN_VISITS) return 'none';
  if (!input.tourFlagSet) return 'none';
  if (input.elapsedMs < MIN_ELAPSED_MS) return 'none';

  if (input.hasInstallEvent) return input.isCoarsePointer ? 'android-chrome' : 'desktop';
  if (input.isIOSUA) return 'ios-safari';
  return 'none';
}

/**
 * Whether the Menu sheet's "Install app" entry should render at all — a
 * looser check than `decideInstallHint`: an explicit menu tap doesn't need
 * the visit count, dismissal, tour or delay gates, only a way to act on it.
 */
export function isInstallMenuEligible(input: {
  hasInstallEvent: boolean;
  isIOSUA: boolean;
  isStandalone: boolean;
}): boolean {
  if (input.isStandalone) return false;
  return input.hasInstallEvent || input.isIOSUA;
}
