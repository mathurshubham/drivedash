'use client';

import { useId, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Trash2 } from 'lucide-react';
import {
  SHELF_COLORS,
  SHELF_COLOR_LABEL,
  SHELF_ICONS,
  SHELF_ICON_COMPONENTS,
  SHELF_ICON_LABEL,
  shelfColor,
  shelfIcon,
  type ShelfStyle,
} from '@/components/shelves/style';
import Pressable from '@/components/ui/Pressable';
import Sheet from '@/components/ui/Sheet';
import type { HotGroup, ShelfColor, ShelfIcon } from '@/lib/types';

export type { ShelfStyle };

export interface GroupSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * `edit` manages an existing shelf; `create` is the same sheet reached from
   * the "Add a shelf" tile — name and style only, no order or delete.
   */
  mode?: 'edit' | 'create';
  /** The shelf being edited. Ignored in create mode. */
  group?: HotGroup;
  /** Position of `group` in the list, for the Move up / Move down buttons. */
  index?: number;
  total?: number;
  onRename?: (name: string) => void;
  onMove?: (direction: -1 | 1) => void;
  onDelete?: () => void;
  /** Persists the chosen hue/glyph on an existing shelf. */
  onSetStyle?: (style: ShelfStyle) => void;
  /** Creates a shelf with the chosen name and style (create mode). */
  onCreate?: (name: string, style: ShelfStyle) => void;
}

/**
 * Shelf management (DESIGN_PLAN §7): name, identity (hue + glyph), order and
 * delete. Loaded on demand — it drags vaul in with it.
 */
export default function GroupSheet({
  open,
  onOpenChange,
  mode = 'edit',
  group,
  index = 0,
  total = 1,
  onRename,
  onMove,
  onDelete,
  onSetStyle,
  onCreate,
}: GroupSheetProps) {
  const creating = mode === 'create';
  const [name, setName] = useState(group?.name ?? '');
  const [color, setColor] = useState<ShelfColor>(shelfColor(group?.color, index));
  const [icon, setIcon] = useState<ShelfIcon>(shelfIcon(group?.icon));
  const [confirming, setConfirming] = useState(false);
  const nameId = useId();

  // Each open starts from the shelf's current values with the confirm step
  // cleared. A render-phase reset, so the first painted frame is already right.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(creating ? '' : (group?.name ?? ''));
      setColor(shelfColor(group?.color, index));
      setIcon(shelfIcon(group?.icon));
      setConfirming(false);
    }
  }

  const close = () => {
    setConfirming(false);
    onOpenChange(false);
  };

  /**
   * In edit mode the style is saved the moment it is picked — a swatch that
   * needs a second "Save" tap reads as broken. In create mode there is nothing
   * to save onto yet, so it is held until submit.
   */
  const pickColor = (next: ShelfColor) => {
    setColor(next);
    if (!creating) onSetStyle?.({ color: next });
  };
  const pickIcon = (next: ShelfIcon) => {
    setIcon(next);
    if (!creating) onSetStyle?.({ icon: next });
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (creating) onCreate?.(trimmed, { color, icon });
    else if (trimmed !== group?.name) onRename?.(trimmed);
    close();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={creating ? 'New shelf' : (group?.name ?? 'Shelf')}
    >
      <Sheet.Section title={creating ? 'Name' : 'Rename'}>
        {/*
          Stacked, not a row. Side by side, the input took `flex-1` (whose
          `min-width: auto` will not shrink past the text it holds) and the
          button would not shrink at all, so at 412px the Create/Save button
          was pushed past the right edge of the sheet and the whole sheet
          scrolled sideways.
        */}
        <form
          className="flex w-full max-w-full flex-col gap-2 overflow-x-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor={nameId} className="sr-only">
            Shelf name
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={creating ? 'e.g. Client decks' : undefined}
            className="min-h-11 w-full min-w-0 rounded-sm border border-subtle surface px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <Pressable block variant="primary" type="submit" disabled={!name.trim()}>
            {creating ? 'Create' : 'Save'}
          </Pressable>
        </form>
      </Sheet.Section>

      <Sheet.Section title="Colour">
        {/*
          A wrapping grid rather than `flex-wrap`: eight 44px swatches plus
          gaps need 408px, so on a 412px phone they wrapped to an orphaned
          single swatch on a second row. Four per row below `sm`, eight above.
        */}
        <div
          role="radiogroup"
          aria-label="Shelf colour"
          className="grid max-w-full grid-cols-4 gap-2 sm:grid-cols-8"
        >
          {SHELF_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              aria-label={SHELF_COLOR_LABEL[c]}
              data-shelf={c}
              onClick={() => pickColor(c)}
              className={`shelf-tile-bg flex h-11 w-full min-w-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                c === color ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''
              }`}
            >
              {c === color ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
            </button>
          ))}
        </div>
      </Sheet.Section>

      <Sheet.Section title="Icon">
        <div
          role="radiogroup"
          aria-label="Shelf icon"
          data-shelf={color}
          className="grid max-w-full grid-cols-4 gap-2 sm:grid-cols-8"
        >
          {SHELF_ICONS.map((i) => {
            const Icon = SHELF_ICON_COMPONENTS[i];
            const selected = i === icon;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={SHELF_ICON_LABEL[i]}
                onClick={() => pickIcon(i)}
                className={`flex min-h-11 items-center justify-center rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  selected ? 'shelf-tile-bg border-transparent' : 'border-subtle text-muted'
                }`}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      </Sheet.Section>

      {creating ? null : (
        <>
          <Sheet.Section title="Order">
            <div className="flex gap-2">
              <Pressable
                block
                disabled={index === 0}
                onClick={() => {
                  onMove?.(-1);
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
                  onMove?.(1);
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
              <div
                role="alertdialog"
                aria-label={`Delete shelf ${group?.name ?? ''}`}
                className="space-y-2"
              >
                <p className="text-sm text-muted">
                  Delete “{group?.name}”? {group?.items.length ?? 0} pinned item
                  {(group?.items.length ?? 0) === 1 ? '' : 's'} will be unpinned. Files in Drive are
                  not touched.
                </p>
                <div className="flex gap-2">
                  <Pressable
                    variant="danger"
                    onClick={() => {
                      close();
                      onDelete?.();
                    }}
                  >
                    Delete shelf
                  </Pressable>
                  <Pressable variant="ghost" onClick={() => setConfirming(false)}>
                    Cancel
                  </Pressable>
                </div>
              </div>
            ) : (
              <Pressable
                block
                variant="ghost"
                className="justify-start text-danger"
                onClick={() => setConfirming(true)}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Delete shelf
              </Pressable>
            )}
          </Sheet.Section>
        </>
      )}
    </Sheet>
  );
}
