'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getHotList, putHotList } from '@/lib/client';
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
  /** Group containing the file, if it is pinned. */
  groupOf: (fileId: string) => HotGroup | undefined;
  isPinned: (fileId: string) => boolean;
  refresh: () => Promise<void>;
  addPin: (item: HotItem, groupId: string) => void;
  removePin: (fileId: string) => void;
  setLabel: (fileId: string, label: string) => void;
  /** Move a pinned item into another group (appended at the end). */
  moveItem: (fileId: string, toGroupId: string) => void;
  addGroup: (name: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  deleteGroup: (groupId: string) => void;
  moveGroup: (groupId: string, direction: -1 | 1) => void;
}

export function useHotList(): UseHotList {
  const toast = useToast();
  const [hotList, setHotList] = useState<HotList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HotList | null>(null);

  const apply = useCallback((next: HotList | null) => {
    ref.current = next;
    setHotList(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await getHotList();
      apply(list);
      setError(null);
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

  /** Optimistic update + PUT; reverts and toasts on failure. */
  const mutate = useCallback(
    (fn: (list: HotList) => HotList) => {
      const previous = ref.current;
      if (!previous) return;
      const next = fn(previous);
      if (next === previous) return;
      apply(next);
      putHotList(next).catch((err: unknown) => {
        apply(previous);
        toast(
          err instanceof Error ? `Could not save: ${err.message}` : 'Could not save changes',
          'error',
        );
      });
    },
    [apply, toast],
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
          return { ...g, items: [...without, item] };
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
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      mutate((list) => ({
        ...list,
        groups: [...list.groups, { id: newId(), name: trimmed, items: [] }],
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
  };
}

export default useHotList;
