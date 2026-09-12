'use client';

import KindIcon, { KIND_BADGE, KIND_LABEL } from '@/components/KindIcon';
import { relativeTime } from '@/components/relativeTime';
import type { DriveFile } from '@/lib/types';

export interface RecentStripProps {
  files: DriveFile[];
  loading: boolean;
  error: string | null;
  onSelect: (file: DriveFile) => void;
}

export default function RecentStrip({ files, loading, error, onSelect }: RecentStripProps) {
  return (
    <section aria-label="Recent" className="space-y-2">
      <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">
        Recent
      </h2>

      {error ? (
        <p role="alert" className="px-1 text-sm text-red-600 dark:text-red-400">
          Could not load recent files ({error}).
        </p>
      ) : loading && files.length === 0 ? (
        <p className="px-1 text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : files.length === 0 ? (
        <p className="px-1 text-sm text-neutral-500 dark:text-neutral-400">Nothing recent.</p>
      ) : (
        <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
          {files.map((file) => (
            <li key={file.id} className="snap-start">
              <button
                type="button"
                onClick={() => onSelect(file)}
                className="flex h-full min-h-[112px] w-40 flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-3 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/60 dark:focus-visible:outline-accent-400"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                  <KindIcon kind={file.kind} iconLink={file.iconLink} />
                </span>
                <span className="mt-2 line-clamp-2 text-sm font-medium">{file.name}</span>
                <span className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {relativeTime(file.viewedByMeTime ?? file.modifiedTime)}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${KIND_BADGE[file.kind]}`}
                  >
                    {KIND_LABEL[file.kind]}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
