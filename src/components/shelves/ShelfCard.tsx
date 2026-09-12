'use client';

import { useId, useState } from 'react';
import { ChevronDown, MoreHorizontal, Plus } from 'lucide-react';
import ShelfTile from '@/components/shelves/ShelfTile';
import { SHELF_ICON_COMPONENTS, SHELF_PREVIEW_COUNT, shelfColor, shelfIcon } from '@/components/shelves/style';
import Pressable from '@/components/ui/Pressable';
import { useLongPress } from '@/components/hooks/useLongPress';
import type { HotGroup, HotItem } from '@/lib/types';

export interface ShelfCardProps {
  group: HotGroup;
  index: number;
  /** Tap on a tile: open the file in Drive. */
  onOpenItem: (item: HotItem) => void;
  /** Long-press a tile, or its dots: the action sheet. */
  onSelectItem: (item: HotItem) => void;
  /** Long-press the header, or its dots: the shelf sheet (style, order, delete). */
  onManage: () => void;
  /** File id pinned in this session from /search; its tile gets the one-shot rise-in. */
  newItemId?: string;
}

/**
 * One hot-list group as a shelf: a tinted identity tile, the name, a count
 * pill, and a 2-up (3-up ≥ 1024px) grid of file tiles. Six tiles show; a
 * "+N more" tile expands the rest in place.
 *
 * The header is a `div` with two sibling buttons — collapse and manage — for
 * the same reason `ShelfTile` is: no `<button>` inside a `<button>`.
 */
export default function ShelfCard({
  group,
  index,
  onOpenItem,
  onSelectItem,
  onManage,
  newItemId,
}: ShelfCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const longPress = useLongPress(onManage);

  const color = shelfColor(group.color, index);
  const Icon = SHELF_ICON_COMPONENTS[shelfIcon(group.icon)];

  const overflow = Math.max(0, group.items.length - SHELF_PREVIEW_COUNT);
  const shown = expanded || overflow === 0 ? group.items : group.items.slice(0, SHELF_PREVIEW_COUNT);

  return (
    <section
      data-shelf={color}
      className="shelf-enter overflow-hidden rounded-md border border-subtle surface"
      aria-label={group.name}
    >
      <div className="flex items-center">
        <Pressable
          variant="ghost"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={() => setCollapsed((v) => !v)}
          className="min-h-14 flex-1 justify-start rounded-none px-3 text-left"
          contentClassName="flex w-full min-w-0 items-center gap-3"
          {...longPress}
        >
          <span className="shelf-tile-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-lg font-semibold">{group.name}</span>
          <span className="tabular shrink-0 rounded-full surface-2 px-2 py-0.5 text-xs font-medium text-muted">
            {group.items.length}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${
              collapsed ? '-rotate-90' : ''
            }`}
          />
        </Pressable>
        <Pressable
          variant="ghost"
          aria-label={`Manage ${group.name}`}
          onClick={onManage}
          className="mr-1.5 w-11 shrink-0 rounded-md px-0 text-muted"
        >
          <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
        </Pressable>
      </div>

      {/* Plain conditional, not `AnimatePresence`: an expand/collapse whose
          failure mode is "no animation" is fine, but the shelf's own content
          must never depend on a lazily loaded animation runtime to be seen. */}
      {collapsed ? null : (
        <div id={panelId} className="px-3 pb-3">
          {group.items.length === 0 ? (
            <p className="pb-1 text-sm text-muted">
              Nothing pinned here yet — pin from Search.
            </p>
          ) : (
            <ul
              className={`grid grid-cols-2 gap-3 lg:grid-cols-3 ${expanded ? 'shelf-expanded' : ''}`}
            >
              {shown.map((item) => (
                <li key={item.fileId} className="flex">
                  <ShelfTile
                    title={item.label ?? item.name}
                    fileName={item.name}
                    kind={item.kind}
                    iconLink={item.iconLink}
                    onOpen={() => onOpenItem(item)}
                    onMore={() => onSelectItem(item)}
                    isNew={item.fileId === newItemId}
                  />
                </li>
              ))}
              {overflow > 0 && !expanded ? (
                <li className="flex">
                  <Pressable
                    variant="ghost"
                    onClick={() => setExpanded(true)}
                    className="h-full w-full min-h-[118px] rounded-md border border-dashed border-subtle text-sm font-medium text-muted"
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    {overflow} more
                  </Pressable>
                </li>
              ) : null}
            </ul>
          )}

          {expanded && overflow > 0 ? (
            <Pressable
              variant="ghost"
              onClick={() => setExpanded(false)}
              className="mt-2 w-full text-sm text-muted"
            >
              Show less
            </Pressable>
          ) : null}
        </div>
      )}
    </section>
  );
}
