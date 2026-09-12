'use client';

import { useId, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import Pressable from '@/components/ui/Pressable';
import Sheet from '@/components/ui/Sheet';
import type { HotGroup } from '@/lib/types';

/**
 * Group management, lifted out of the header's four inline icon buttons.
 * Loaded on demand (it drags vaul in with it) by `HotGroupSection`.
 */
export default function GroupSheet({
  open,
  group,
  index,
  total,
  onOpenChange,
  onRename,
  onMove,
  onDelete,
}: {
  open: boolean;
  group: HotGroup;
  index: number;
  total: number;
  onOpenChange: (open: boolean) => void;
  onRename: (name: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [confirming, setConfirming] = useState(false);
  const nameId = useId();

  // Each open starts from the group's current name with the confirm step
  // cleared. A render-phase reset, so the first painted frame is already right.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(group.name);
      setConfirming(false);
    }
  }

  const close = () => {
    setConfirming(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={group.name} snapPoints={[0.55, 0.92]}>
      <Sheet.Section title="Rename">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed && trimmed !== group.name) onRename(trimmed);
            close();
          }}
        >
          <label htmlFor={nameId} className="sr-only">
            Group name
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 flex-1 rounded-sm border border-subtle surface px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <Pressable variant="primary" type="submit" disabled={!name.trim()}>
            Save
          </Pressable>
        </form>
      </Sheet.Section>

      <Sheet.Section title="Order">
        <div className="flex gap-2">
          <Pressable
            block
            disabled={index === 0}
            onClick={() => {
              onMove(-1);
              close();
            }}
          >
            <ArrowUp aria-hidden="true" className="h-4 w-4" />
            Move up
          </Pressable>
          <Pressable
            block
            disabled={index === total - 1}
            onClick={() => {
              onMove(1);
              close();
            }}
          >
            <ArrowDown aria-hidden="true" className="h-4 w-4" />
            Move down
          </Pressable>
        </div>
      </Sheet.Section>

      <Sheet.Section title="Danger zone">
        {confirming ? (
          <div role="alertdialog" aria-label={`Delete group ${group.name}`} className="space-y-2">
            <p className="text-sm text-muted">
              Delete “{group.name}”? {group.items.length} pinned item
              {group.items.length === 1 ? '' : 's'} will be unpinned. Files in Drive are not
              touched.
            </p>
            <div className="flex gap-2">
              <Pressable
                variant="danger"
                onClick={() => {
                  close();
                  onDelete();
                }}
              >
                Delete group
              </Pressable>
              <Pressable variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Pressable>
            </div>
          </div>
        ) : (
          <Pressable block variant="ghost" className="justify-start text-danger" onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Delete group
          </Pressable>
        )}
      </Sheet.Section>
    </Sheet>
  );
}
