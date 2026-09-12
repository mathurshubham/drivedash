'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import HotGroupSection from '@/components/HotGroupSection';
import type { HotItem, HotList as HotListType } from '@/lib/types';

export interface HotListProps {
  hotList: HotListType | null;
  loading: boolean;
  error: string | null;
  onRenameGroup: (groupId: string, name: string) => void;
  onMoveGroup: (groupId: string, direction: -1 | 1) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddGroup: (name: string) => void;
  onSelectItem: (item: HotItem) => void;
}

export default function HotList({
  hotList,
  loading,
  error,
  onRenameGroup,
  onMoveGroup,
  onDeleteGroup,
  onAddGroup,
  onSelectItem,
}: HotListProps) {
  const [newGroup, setNewGroup] = useState('');

  const submitNewGroup = () => {
    const trimmed = newGroup.trim();
    if (!trimmed) return;
    onAddGroup(trimmed);
    setNewGroup('');
  };

  if (loading && !hotList) {
    return (
      <p className="px-1 py-6 text-sm text-neutral-500 dark:text-neutral-400">Loading pinned…</p>
    );
  }

  if (error && !hotList) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      >
        Could not load your pinned list ({error}).
      </p>
    );
  }

  const groups = hotList?.groups ?? [];

  return (
    <section aria-label="Pinned" className="space-y-3">
      <h2 className="sr-only">Pinned</h2>

      {groups.map((group, i) => (
        <HotGroupSection
          key={group.id}
          group={group}
          index={i}
          total={groups.length}
          onRename={(name) => onRenameGroup(group.id, name)}
          onMove={(direction) => onMoveGroup(group.id, direction)}
          onDelete={() => onDeleteGroup(group.id)}
          onSelectItem={onSelectItem}
        />
      ))}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitNewGroup();
        }}
      >
        <input
          value={newGroup}
          onChange={(e) => setNewGroup(e.target.value)}
          placeholder="Add a group"
          aria-label="Add a group"
          className="min-h-[44px] flex-1 rounded-xl border border-dashed border-neutral-300 bg-transparent px-3 text-[15px] outline-none focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={!newGroup.trim()}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl border border-neutral-300 px-3 text-sm font-medium hover:bg-neutral-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add
        </button>
      </form>
    </section>
  );
}
