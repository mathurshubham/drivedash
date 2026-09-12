'use client';

import KindIcon, { KIND_TILE } from '@/components/KindIcon';
import { RecentEmpty } from '@/components/onboarding/EmptyStates';
import { relativeTime } from '@/components/relativeTime';
import Pressable from '@/components/ui/Pressable';
import Skeleton from '@/components/ui/Skeleton';
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
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading recent files"
          className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1"
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
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
      className="h-[112px] w-[112px] items-stretch rounded-md border border-subtle surface p-0 text-left"
      contentClassName="flex h-full w-full flex-col gap-2 p-3"
    >
      {file.thumbnailLink ? (
        // Drive thumbnails are signed, remote and short-lived; next/image would
        // need a remote host allowlist and buys nothing at 106px wide.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.thumbnailLink}
          alt=""
          aria-hidden="true"
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-10 w-full shrink-0 rounded-sm object-cover"
        />
      ) : (
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${KIND_TILE[file.kind]}`}
        >
          <KindIcon kind={file.kind} iconLink={file.iconLink} className="h-5 w-5" />
        </span>
      )}
      <span className="line-clamp-2 min-w-0 flex-1 text-xs font-medium leading-snug">
        {file.name}
      </span>
      <span className="truncate text-[0.75rem] text-muted">
        {relativeTime(file.viewedByMeTime ?? file.modifiedTime)}
      </span>
    </Pressable>
  );
}
