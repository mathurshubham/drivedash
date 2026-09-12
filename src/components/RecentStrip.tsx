'use client';

import KindIcon, { KIND_TILE } from '@/components/KindIcon';
import { RecentEmpty } from '@/components/onboarding/EmptyStates';
import { relativeTime } from '@/components/relativeTime';
import Pressable from '@/components/ui/Pressable';
import { SkeletonList } from '@/components/ui/Skeleton';
import { useLongPress } from '@/components/hooks/useLongPress';
import type { DriveFile } from '@/lib/types';

export interface RecentStripProps {
  files: DriveFile[];
  loading: boolean;
  error: string | null;
  /** Tap: open in Drive. */
  onOpen: (file: DriveFile) => void;
  /** Long-press: action sheet. */
  onSelect: (file: DriveFile) => void;
}

export default function RecentStrip({ files, loading, error, onOpen, onSelect }: RecentStripProps) {
  return (
    <section aria-label="Recent" data-tour="recent" className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Recent</h2>

      {error ? (
        <p role="alert" className="px-1 text-sm text-danger">
          Could not load recent files ({error}).
        </p>
      ) : loading && files.length === 0 ? (
        <SkeletonList
          count={3}
          variant="card"
          label="Loading recent files"
          className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1"
        />
      ) : files.length === 0 ? (
        <RecentEmpty />
      ) : (
        <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
          {files.map((file) => (
            <li key={file.id} className="snap-start">
              <RecentCard file={file} onOpen={() => onOpen(file)} onSelect={() => onSelect(file)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentCard({
  file,
  onOpen,
  onSelect,
}: {
  file: DriveFile;
  onOpen: () => void;
  onSelect: () => void;
}) {
  const longPress = useLongPress(onSelect);

  return (
    <Pressable
      variant="ghost"
      onClick={onOpen}
      {...longPress}
      className="w-[136px] items-stretch rounded-md border border-subtle surface p-0 text-left"
      contentClassName="flex w-full flex-col gap-2 p-3"
    >
      {file.thumbnailLink ? (
        // Drive thumbnails are signed, remote and short-lived; next/image would
        // need a remote host allowlist and buys nothing at this size.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.thumbnailLink}
          alt=""
          aria-hidden="true"
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-14 w-14 shrink-0 rounded-md border border-subtle object-cover"
        />
      ) : (
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-md ${KIND_TILE[file.kind]}`}
        >
          <KindIcon kind={file.kind} iconLink={file.iconLink} className="h-6 w-6" />
        </span>
      )}
      {/* `break-words` plus `[overflow-wrap:anywhere]`: a name with no spaces
          ("WhatsApp Image ...") was clipping mid-word ("WhatsAp") because
          `line-clamp-2` on a flex child cuts an overflowing partial line with
          no ellipsis rather than wrapping it — `break-words` alone still
          leaves an unbroken token to overflow at this card width. */}
      <span className="line-clamp-2 min-w-0 break-words text-[13px] font-medium leading-snug [overflow-wrap:anywhere]">
        {file.name}
      </span>
      <span className="truncate text-[12px] text-muted">
        {relativeTime(file.viewedByMeTime ?? file.modifiedTime)}
      </span>
    </Pressable>
  );
}
