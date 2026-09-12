'use client';

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import Pressable from '@/components/ui/Pressable';
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
        <p className="px-1 text-sm text-muted">{emptyHint}</p>
      ) : (
        <ul className="space-y-1">
          {groups.map((g) => (
            <li key={g.id}>
              <Pressable
                variant="ghost"
                block
                size="lg"
                onClick={() => onPick(g.id)}
                className="justify-start px-3 text-left"
                contentClassName="flex w-full min-w-0 items-center justify-between gap-3"
              >
                <span className="min-w-0 truncate text-sm">{g.name}</span>
                {g.id === selectedGroupId ? (
                  <Check aria-label="Current group" className="h-4 w-4 shrink-0 text-accent" />
                ) : (
                  <span className="tabular shrink-0 text-xs text-muted">{g.items.length}</span>
                )}
              </Pressable>
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
          className="min-h-11 flex-1 rounded-sm border border-subtle surface px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <Pressable variant="primary" onClick={create} disabled={!name.trim()}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add
        </Pressable>
      </div>
    </div>
  );
}
