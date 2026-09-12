'use client';

import type { ReactNode } from 'react';
import KindIcon, { KIND_BADGE, KIND_LABEL } from '@/components/KindIcon';
import { relativeTime } from '@/components/relativeTime';
import type { FileKind } from '@/lib/types';

export interface FileRowProps {
  name: string;
  kind: FileKind;
  iconLink?: string;
  /** ISO timestamp rendered as a relative date. */
  modifiedTime?: string;
  /** Overrides the relative date when given. */
  subtitle?: string;
  onSelect: () => void;
  trailing?: ReactNode;
}

export default function FileRow({
  name,
  kind,
  iconLink,
  modifiedTime,
  subtitle,
  onSelect,
  trailing,
}: FileRowProps) {
  const meta = subtitle ?? relativeTime(modifiedTime);

  return (
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={onSelect}
        className="flex min-h-[56px] flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 active:bg-neutral-100 dark:hover:bg-neutral-800/70 dark:active:bg-neutral-800 dark:focus-visible:outline-accent-400"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
          <KindIcon kind={kind} iconLink={iconLink} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{name}</span>
          {meta ? (
            <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
              {meta}
            </span>
          ) : null}
        </span>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${KIND_BADGE[kind]}`}
        >
          {KIND_LABEL[kind]}
        </span>
      </button>
      {trailing}
    </div>
  );
}
