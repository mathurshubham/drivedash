'use client';

import { MoreHorizontal } from 'lucide-react';
import KindIcon, { KIND_LABEL, KIND_TILE } from '@/components/KindIcon';
import { relativeTime } from '@/components/relativeTime';
import Pressable from '@/components/ui/Pressable';
import { useLongPress } from '@/components/hooks/useLongPress';
import type { FileKind } from '@/lib/types';

export interface ShelfTileProps {
  /** What the tile reads as: the user's label when set, otherwise the file name. */
  title: string;
  /** The real file name, shown as the tooltip when a label has replaced it. */
  fileName?: string;
  kind: FileKind;
  iconLink?: string;
  thumbnailLink?: string;
  /** ISO time the file was pinned, when the stored entry has one. */
  pinnedAt?: string;
  /** Tap: open in Drive. */
  onOpen: () => void;
  /** Long-press, or the corner dots: the action sheet. */
  onMore: () => void;
  /** Marks a tile that has just arrived (pinned from /search) for a one-shot rise-in. */
  isNew?: boolean;
}

/**
 * One file in a shelf.
 *
 * Structure matters here: the tile is a `div` holding a full-bleed main button
 * and a *sibling* dots button positioned over its corner. A dots button nested
 * inside the main button would be invalid HTML and, in practice, eats its own
 * clicks in Safari.
 *
 * That corner button is wrapped in an absolutely-positioned `span` rather than
 * carrying `absolute` itself. `Pressable`'s base class list includes
 * `relative`, and two position utilities in one class list resolve by
 * stylesheet order, not by the order written — Tailwind emits `.relative` after
 * `.absolute`, so `relative` won and every "···" laid itself out in normal
 * flow, below its tile. Position the wrapper, never the `Pressable`.
 *
 * The tile is content-sized: no fixed height and no aspect ratio, so a
 * one-line name gives a short tile instead of a tall empty card.
 *
 * Tiles never swipe (DESIGN_PLAN §7) — the sheet mirrors every action anyway.
 */
export default function ShelfTile({
  title,
  fileName,
  kind,
  iconLink,
  thumbnailLink,
  pinnedAt,
  onOpen,
  onMore,
  isNew = false,
}: ShelfTileProps) {
  const longPress = useLongPress(onMore);
  const showsLabel = Boolean(fileName && fileName !== title);
  const when = relativeTime(pinnedAt);
  const meta = when ? `${KIND_LABEL[kind]} · ${when}` : KIND_LABEL[kind];

  return (
    <div className="relative w-full" data-new={isNew ? 'true' : undefined}>
      <Pressable
        variant="ghost"
        onClick={onOpen}
        {...longPress}
        title={showsLabel ? fileName : undefined}
        className="w-full items-stretch rounded-md border border-subtle surface p-0 text-left"
        contentClassName="flex w-full flex-col gap-2 p-3"
      >
        <span className="relative block h-14 w-14 shrink-0">
          {thumbnailLink ? (
            // Drive thumbnails are signed, remote and short-lived; next/image
            // would need a remote host allowlist and buys nothing at 56px.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailLink}
              alt=""
              aria-hidden="true"
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-md border border-subtle object-cover"
            />
          ) : (
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-md ${KIND_TILE[kind]}`}
            >
              <KindIcon kind={kind} iconLink={iconLink} className="h-6 w-6" />
            </span>
          )}
          {/* Kind glyph badge, so a thumbnail still says what the file is. */}
          <span
            aria-hidden="true"
            className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-subtle ${KIND_TILE[kind]}`}
          >
            <KindIcon kind={kind} className="h-3 w-3" />
          </span>
        </span>

        {/* `break-words`, never `break-all`: the latter chopped names
            mid-syllable ("Quart|erly"). Long unbroken ids still wrap. */}
        <span className="line-clamp-2 min-w-0 break-words text-[14px] font-medium leading-snug">
          {title}
        </span>
        <span className="min-w-0 truncate text-[12px] leading-4 text-muted">{meta}</span>
      </Pressable>

      {/* 36px, inset so it clears the 12px padding and sits over the tile. */}
      <span className="absolute right-1 top-1">
        <Pressable
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${title}`}
          onClick={onMore}
          className="rounded-md text-muted"
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </Pressable>
      </span>
    </div>
  );
}
