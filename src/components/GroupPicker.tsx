'use client';

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import type { HotGroup } from '@/lib/types';

export interface GroupPickerProps {
  groups: HotGroup[];
  /** Group the file currently lives in, if any. */
  selectedGroupId?: string;
  onPick: (groupId: string) => void;
  /** Creates a group; the new group then appears in the list to pick. */
  onCreateGroup: (name: string) => void;
  emptyHint?: string;
}

export default function GroupPicker({
  groups,
  selectedGroupId,
  onPick,
  onCreateGroup,
  emptyHint = 'No groups yet — create one below.',
}: GroupPickerProps) {
  const [name, setName] = useState('');

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateGroup(trimmed);
    setName('');
  };

  return (
    <div className="space-y-2">
      {groups.length === 0 ? (
        <p className="px-1 text-sm text-neutral-500 dark:text-neutral-400">{emptyHint}</p>
      ) : (
        <ul className="space-y-1">
          {groups.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => onPick(g.id)}
                className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[15px] hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:hover:bg-neutral-800 dark:focus-visible:outline-accent-400"
              >
                <span className="min-w-0 truncate">{g.name}</span>
                {g.id === selectedGroupId ? (
                  <Check aria-label="Current group" className="h-4 w-4 text-accent-600 dark:text-accent-400" />
                ) : (
                  <span className="text-xs text-neutral-400">{g.items.length}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 pt-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              create();
            }
          }}
          placeholder="New group name"
          aria-label="New group name"
          className="min-h-[44px] flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-[15px] outline-none focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="button"
          onClick={create}
          disabled={!name.trim()}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:bg-neutral-100 dark:text-neutral-900"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  );
}
