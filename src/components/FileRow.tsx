'use client';

import { MoreHorizontal, Pin } from 'lucide-react';
import KindIcon, { KIND_LABEL, KIND_TILE } from '@/components/KindIcon';
import { relativeTime } from '@/components/relativeTime';
import Pressable from '@/components/ui/Pressable';
import { useLongPress } from '@/components/hooks/useLongPress';
import type { FileKind } from '@/lib/types';

export interface FileRowProps {
  name: string;
  kind: FileKind;
  iconLink?: string;
  /** ISO timestamp rendered as a relative date. */
  modifiedTime?: string;
  /** Replaces the relative date in the meta line when given (e.g. the real file name under a label). */
  subtitle?: string;
  /** Shows the trailing pin glyph. */
  pinned?: boolean;
  /** Tap: open the file in Drive. */
  onOpen: () => void;
  /** Long-press, or the trailing button: open the action sheet. */
  onMore: () => void;
  className?: string;
}

/**
 * One file. Tap opens Drive, long-press opens the action sheet — and because a
 * long press is invisible and unavailable to keyboards, the same sheet also
 * hangs off an explicit trailing button.
 */
export default function FileRow({
  name,
  kind,
  iconLink,
  modifiedTime,
  subtitle,
  pinned = false,
  onOpen,
  onMore,
  className = '',
}: FileRowProps) {
  const longPress = useLongPress(onMore);
  const when = subtitle ?? relativeTime(modifiedTime);
  const meta = when ? `${when} · ${KIND_LABEL[kind]}` : KIND_LABEL[kind];

  return (
    <div className={`flex items-stretch ${className}`.trim()}>
      <Pressable
        variant="ghost"
        className="min-h-[60px] flex-1 justify-start rounded-md px-3 text-left"
        contentClassName="flex w-full min-w-0 items-center gap-3"
        onClick={onOpen}
        {...longPress}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${KIND_TILE[kind]}`}
        >
          <KindIcon kind={kind} iconLink={iconLink} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted">{meta}</span>
        </span>
        {pinned ? (
          <Pin aria-label="Pinned" className="h-4 w-4 shrink-0 text-accent" />
        ) : null}
      </Pressable>

      <Pressable
        variant="ghost"
        aria-label={`Actions for ${name}`}
        onClick={onMore}
        className="w-11 shrink-0 rounded-md px-0 text-muted"
      >
        <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
      </Pressable>
    </div>
  );
}
