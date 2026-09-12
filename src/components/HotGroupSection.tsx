'use client';

import { useId, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import FileRow from '@/components/FileRow';
import type { HotGroup, HotItem } from '@/lib/types';

export interface HotGroupSectionProps {
  group: HotGroup;
  index: number;
  total: number;
  onRename: (name: string) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onSelectItem: (item: HotItem) => void;
}

export default function HotGroupSection({
  group,
  index,
  total,
  onRename,
  onMove,
  onDelete,
  onSelectItem,
}: HotGroupSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  const [confirming, setConfirming] = useState(false);
  const panelId = useId();

  const iconButton =
    'flex h-11 w-11 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:opacity-30 dark:hover:bg-neutral-800 dark:focus-visible:outline-accent-400';

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-1 px-2 py-1.5">
        {renaming ? (
          <form
            className="flex flex-1 items-center gap-2 p-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onRename(name);
              setRenaming(false);
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Group name"
              className="min-h-[44px] flex-1 rounded-lg border border-neutral-300 bg-white px-3 text-[15px] outline-none focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:border-neutral-700 dark:bg-neutral-950"
            />
            <button
              type="submit"
              className="min-h-[44px] rounded-lg bg-accent-600 px-3 text-sm font-medium text-white hover:bg-accent-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setName(group.name);
                setRenaming(false);
              }}
              className="min-h-[44px] rounded-lg px-3 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              aria-expanded={!collapsed}
              aria-controls={panelId}
              onClick={() => setCollapsed((v) => !v)}
              className="flex min-h-[44px] flex-1 items-center gap-2 rounded-lg px-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:focus-visible:outline-accent-400"
            >
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${collapsed ? '-rotate-90' : ''}`}
              />
              <span className="min-w-0 truncate text-sm font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">
                {group.name}
              </span>
              <span className="text-xs text-neutral-400">{group.items.length}</span>
            </button>

            <button
              type="button"
              aria-label={`Rename ${group.name}`}
              onClick={() => {
                setName(group.name);
                setRenaming(true);
              }}
              className={iconButton}
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Move ${group.name} up`}
              disabled={index === 0}
              onClick={() => onMove(-1)}
              className={iconButton}
            >
              <ChevronUp aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Move ${group.name} down`}
              disabled={index === total - 1}
              onClick={() => onMove(1)}
              className={iconButton}
            >
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Delete ${group.name}`}
              onClick={() => setConfirming(true)}
              className={iconButton}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {confirming ? (
        <div
          role="alertdialog"
          aria-label={`Delete group ${group.name}`}
          className="mx-2 mb-2 rounded-xl bg-red-50 p-3 dark:bg-red-950/40"
        >
          <p className="text-sm text-red-800 dark:text-red-200">
            Delete “{group.name}”? {group.items.length} pinned item
            {group.items.length === 1 ? '' : 's'} will be unpinned. Files in Drive are not touched.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
              className="min-h-[44px] rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
            >
              Delete group
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-[44px] rounded-lg px-4 text-sm hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div id={panelId} hidden={collapsed} className="px-1 pb-2">
        {group.items.length === 0 ? (
          <p className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
            Nothing pinned here yet.
          </p>
        ) : (
          <ul>
            {group.items.map((item) => (
              <li key={item.fileId}>
                <FileRow
                  name={item.label ?? item.name}
                  kind={item.kind}
                  iconLink={item.iconLink}
                  subtitle={item.label ? item.name : undefined}
                  onSelect={() => onSelectItem(item)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
