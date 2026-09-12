'use client';

import { Pin } from 'lucide-react';
import FileRow from '@/components/FileRow';
import type { DriveFile } from '@/lib/types';

export interface SearchResultsProps {
  files: DriveFile[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelect: (file: DriveFile) => void;
  isPinned: (fileId: string) => boolean;
}

export default function SearchResults({
  files,
  loading,
  loadingMore,
  error,
  hasMore,
  onLoadMore,
  onSelect,
  isPinned,
}: SearchResultsProps) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
      >
        Search failed ({error}).
      </p>
    );
  }

  if (loading && files.length === 0) {
    return <p className="px-1 py-6 text-sm text-neutral-500 dark:text-neutral-400">Searching…</p>;
  }

  if (files.length === 0) {
    return <p className="px-1 py-6 text-sm text-neutral-500 dark:text-neutral-400">No matches.</p>;
  }

  return (
    <section aria-label="Search results" aria-busy={loading} className="space-y-2">
      <ul className="rounded-2xl border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900">
        {files.map((file) => (
          <li key={file.id}>
            <FileRow
              name={file.name}
              kind={file.kind}
              iconLink={file.iconLink}
              modifiedTime={file.modifiedTime}
              onSelect={() => onSelect(file)}
              trailing={
                isPinned(file.id) ? (
                  <span
                    title="Pinned"
                    className="flex w-9 items-center justify-center text-accent-600 dark:text-accent-400"
                  >
                    <Pin aria-label="Pinned" className="h-4 w-4" />
                  </span>
                ) : null
              }
            />
          </li>
        ))}
      </ul>

      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="min-h-[44px] w-full rounded-xl border border-neutral-300 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      ) : null}
    </section>
  );
}
