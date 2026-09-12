'use client';

import type { ExpiryDays } from '@/lib/types';

const OPTIONS: { value: ExpiryDays; label: string }[] = [
  { value: 1, label: '1 day' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: null, label: 'No expiry' },
];

export default function ExpiryChips({
  value,
  onChange,
}: {
  value: ExpiryDays;
  onChange: (next: ExpiryDays) => void;
}) {
  return (
    <div role="group" aria-label="Link expiry" className="flex flex-wrap gap-2">
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`min-h-[44px] shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:focus-visible:outline-accent-400 ${
              active
                ? 'border-accent-600 bg-accent-600 text-white'
                : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
