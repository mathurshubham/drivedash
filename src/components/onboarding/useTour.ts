'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  clearTourState,
  readTourState,
  writeTourState,
  TOUR_STORAGE_KEY,
  type TourStorage,
} from './tourState';

/** In-memory fallback so the hook is safe to call during SSR / when
 * localStorage is unavailable (privacy mode etc). */
function memoryStorage(): TourStorage {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key, v) => {
      value = v;
    },
    removeItem: () => {
      value = null;
    },
  };
}

let fallback: TourStorage | null = null;

function getStorage(): TourStorage {
  if (typeof window === 'undefined') {
    return (fallback ??= memoryStorage());
  }
  try {
    const storage = window.localStorage;
    // Probe access: some locked-down contexts (private browsing, disabled
    // site data) throw only once a read/write is attempted.
    storage.getItem(TOUR_STORAGE_KEY);
    return storage;
  } catch {
    return (fallback ??= memoryStorage());
  }
}

export interface UseTourResult {
  /** True only while the tour flag is unset (never offered/completed/skipped). */
  shouldOffer: boolean;
  /** Whether the "New here?" offer card should currently be rendered. */
  offered: boolean;
  /** Whether the Spotlight tour itself is currently open. */
  open: boolean;
  /** Show the offer card. */
  offer: () => void;
  /** Start the Spotlight tour (hides the offer card if shown). */
  start: () => void;
  /** User skipped/declined: persist 'skipped', close everything. */
  dismiss: () => void;
  /** Tour finished (Done on the last step): persist 'done', close everything. */
  complete: () => void;
}

export function useTour(): UseTourResult {
  // SSR-safe: starts false, corrected in an effect once localStorage is
  // readable on the client.
  const [shouldOffer, setShouldOffer] = useState(false);
  const [offered, setOffered] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Reads localStorage (unavailable during SSR/first paint, hence the
    // effect rather than a lazy useState initializer that must match
    // between server and client render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShouldOffer(readTourState(getStorage()) === null);
  }, []);

  const offer = useCallback(() => setOffered(true), []);

  const start = useCallback(() => {
    setOffered(false);
    setOpen(true);
  }, []);

  const dismiss = useCallback(() => {
    writeTourState(getStorage(), 'skipped');
    setShouldOffer(false);
    setOffered(false);
    setOpen(false);
  }, []);

  const complete = useCallback(() => {
    writeTourState(getStorage(), 'done');
    setShouldOffer(false);
    setOffered(false);
    setOpen(false);
  }, []);

  return { shouldOffer, offered, open, offer, start, dismiss, complete };
}

/** Test-only helper: clears the persisted tour flag. */
export function resetTourForTests(): void {
  clearTourState(getStorage());
}
