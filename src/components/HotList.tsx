'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import ShelfCard from '@/components/shelves/ShelfCard';
import ShelfSkeleton from '@/components/shelves/ShelfSkeleton';
import { HotListEmpty } from '@/components/onboarding/EmptyStates';
import Pressable from '@/components/ui/Pressable';
import type { ShelfStyle } from '@/components/shelves/style';
import type { HotItem, HotList as HotListType } from '@/lib/types';

/** Shelf management pulls vaul in; it waits for the first long press or Add. */
const GroupSheet = dynamic(() => import('@/components/GroupSheet'), { ssr: false });

export interface HotListProps {
  hotList: HotListType | null;
  loading: boolean;
  error: string | null;
  onRenameGroup: (groupId: string, name: string) => void;
  onMoveGroup: (groupId: string, direction: -1 | 1) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddGroup: (name: string, style?: ShelfStyle) => void;
  onSetGroupStyle: (groupId: string, style: ShelfStyle) => void;
  /** Tap on a tile. */
  onOpenItem: (item: HotItem) => void;
  /** Long-press / corner dots: the action sheet. */
  onSelectItem: (item: HotItem) => void;
  /** Starts the guided tour from the empty state. */
  onStartTour: () => void;
  /** File pinned from /search in this session; its tile rises in once. */
  newItemId?: string;
}

type SheetState = { mode: 'create' } | { mode: 'edit'; groupId: string } | null;

/**
 * Home v2's "shelves" (DESIGN_PLAN §7): the hot list is the page. Groups are
 * cards in a responsive grid, each holding a grid of file tiles. The old
 * row-based `HotGroupSection` is gone with it.
 *
 * The grid is `auto-fill` from a 280px minimum rather than
 * `sm:grid-cols-2 lg:grid-cols-3`: that still lands on one, two and three
 * columns at the same widths, but it states the constraint that actually
 * matters — a shelf narrower than 280px cannot fit a 140px tile grid, and the
 * fixed column counts let it, which is how tiles ended up ~80px wide with
 * names clipped after five characters.
 */
export default function HotList({
  hotList,
  loading,
  error,
  onRenameGroup,
  onMoveGroup,
  onDeleteGroup,
  onAddGroup,
  onSetGroupStyle,
  onOpenItem,
  onSelectItem,
  onStartTour,
  newItemId,
}: HotListProps) {
  // `sheet` survives the close so vaul's exit animation still renders the
  // shelf's own name and style rather than flashing an empty sheet.
  const [sheet, setSheet] = useState<SheetState>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const groups = hotList?.groups ?? [];
  const empty = groups.every((g) => g.items.length === 0);

  const open = (next: NonNullable<SheetState>) => {
    setSheet(next);
    setSheetOpen(true);
  };

  const editing = sheet?.mode === 'edit' ? groups.find((g) => g.id === sheet.groupId) : undefined;
  const editingIndex = editing ? groups.indexOf(editing) : 0;

  return (
    <section aria-label="Pinned" data-tour="hotlist" className="space-y-3">
      <h2 className="sr-only">Pinned</h2>

      {loading && !hotList ? (
        <div role="status" aria-busy="true" aria-label="Loading shelves" className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          <ShelfSkeleton />
          <ShelfSkeleton />
        </div>
      ) : error && !hotList ? (
        <p role="alert" className="rounded-md border border-subtle px-3 py-2 text-sm text-danger">
          Could not load your pinned list ({error}).
        </p>
      ) : (
        <>
          {empty && groups.length === 0 ? <HotListEmpty onStartTour={onStartTour} /> : null}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {groups.map((group, i) => (
              <ShelfCard
                key={group.id}
                group={group}
                index={i}
                onOpenItem={onOpenItem}
                onSelectItem={onSelectItem}
                onManage={() => open({ mode: 'edit', groupId: group.id })}
                newItemId={newItemId}
              />
            ))}

            <Pressable
              variant="ghost"
              disabled={hotList === null}
              onClick={() => open({ mode: 'create' })}
              className="shelf-enter min-h-[96px] w-full rounded-md border border-dashed border-subtle text-sm font-medium text-muted"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add a shelf
            </Pressable>
          </div>
        </>
      )}

      {/* Mounted on first open and kept, so vaul still plays its close animation. */}
      {sheet !== null ? (
        <GroupSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          mode={sheet.mode === 'create' ? 'create' : 'edit'}
          group={editing}
          index={editingIndex}
          total={groups.length}
          onRename={(name) => editing && onRenameGroup(editing.id, name)}
          onMove={(direction) => editing && onMoveGroup(editing.id, direction)}
          onDelete={() => editing && onDeleteGroup(editing.id)}
          onSetStyle={(style) => editing && onSetGroupStyle(editing.id, style)}
          onCreate={onAddGroup}
        />
      ) : null}
    </section>
  );
}
