'use client';

import { useId, useState } from 'react';
import { ChevronDown, Plus, Search, Settings2 } from 'lucide-react';
import ShelfTile from '@/components/shelves/ShelfTile';
import { SHELF_ICON_COMPONENTS, SHELF_PREVIEW_COUNT, shelfColor, shelfIcon } from '@/components/shelves/style';
import Pressable, { Link } from '@/components/ui/Pressable';
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
 * pill, a "Manage" control, and an auto-filling grid of file tiles. Six tiles
 * show; a "+N more" tile expands the rest in place.
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
      <div className="flex min-h-14 items-center">
        {/* `shelf-press` gives the long-press gesture a 150ms scale so the
            150ms before the sheet opens is not dead time. */}
        <Pressable
          variant="ghost"
          aria-expanded={!collapsed}
          aria-controls={panelId}
          onClick={() => setCollapsed((v) => !v)}
          className="shelf-press min-h-14 min-w-0 flex-1 justify-start rounded-none px-3 text-left"
          contentClassName="flex w-full min-w-0 items-center gap-3"
          {...longPress}
        >
          <span className="shelf-tile-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
          {/*
            `line-clamp-2`, not `truncate`: a header narrow enough for a long
            shelf name (icon + count pill + chevron + the Manage control all
            share the row) used to clip it mid-word ("Routines - s…"). Two
            lines of 17/600 give it room without pushing the row past 56px.
          */}
          <span className="min-w-0 flex-1 line-clamp-2 text-base font-semibold leading-snug">
            {group.name}
          </span>
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
        {/*
          A bare "···" tested as decoration: nobody found the shelf sheet, so
          it carries a label from 480px up. Below that the label would crowd
          out an already two-line name, so the control shrinks to a 32px
          icon-only square instead (still `aria-label`led). Long-press on the
          header still opens the same sheet either way. The mobile-only size
          classes carry `!` — Pressable's own `md` size utilities (`min-h-11
          px-4`) are unprefixed and would otherwise win on stylesheet order,
          not on the order written here (see ui/README's Pressable note).
        */}
        <Pressable
          variant="ghost"
          aria-label={`Manage ${group.name}`}
          onClick={onManage}
          className="mr-1.5 shrink-0 rounded-full px-2 text-muted min-[480px]:px-3 max-[479px]:h-8! max-[479px]:w-8! max-[479px]:min-h-0! max-[479px]:p-0!"
        >
          <Settings2 aria-hidden="true" className="h-4 w-4" />
          <span className="hidden text-xs font-medium min-[480px]:inline">Manage</span>
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
            /*
              Auto-fill from a 150px minimum rather than a hard 2-up: a shelf is
              as narrow as 280px on a phone and as wide as a third of 960px on a
              desktop, and a fixed column count made tiles either ~80px wide
              (names clipped after five characters) or absurdly stretched. The
              track count now follows the space the shelf actually got — at a
              412px phone the card's inner width is 412 − 2×16 page gutters −
              2×12 card padding = 356px, so two 150px-minimum tiles land at
              (356 − 12 gap) ÷ 2 = 172px each.
            */
            <ul
              className={`grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 ${
                expanded ? 'shelf-expanded' : ''
              }`}
            >
              {shown.map((item) => (
                <li key={item.fileId} className="flex">
                  <ShelfTile
                    title={item.label ?? item.name}
                    fileName={item.name}
                    kind={item.kind}
                    iconLink={item.iconLink}
                    thumbnailLink={item.thumbnailLink}
                    pinnedAt={item.pinnedAt}
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
                    block
                    onClick={() => setExpanded(true)}
                    className="rounded-md border border-dashed border-subtle text-sm font-medium text-muted"
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    {overflow} more
                  </Pressable>
                </li>
              ) : null}
              {/*
                A lone tile leaves the second column empty. A dashed, low-
                contrast "Pin more" tile fills it — only below 2 tiles (a
                fuller shelf has nothing empty to explain) and only from
                360px, where a second column actually exists to put it in.
              */}
              {group.items.length < 2 ? (
                <li className="hidden min-[360px]:flex">
                  <Pressable
                    as={Link}
                    href="/search"
                    variant="ghost"
                    block
                    className="min-h-[128px] items-stretch rounded-md border border-dashed border-subtle text-muted opacity-70"
                    contentClassName="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-xs font-medium"
                  >
                    <Search aria-hidden="true" className="h-4 w-4" />
                    Pin more
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
