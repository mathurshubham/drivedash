'use client';

import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import HotGroupSection from '@/components/HotGroupSection';
import { HotListEmpty } from '@/components/onboarding/EmptyStates';
import Pressable from '@/components/ui/Pressable';
import { SkeletonList } from '@/components/ui/Skeleton';
import type { HotItem, HotList as HotListType } from '@/lib/types';

export interface HotListProps {
  hotList: HotListType | null;
  loading: boolean;
  error: string | null;
  onRenameGroup: (groupId: string, name: string) => void;
  onMoveGroup: (groupId: string, direction: -1 | 1) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddGroup: (name: string) => void;
  /** Tap on a row. */
  onOpenItem: (item: HotItem) => void;
  /** Long-press / trailing button: the action sheet. */
  onSelectItem: (item: HotItem) => void;
  onUnpinItem: (item: HotItem) => void;
  onShareItem: (item: HotItem) => void;
  /** Wraps the very first row in the list (swipe hint). */
  decorateFirstRow?: (row: ReactNode) => ReactNode;
  /** Starts the guided tour from the empty state. */
  onStartTour: () => void;
}

export default function HotList({
  hotList,
  loading,
  error,
  onRenameGroup,
  onMoveGroup,
  onDeleteGroup,
  onAddGroup,
  onOpenItem,
  onSelectItem,
  onUnpinItem,
  onShareItem,
  decorateFirstRow,
  onStartTour,
}: HotListProps) {
  const [newGroup, setNewGroup] = useState('');
  // No list means no group ids to edit against, so group management stays off.
  const disabled = hotList === null;

  const submitNewGroup = () => {
    const trimmed = newGroup.trim();
    if (!trimmed || disabled) return;
    onAddGroup(trimmed);
    setNewGroup('');
  };

  const groups = hotList?.groups ?? [];
  const empty = groups.every((g) => g.items.length === 0);
  // The hint belongs to whichever row is first on screen, so only the first
  // non-empty group may claim it.
  const firstFilled = groups.findIndex((g) => g.items.length > 0);

  return (
    <section aria-label="Pinned" data-tour="hotlist" className="space-y-3">
      <h2 className="sr-only">Pinned</h2>

      {loading && !hotList ? (
        <SkeletonList count={3} variant="row" label="Loading pinned files" className="rounded-md border border-subtle surface" />
      ) : error && !hotList ? (
        <p role="alert" className="rounded-md border border-subtle px-3 py-2 text-sm text-danger">
          Could not load your pinned list ({error}).
        </p>
      ) : (
        <>
          {empty ? (
            <HotListEmpty onStartTour={onStartTour} />
          ) : null}

          {groups.map((group, i) => (
            <HotGroupSection
              key={group.id}
              group={group}
              index={i}
              total={groups.length}
              onRename={(name) => onRenameGroup(group.id, name)}
              onMove={(direction) => onMoveGroup(group.id, direction)}
              onDelete={() => onDeleteGroup(group.id)}
              onOpenItem={onOpenItem}
              onSelectItem={onSelectItem}
              onUnpinItem={onUnpinItem}
              onShareItem={onShareItem}
              decorateFirstRow={i === firstFilled ? decorateFirstRow : undefined}
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
              disabled={disabled}
              placeholder="Add a group"
              aria-label="Add a group"
              className="min-h-11 flex-1 rounded-md border border-dashed border-subtle bg-transparent px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            />
            <Pressable type="submit" disabled={disabled || !newGroup.trim()}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add
            </Pressable>
          </form>
        </>
      )}
    </section>
  );
}
