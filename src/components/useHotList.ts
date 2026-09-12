'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getHotList, putHotList } from '@/lib/client';
import type { ShelfStyle } from '@/components/shelves/style';
import type { HotGroup, HotItem, HotList } from '@/lib/types';
import { useToast } from '@/components/Toast';

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface UseHotList {
  hotList: HotList | null;
  loading: boolean;
  error: string | null;
  /** False while the list is loading or failed to load; edits are refused until it is true. */
  ready: boolean;
  /** Group containing the file, if it is pinned. */
  groupOf: (fileId: string) => HotGroup | undefined;
  isPinned: (fileId: string) => boolean;
  refresh: () => Promise<void>;
  addPin: (item: HotItem, groupId: string) => void;
  removePin: (fileId: string) => void;
  setLabel: (fileId: string, label: string) => void;
  /** Move a pinned item into another group (appended at the end). */
  moveItem: (fileId: string, toGroupId: string) => void;
  addGroup: (name: string, style?: ShelfStyle) => void;
  renameGroup: (groupId: string, name: string) => void;
  deleteGroup: (groupId: string) => void;
  moveGroup: (groupId: string, direction: -1 | 1) => void;
  /** Shelf identity (DESIGN_PLAN §7); merges, so `{ icon }` leaves the colour alone. */
  setGroupStyle: (groupId: string, style: ShelfStyle) => void;
}

export type { ShelfStyle };

export function useHotList(): UseHotList {
  const toast = useToast();
  const [hotList, setHotList] = useState<HotList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HotList | null>(null);

  /** Last list the server confirmed; the target any failed write reverts to. */
  const confirmed = useRef<HotList | null>(null);
  /** Latest list still waiting to be PUT, if any. */
  const pending = useRef<HotList | null>(null);
  /** True between scheduling a write and that write picking up `pending`. */
  const scheduled = useRef(false);
  /** True while a PUT is actually in flight. */
  const inFlight = useRef(false);
  /** Bumped on every local edit so a slow GET can tell it has been overtaken. */
  const localSeq = useRef(0);
  /** Single promise chain: PUTs never overlap, so they never land out of order. */
  const queue = useRef<Promise<void>>(Promise.resolve());

  const apply = useCallback((next: HotList | null) => {
    ref.current = next;
    setHotList(next);
  }, []);

  /**
   * Queue one PUT carrying whatever `pending` holds when it runs. Calls made while
   * a write is in flight coalesce into a single follow-up PUT.
   */
  const schedule = useCallback(() => {
    if (scheduled.current) return;
    scheduled.current = true;
    queue.current = queue.current.then(async () => {
      scheduled.current = false;
      const next = pending.current;
      pending.current = null;
      if (!next) return;
      inFlight.current = true;
      try {
        const saved = await putHotList(next);
        confirmed.current = saved;
        // Only adopt the server copy if nothing newer is queued behind us.
        if (!scheduled.current) apply(saved);
      } catch (err: unknown) {
        // Revert to the last server-confirmed snapshot, not a per-call previous
        // value, which could itself be an unsaved optimistic state.
        if (!scheduled.current && confirmed.current) apply(confirmed.current);
        toast(
          err instanceof Error ? `Could not save: ${err.message}` : 'Could not save changes',
          'error',
        );
      } finally {
        inFlight.current = false;
      }
    });
  }, [apply, toast]);

  const refresh = useCallback(async () => {
    const seenSeq = localSeq.current;
    const writePendingAtStart = scheduled.current || inFlight.current;
    try {
      const list = await getHotList();
      setError(null);
      // Never clobber optimistic state: if a write is (or was) pending, drain the
      // queue and let that PUT's response stand — it is newer than this fetch.
      if (writePendingAtStart || scheduled.current || inFlight.current) {
        await queue.current;
        return;
      }
      if (localSeq.current !== seenSeq) return;
      confirmed.current = list;
      apply(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed_to_load');
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    // Initial load of an external resource; state is only set once the fetch settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  /** Optimistic update + queued PUT; reverts to the confirmed snapshot on failure. */
  const mutate = useCallback(
    (fn: (list: HotList) => HotList) => {
      const current = ref.current;
      if (!current) {
        toast('Pinned list not loaded yet', 'error');
        return;
      }
      const next = fn(current);
      if (next === current) return;
      localSeq.current++;
      apply(next);
      pending.current = next;
      schedule();
    },
    [apply, schedule, toast],
  );

  const groupOf = useCallback(
    (fileId: string) => hotList?.groups.find((g) => g.items.some((i) => i.fileId === fileId)),
    [hotList],
  );

  const isPinned = useCallback((fileId: string) => groupOf(fileId) !== undefined, [groupOf]);

  const addPin = useCallback(
    (item: HotItem, groupId: string) => {
      mutate((list) => ({
        ...list,
        groups: list.groups.map((g) => {
          const without = g.items.filter((i) => i.fileId !== item.fileId);
          if (g.id !== groupId) {
            return without.length === g.items.length ? g : { ...g, items: without };
          }
          // Stamped here, not by the caller: every pin flows through this
          // one place, and the tile's meta line needs a time. Optional and
          // additive, like the shelf's `color`/`icon` (DESIGN_PLAN §7).
          return { ...g, items: [...without, { ...item, pinnedAt: item.pinnedAt ?? new Date().toISOString() }] };
        }),
      }));
    },
    [mutate],
  );

  const removePin = useCallback(
    (fileId: string) => {
      mutate((list) => ({
        ...list,
        groups: list.groups.map((g) =>
          g.items.some((i) => i.fileId === fileId)
            ? { ...g, items: g.items.filter((i) => i.fileId !== fileId) }
            : g,
        ),
      }));
    },
    [mutate],
  );

  const setLabel = useCallback(
    (fileId: string, label: string) => {
      const trimmed = label.trim();
      mutate((list) => ({
        ...list,
        groups: list.groups.map((g) => ({
          ...g,
          items: g.items.map((i) =>
            i.fileId === fileId
              ? trimmed
                ? { ...i, label: trimmed }
                : { ...i, label: undefined }
              : i,
          ),
        })),
      }));
    },
    [mutate],
  );

  const moveItem = useCallback(
    (fileId: string, toGroupId: string) => {
      mutate((list) => {
        const item = list.groups.flatMap((g) => g.items).find((i) => i.fileId === fileId);
        if (!item) return list;
        return {
          ...list,
          groups: list.groups.map((g) => {
            const without = g.items.filter((i) => i.fileId !== fileId);
            if (g.id === toGroupId) return { ...g, items: [...without, item] };
            return without.length === g.items.length ? g : { ...g, items: without };
          }),
        };
      });
    },
    [mutate],
  );

  const addGroup = useCallback(
    (name: string, style?: ShelfStyle) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      mutate((list) => ({
        ...list,
        groups: [
          ...list.groups,
          {
            id: newId(),
            name: trimmed,
            items: [],
            // Omitted rather than set to undefined: the group is JSON-stringified
            // into appDataFolder and an explicit `undefined` would vanish anyway.
            ...(style?.color ? { color: style.color } : {}),
            ...(style?.icon ? { icon: style.icon } : {}),
          },
        ],
      }));
    },
    [mutate],
  );

  const setGroupStyle = useCallback(
    (groupId: string, style: ShelfStyle) => {
      mutate((list) => ({
        ...list,
        groups: list.groups.map((g) => (g.id === groupId ? { ...g, ...style } : g)),
      }));
    },
    [mutate],
  );

  const renameGroup = useCallback(
    (groupId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      mutate((list) => ({
        ...list,
        groups: list.groups.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g)),
      }));
    },
    [mutate],
  );

  const deleteGroup = useCallback(
    (groupId: string) => {
      mutate((list) => ({ ...list, groups: list.groups.filter((g) => g.id !== groupId) }));
    },
    [mutate],
  );

  const moveGroup = useCallback(
    (groupId: string, direction: -1 | 1) => {
      mutate((list) => {
        const index = list.groups.findIndex((g) => g.id === groupId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= list.groups.length) return list;
        const groups = [...list.groups];
        const [moved] = groups.splice(index, 1);
        groups.splice(target, 0, moved);
        return { ...list, groups };
      });
    },
    [mutate],
  );

  return {
    hotList,
    loading,
    error,
    ready: hotList !== null,
    groupOf,
    isPinned,
    refresh,
    addPin,
    removePin,
    setLabel,
    moveItem,
    addGroup,
    renameGroup,
    deleteGroup,
    moveGroup,
    setGroupStyle,
  };
}

export default useHotList;
