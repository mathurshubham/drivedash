'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Clock, PinOff, Search, Share2 } from 'lucide-react';

/**
 * Presentational empty states. Deliberately self-contained (plain Tailwind,
 * no dependency on Agent A's `EmptyState` primitive) so this can land and be
 * used independently; Agent C may later swap the shell for Agent A's
 * `EmptyState` without changing call sites' props.
 */
function Shell({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center dark:border-neutral-700">
      <Icon aria-hidden="true" className="h-8 w-8 text-neutral-400 dark:text-neutral-500" />
      <p className="mt-2 text-[15px] font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </p>
      <p className="max-w-[280px] text-sm text-neutral-500 dark:text-neutral-400">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function HotListEmpty({ onStartTour }: { onStartTour?: () => void }) {
  return (
    <Shell
      icon={PinOff}
      title="Nothing pinned yet"
      body="Long-press a file, or swipe right, to pin it here."
      action={
        onStartTour ? (
          <button
            type="button"
            onClick={onStartTour}
            className="min-h-[44px] rounded-xl border border-neutral-300 px-4 text-sm font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Show me around
          </button>
        ) : undefined
      }
    />
  );
}

export function SharesEmpty() {
  return (
    <Shell
      icon={Share2}
      title="No shares yet"
      body="Share a file from the home screen and it will show up here, with its expiry and status."
    />
  );
}

export function SearchEmpty({ query }: { query: string }) {
  return (
    <Shell
      icon={Search}
      title="No matches"
      body={query ? `Nothing found for "${query}". Try a different word, or clear a type chip.` : 'Try a different search term.'}
    />
  );
}

export function RecentEmpty() {
  return (
    <Shell
      icon={Clock}
      title="Nothing recent"
      body="Files you open in Drive will show up here for quick access."
    />
  );
}
