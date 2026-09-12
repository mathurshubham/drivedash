'use client';

import { MoreHorizontal } from 'lucide-react';
import KindIcon, { KIND_LABEL, KIND_TILE } from '@/components/KindIcon';
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
 * and a *sibling* 44px dots button positioned over its corner. A dots button
 * nested inside the main button would be invalid HTML and, in practice, eats
 * its own clicks in Safari.
 *
 * Tiles never swipe (DESIGN_PLAN §7) — the shelf grid owns the horizontal
 * axis for nothing, and the sheet mirrors every action anyway.
 */
export default function ShelfTile({
  title,
  fileName,
  kind,
  iconLink,
  thumbnailLink,
  onOpen,
  onMore,
  isNew = false,
}: ShelfTileProps) {
  const longPress = useLongPress(onMore);
  const showsLabel = Boolean(fileName && fileName !== title);

  return (
    <div className="relative w-full" data-new={isNew ? 'true' : undefined}>
      <Pressable
        variant="ghost"
        onClick={onOpen}
        {...longPress}
        title={showsLabel ? fileName : undefined}
        className="h-full w-full items-stretch rounded-md border border-subtle surface p-0 text-left"
        contentClassName="flex h-full w-full flex-col gap-2 p-2.5"
      >
        <span className="relative block h-16 w-16 shrink-0">
          {thumbnailLink ? (
            // Drive thumbnails are signed, remote and short-lived; next/image
            // would need a remote host allowlist and buys nothing at 64px.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailLink}
              alt=""
              aria-hidden="true"
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-md border border-subtle object-cover"
            />
          ) : (
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-md ${KIND_TILE[kind]}`}
            >
              <KindIcon kind={kind} iconLink={iconLink} className="h-7 w-7" />
            </span>
          )}
          {/* Kind glyph badge, so a thumbnail still says what the file is. */}
          <span
            aria-hidden="true"
            className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-subtle ${KIND_TILE[kind]}`}
          >
            <KindIcon kind={kind} className="h-3 w-3" />
          </span>
          <span className="sr-only">{KIND_LABEL[kind]}</span>
        </span>

        <span className="line-clamp-2 min-w-0 text-[14px] font-medium leading-snug">{title}</span>
      </Pressable>

      <Pressable
        variant="ghost"
        aria-label={`Actions for ${title}`}
        onClick={onMore}
        className="absolute right-0.5 top-0.5 h-11 w-11 min-h-11 rounded-md px-0 text-muted"
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
      </Pressable>
    </div>
  );
}
