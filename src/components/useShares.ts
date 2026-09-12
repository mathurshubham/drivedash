'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { extendShare, getShares, revokeShare, sweepShares } from '@/lib/client';
import type { ShareEntry, ShareLedger, SweepResponse } from '@/lib/types';
import { useToast } from '@/components/Toast';

function defaultLedger(): ShareLedger {
  return { version: 1, lastSweepAt: null, shares: [] };
}

function replaceEntry(ledger: ShareLedger, entry: ShareEntry): ShareLedger {
  return {
    ...ledger,
    shares: ledger.shares.map((s) => (s.id === entry.id ? entry : s)),
  };
}

export interface UseShares {
  ledger: ShareLedger | null;
  loading: boolean;
  error: string | null;
  ready: boolean;
  refresh: () => Promise<void>;
  add: (entry: ShareEntry) => void;
  revoke: (id: string) => void;
  extend: (id: string, days: 7) => void;
  sweep: (opts?: { silent?: boolean }) => Promise<SweepResponse | undefined>;
}

export function useShares(opts?: { autoload?: boolean }): UseShares {
  const toast = useToast();
  const [ledger, setLedger] = useState<ShareLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<ShareLedger | null>(null);
  const confirmed = useRef<ShareLedger | null>(null);
  const localSeq = useRef(0);
  const inFlight = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const apply = useCallback((next: ShareLedger | null) => {
    ref.current = next;
    setLedger(next);
  }, []);

  const refresh = useCallback(async () => {
    const seenSeq = localSeq.current;
    const writePendingAtStart = inFlight.current;
    try {
      const next = await getShares();
      setError(null);
      if (writePendingAtStart || inFlight.current) {
        await queue.current;
        return;
      }
      if (localSeq.current !== seenSeq) return;
      confirmed.current = next;
      apply(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed_to_load');
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    if (opts?.autoload === false) return;
    // Initial load of an external resource; state is only set once the fetch settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [opts?.autoload, refresh]);

  const enqueue = useCallback((work: () => Promise<void>) => {
    queue.current = queue.current.then(async () => {
      inFlight.current = true;
      try {
        await work();
      } finally {
        inFlight.current = false;
      }
    });
  }, []);

  const add = useCallback(
    (entry: ShareEntry) => {
      const current = ref.current ?? confirmed.current ?? defaultLedger();
      const shares = [entry, ...current.shares.filter((s) => s.id !== entry.id)];
      const next = { ...current, shares };
      localSeq.current++;
      apply(next);
      confirmed.current = {
        ...(confirmed.current ?? current),
        shares: [entry, ...(confirmed.current ?? current).shares.filter((s) => s.id !== entry.id)],
      };
    },
    [apply],
  );

  const revoke = useCallback(
    (id: string) => {
      const current = ref.current;
      if (!current) {
        toast('Share log not loaded yet', 'error');
        return;
      }
      const existing = current.shares.find((s) => s.id === id);
      if (!existing) return;
      const optimistic: ShareEntry = {
        ...existing,
        status: 'revoked',
        revokedAt: new Date().toISOString(),
        revokedBy: 'you',
      };
      localSeq.current++;
      apply(replaceEntry(current, optimistic));
      enqueue(async () => {
        try {
          const { entry } = await revokeShare(id);
          const base = ref.current ?? current;
          const next = replaceEntry(base, entry);
          confirmed.current = next;
          apply(next);
        } catch (err: unknown) {
          if (confirmed.current) apply(confirmed.current);
          toast(
            err instanceof Error ? `Could not revoke: ${err.message}` : 'Could not revoke',
            'error',
          );
        }
      });
    },
    [apply, enqueue, toast],
  );

  const extend = useCallback(
    (id: string, days: 7) => {
      const current = ref.current;
      if (!current) {
        toast('Share log not loaded yet', 'error');
        return;
      }
      const existing = current.shares.find((s) => s.id === id);
      if (!existing || existing.expiresAt === null) return;
      const base = Math.max(Date.now(), Date.parse(existing.expiresAt));
      const optimistic: ShareEntry = {
        ...existing,
        expiresAt: new Date(base + days * 24 * 60 * 60 * 1000).toISOString(),
      };
      localSeq.current++;
      apply(replaceEntry(current, optimistic));
      enqueue(async () => {
        try {
          const { entry } = await extendShare(id, days);
          const latest = ref.current ?? current;
          const next = replaceEntry(latest, entry);
          confirmed.current = next;
          apply(next);
        } catch (err: unknown) {
          if (confirmed.current) apply(confirmed.current);
          toast(
            err instanceof Error ? `Could not extend: ${err.message}` : 'Could not extend',
            'error',
          );
        }
      });
    },
    [apply, enqueue, toast],
  );

  const sweep = useCallback(
    (options?: { silent?: boolean }): Promise<SweepResponse | undefined> => {
      const hush = Boolean(options?.silent);
      return new Promise((resolve) => {
        enqueue(async () => {
          try {
            const res = await sweepShares();
            localSeq.current++;
            confirmed.current = res.ledger;
            apply(res.ledger);
            setError(null);
            resolve(res);
          } catch (err: unknown) {
            if (!hush) {
              toast(
                err instanceof Error ? `Could not sweep: ${err.message}` : 'Could not sweep shares',
                'error',
              );
            }
            resolve(undefined);
          } finally {
            setLoading(false);
          }
        });
      });
    },
    [apply, enqueue, toast],
  );

  return {
    ledger,
    loading,
    error,
    ready: ledger !== null,
    refresh,
    add,
    revoke,
    extend,
    sweep,
  };
}

export default useShares;
