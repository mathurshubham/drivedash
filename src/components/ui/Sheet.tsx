'use client';

import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';
import { useNavLock } from '@/components/hooks/useScrollDirection';
import type { SheetPanelProps } from '@/components/ui/SheetImpl';

export type SheetProps = SheetPanelProps;

/**
 * vaul (and the Radix dialog it pulls in) is ~35 KB gzipped and nothing is
 * visible until a sheet opens, so the panel is code-split. Loading is client
 * only — there is no sheet to server-render.
 */
const SheetPanel = dynamic(() => import('@/components/ui/SheetImpl'), { ssr: false });

/**
 * The app's one bottom sheet: vaul drawer, drag handle, blurred scrim,
 * safe-area padding and `--radius-lg` top corners. Focus trap, scroll lock and
 * drag-to-dismiss come from vaul.
 */
export default function Sheet(props: SheetProps) {
  // Mount on first open and stay mounted, so vaul still gets to play its close
  // animation; before that, this component costs nothing. Adjusting state
  // during render is React's documented pattern for "derive from a prop".
  const [everOpened, setEverOpened] = useState(props.open);
  // An open sheet pins the bottom nav visible: the page behind is scroll-locked
  // anyway, and a nav that slid away under the scrim never comes back.
  useNavLock(props.open);
  if (props.open && !everOpened) setEverOpened(true);

  if (!everOpened) return null;
  return <SheetPanel {...props} />;
}

export interface SheetSectionProps {
  title?: string;
  className?: string;
  children: ReactNode;
}

/** A labelled block inside a sheet. */
export function SheetSection({ title, className = '', children }: SheetSectionProps) {
  return (
    <section className={`py-2 ${className}`.trim()}>
      {title ? (
        <h3 className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

Sheet.Section = SheetSection;

export interface SheetTransitionProps {
  /** Changing this key slides the old content out and the new content in. */
  viewKey: string;
  /** `forward` slides in from the right, `back` from the left. */
  direction?: 'forward' | 'back';
  children: ReactNode;
}

/**
 * Swaps a sheet's sub-form: 16px slide plus fade, 200ms. Flattened to a plain
 * swap under `prefers-reduced-motion`.
 */
export function SheetTransition({ viewKey, direction = 'forward', children }: SheetTransitionProps) {
  const reduced = useReducedMotion();
  const offset = direction === 'back' ? -16 : 16;

  if (reduced) return <div key={viewKey}>{children}</div>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={viewKey}
        initial={{ opacity: 0, x: offset }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -offset }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}

/**
 * Minimal sub-view stack for sheets with nested forms: `push` remembers where
 * it came from so `back` can both restore the view and reverse the slide.
 */
export function useSheetStack<V extends string>(root: V) {
  const [stack, setStack] = useState<V[]>([root]);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const push = (view: V) => {
    setDirection('forward');
    setStack((s) => [...s, view]);
  };
  const back = () => {
    setDirection('back');
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  };
  const reset = () => {
    setDirection('back');
    setStack([root]);
  };
  /**
   * Go forward to `view` but drop whatever was in between, so `back` lands on
   * the root. For outcome screens: returning to the form that produced them
   * would only invite submitting it twice.
   */
  const swap = (view: V) => {
    setDirection('forward');
    setStack([root, view]);
  };

  return { view: stack[stack.length - 1], depth: stack.length, direction, push, back, reset, swap };
}
