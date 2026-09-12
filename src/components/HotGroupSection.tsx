'use client';

import dynamic from 'next/dynamic';
import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { ChevronDown, Pencil, PinOff, Share2 } from 'lucide-react';
import FileRow from '@/components/FileRow';
import SwipeRow from '@/components/SwipeRow';
import Pressable from '@/components/ui/Pressable';
import { useLongPress } from '@/components/hooks/useLongPress';
import type { HotGroup, HotItem } from '@/lib/types';

/** Group management pulls vaul in; it waits for the first long press. */
const GroupSheet = dynamic(() => import('@/components/GroupSheet'), { ssr: false });

export interface HotGroupSectionProps {
  group: HotGroup;
  index: number;
  total: number;
  onRename: (name: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  /** Tap on a row: open the file in Drive. */
  onOpenItem: (item: HotItem) => void;
  /** Long-press, trailing button or a swipe: open the action sheet. */
  onSelectItem: (item: HotItem) => void;
  onUnpinItem: (item: HotItem) => void;
  onShareItem: (item: HotItem) => void;
  /** Wraps the first row of the whole list, once, with the swipe hint. */
  decorateFirstRow?: (row: ReactNode) => ReactNode;
}

/**
 * One pinned group as a card. The header collapses the group; long-pressing it
 * opens the group sheet, which is where rename / reorder / delete live — the
 * four inline icon buttons they replace crowded the header and were easy to
 * hit by accident.
 */
export default function HotGroupSection({
  group,
  index,
  total,
  onRename,
  onMove,
  onDelete,
  onOpenItem,
  onSelectItem,
  onUnpinItem,
  onShareItem,
  decorateFirstRow,
}: HotGroupSectionProps) {
  const reduced = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const panelId = useId();
  const openSheet = () => {
    setEverOpened(true);
    setSheetOpen(true);
  };
  const longPress = useLongPress(openSheet);

  return (
    <section className="overflow-hidden rounded-md border border-subtle surface">
      <div className="flex items-center">
        <Pressable
          variant="ghost"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={() => setCollapsed((v) => !v)}
          className="min-h-14 flex-1 justify-start rounded-none px-4 text-left"
          contentClassName="flex w-full min-w-0 items-center gap-2"
          {...longPress}
        >
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{group.name}</span>
          <span className="tabular shrink-0 rounded-full surface-2 px-2 py-0.5 text-xs font-medium text-muted">
            {group.items.length}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${
              collapsed ? 'rotate-180' : ''
            }`}
          />
        </Pressable>
        <Pressable
          variant="ghost"
          aria-label={`Manage ${group.name}`}
          onClick={openSheet}
          className="mr-2 w-11 shrink-0 rounded-md px-0 text-muted"
        >
          <Pencil aria-hidden="true" className="h-4 w-4" />
        </Pressable>
      </div>

      <AnimatePresence initial={false}>
        {collapsed ? null : (
          <m.div
            id={panelId}
            key="items"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={reduced ? undefined : { height: 'auto', opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            {group.items.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted">Nothing pinned here yet.</p>
            ) : (
              <ul className="pb-1">
                {group.items.map((item, i) => {
                  const row = (
                    <SwipeRow
                      leftAction={{
                        label: 'Unpin',
                        tone: 'accent',
                        icon: <PinOff aria-hidden="true" className="h-4 w-4" />,
                        onTrigger: () => onUnpinItem(item),
                      }}
                      rightAction={{
                        label: 'Share',
                        tone: 'neutral',
                        icon: <Share2 aria-hidden="true" className="h-4 w-4" />,
                        onTrigger: () => onShareItem(item),
                      }}
                    >
                      <FileRow
                        name={item.label ?? item.name}
                        kind={item.kind}
                        iconLink={item.iconLink}
                        subtitle={item.label ? item.name : undefined}
                        pinned
                        onOpen={() => onOpenItem(item)}
                        onMore={() => onSelectItem(item)}
                      />
                    </SwipeRow>
                  );
                  return (
                    <li key={item.fileId} className="px-1">
                      {/* No `m.div layout` here: layout animations live in
                          motion's `domMax` bundle and we are pinned to
                          `domAnimation`, so a reordered row fades in instead. */}
                      <m.div
                        initial={reduced ? false : { opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduced ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                      >
                        {i === 0 && decorateFirstRow ? decorateFirstRow(row) : row}
                      </m.div>
                    </li>
                  );
                })}
              </ul>
            )}
          </m.div>
        )}
      </AnimatePresence>

      {/* Mounted on first open and kept, so vaul still plays its close animation. */}
      {everOpened ? (
        <GroupSheet
          open={sheetOpen}
          group={group}
          index={index}
          total={total}
          onOpenChange={setSheetOpen}
          onRename={onRename}
          onMove={onMove}
          onDelete={onDelete}
        />
      ) : null}
    </section>
  );
}
