'use client';

import { m, useReducedMotion } from 'motion/react';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useSlidingIndicator } from '@/components/hooks/useSlidingIndicator';

interface ChipGroupCtx {
  activeKey: string | null;
  register: (key: string, el: HTMLElement | null) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  order: React.MutableRefObject<string[]>;
}

const Ctx = createContext<ChipGroupCtx | null>(null);

export interface ChipProps {
  /** Identity within a `ChipGroup`; also what `ChipGroup.value` is compared to. */
  value?: string;
  /** Ignored inside a group (the group decides); use it for standalone chips. */
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Selectable pill, 36px minimum height. Inside a `ChipGroup` the selection
 * indicator is owned by the group and slides between chips.
 */
export function Chip({
  value,
  selected,
  onSelect,
  disabled = false,
  className = '',
  children,
}: ChipProps) {
  const group = useContext(Ctx);
  const key = value ?? '';
  const isSelected = group ? group.activeKey === key : Boolean(selected);

  // Registration order is the arrow-key order.
  if (group && key && !group.order.current.includes(key)) group.order.current.push(key);

  return (
    <button
      type="button"
      role={group ? 'radio' : undefined}
      aria-checked={group ? isSelected : undefined}
      aria-pressed={group ? undefined : isSelected}
      data-chip-value={key || undefined}
      disabled={disabled}
      // Roving tabindex: only the selected chip is in the tab order.
      tabIndex={group ? (isSelected ? 0 : -1) : undefined}
      ref={group ? (el) => group.register(key, el) : undefined}
      onKeyDown={group ? group.onKeyDown : undefined}
      onClick={onSelect}
      className={`relative z-0 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 ${
        isSelected ? 'text-white' : 'surface-2 text-muted hover:text-fg'
      } ${className}`.trim()}
    >
      {/* Standalone chips paint their own fill; grouped ones get the slider. */}
      {!group && isSelected ? (
        <span aria-hidden="true" className="absolute inset-0 -z-10 rounded-full bg-accent-600" />
      ) : null}
      {children}
    </button>
  );
}

export interface ChipGroupProps {
  /** Accessible name for the radiogroup. */
  label: string;
  /** `value` of the selected `Chip`. */
  value: string | null;
  className?: string;
  /** `Chip` children, each with a `value`. */
  children: ReactNode;
  /** Called with the next chip value when arrow keys move the selection. */
  onValueChange?: (next: string) => void;
}

export function ChipGroup({
  label,
  value,
  className = '',
  children,
  onValueChange,
}: ChipGroupProps) {
  const reduced = useReducedMotion();
  const order = useRef<string[]>([]);
  const { containerRef, register, rect } = useSlidingIndicator(value);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
      if (!keys.includes(e.key)) return;
      const list = order.current;
      if (list.length === 0) return;

      const current = Math.max(0, list.indexOf(value ?? ''));
      let next = current;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % list.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + list.length) % list.length;
      else if (e.key === 'Home') next = 0;
      else next = list.length - 1;

      e.preventDefault();
      const key = list[next];
      onValueChange?.(key);
      // Radiogroup convention: focus follows selection.
      containerRef.current
        ?.querySelector<HTMLButtonElement>(`[data-chip-value="${CSS.escape(key)}"]`)
        ?.focus();
    },
    [containerRef, onValueChange, value],
  );

  return (
    <Ctx.Provider value={{ activeKey: value, register, onKeyDown, order }}>
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label={label}
        className={`relative flex gap-2 ${className}`.trim()}
      >
        {rect ? (
          <m.span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 -z-10 rounded-full bg-accent-600"
            initial={false}
            animate={{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }}
            transition={
              reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }
            }
          />
        ) : null}
        {children}
      </div>
    </Ctx.Provider>
  );
}

export default Chip;
