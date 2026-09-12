'use client';

import type { ReactNode } from 'react';
import { Pin, PinOff, Share2 } from 'lucide-react';
import FileRow from '@/components/FileRow';
import { SearchEmpty } from '@/components/onboarding/EmptyStates';
import SwipeRow from '@/components/SwipeRow';
import Pressable from '@/components/ui/Pressable';
import { SkeletonList } from '@/components/ui/Skeleton';
import type { DriveFile } from '@/lib/types';

export interface SearchResultsProps {
  files: DriveFile[];
  /** The query the results belong to; shown in the empty state. */
  query?: string;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  /** Failure of an incremental "load more" page; shown under the list so loaded results stay visible. */
  loadMoreError?: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  /** Tap: open in Drive. */
  onOpen: (file: DriveFile) => void;
  /** Long-press / trailing button: action sheet. */
  onSelect: (file: DriveFile) => void;
  onPin: (file: DriveFile) => void;
  onUnpin: (file: DriveFile) => void;
  onShare: (file: DriveFile) => void;
  isPinned: (fileId: string) => boolean;
  /** Wraps the first row with the swipe hint when nothing above it claimed it. */
  decorateFirstRow?: (row: ReactNode) => ReactNode;
}

export default function SearchResults({
  files,
  query = '',
  loading,
  loadingMore,
  error,
  loadMoreError = null,
  hasMore,
  onLoadMore,
  onOpen,
  onSelect,
  onPin,
  onUnpin,
  onShare,
  isPinned,
  decorateFirstRow,
}: SearchResultsProps) {
  if (error) {
    return (
      <p role="alert" className="rounded-md border border-subtle px-3 py-2 text-sm text-danger">
        Search failed ({error}).
      </p>
    );
  }

  if (loading && files.length === 0) {
    return (
      <SkeletonList
        count={5}
        variant="row"
        label="Searching"
        className="rounded-md border border-subtle surface"
      />
    );
  }

  if (files.length === 0) return <SearchEmpty query={query} />;

  return (
    <section aria-label="Search results" aria-busy={loading} className="space-y-2">
      <ul className="overflow-hidden rounded-md border border-subtle surface py-1">
        {files.map((file, i) => {
          const pinned = isPinned(file.id);
          const row = (
            <SwipeRow
              leftAction={{
                label: pinned ? 'Unpin' : 'Pin',
                tone: 'accent',
                icon: pinned ? (
                  <PinOff aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Pin aria-hidden="true" className="h-4 w-4" />
                ),
                onTrigger: () => (pinned ? onUnpin(file) : onPin(file)),
              }}
              rightAction={{
                label: 'Share',
                tone: 'neutral',
                icon: <Share2 aria-hidden="true" className="h-4 w-4" />,
                onTrigger: () => onShare(file),
              }}
            >
              <FileRow
                name={file.name}
                kind={file.kind}
                iconLink={file.iconLink}
                modifiedTime={file.modifiedTime}
                pinned={pinned}
                onOpen={() => onOpen(file)}
                onMore={() => onSelect(file)}
              />
            </SwipeRow>
          );
          return (
            <li key={file.id} className="px-1">
              {i === 0 && decorateFirstRow ? decorateFirstRow(row) : row}
            </li>
          );
        })}
      </ul>

      {loadMoreError ? (
        <p role="alert" className="rounded-md border border-subtle px-3 py-2 text-sm text-danger">
          Could not load more results ({loadMoreError}). Try again.
        </p>
      ) : null}

      {hasMore ? (
        <Pressable variant="secondary" block loading={loadingMore} onClick={onLoadMore}>
          {loadingMore ? 'Loading…' : loadMoreError ? 'Retry' : 'Load more'}
        </Pressable>
      ) : null}
    </section>
  );
}
