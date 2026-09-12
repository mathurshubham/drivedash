'use client';

import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { sheetSnapPoints } from '@/components/ui/sheetSnap';

export interface SheetPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendered as the sheet heading; also the accessible name. */
  title?: string;
  /**
   * Rest positions, as fractions of `window.innerHeight` — see `sheetSnap.ts`
   * for why px strings are not used. Must be ascending and end at the tallest
   * position. Omit to get the content-sized default from `sheetSnapPoints`.
   */
  snapPoints?: number[];
  /** Extra classes on the sheet panel. */
  className?: string;
  children: ReactNode;
}

function subscribeToViewport(onStoreChange: () => void) {
  window.addEventListener('resize', onStoreChange);
  window.addEventListener('orientationchange', onStoreChange);
  return () => {
    window.removeEventListener('resize', onStoreChange);
    window.removeEventListener('orientationchange', onStoreChange);
  };
}

/**
 * `window.innerHeight`, read on the client only. The server snapshot is 0,
 * which `sheetSnapPoints` answers with the single 92% point — so a renderer
 * without a window never produces snap points measured against a guessed
 * viewport, which is how the sheet used to come up at a fraction computed for
 * the wrong screen.
 */
function useViewportHeight() {
  return useSyncExternalStore(
    subscribeToViewport,
    () => window.innerHeight,
    () => 0,
  );
}

/**
 * vaul implementation, loaded on demand by `Sheet.tsx` so the drawer (and its
 * Radix dialog dependency) stays out of every page's first load.
 *
 * The app's one bottom sheet: vaul drawer, drag handle, blurred scrim,
 * safe-area padding and `--radius-lg` top corners. Focus trap, scroll lock and
 * drag-to-dismiss come from vaul.
 */
export default function SheetImpl({
  open,
  onOpenChange,
  title,
  snapPoints,
  className = '',
  children,
}: SheetPanelProps) {
  const viewport = useViewportHeight();
  const points = useMemo(() => snapPoints ?? sheetSnapPoints(viewport), [snapPoints, viewport]);
  const [snap, setSnap] = useState<number | null>(() => points[0] ?? null);

  // vaul types the setter as `(number | string | null) => void` because it
  // accepts px strings too, but it only ever hands back a member of the array
  // we gave it — and ours are all fractions. Anything else means the lookup
  // missed, and the first rest position is the right place to land.
  const onSnapChange = (value: number | string | null) =>
    setSnap(typeof value === 'number' ? value : (points[0] ?? null));

  // Reopening always starts at the smaller rest position, and `snap` must stay
  // a member of `points`: vaul looks the active point up by identity
  // (`snapPoints.findIndex(p => p === activeSnapPoint)`) and, on -1, stops
  // positioning the drawer at all. A rotation or a resize recomputes `points`,
  // so a value captured before it would go stale. Done as render-phase
  // adjustments rather than effects so the first painted frame is already at
  // the right snap point.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSnap(points[0] ?? null);
  } else if (snap !== null && !points.includes(snap)) {
    setSnap(points[0] ?? null);
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={points}
      activeSnapPoint={snap}
      setActiveSnapPoint={onSnapChange}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        {/*
          `h-full` with no `max-h`: vaul converts a snap point into a
          `translateY` offset of `window.innerHeight - snapHeight` and never
          measures this element, so the panel has to be exactly the viewport
          tall for "snap at 560px" to mean "560px of sheet visible". The old
          `max-h-[92dvh]` made the panel 645px on a 701px window, so the 141px
          offset left 504px showing instead of 560 and the list was cut off.
          The top of the sheet is still capped at 92% — by the last snap point,
          which is the only thing the user can drag to.
        */}
        <Drawer.Content
          className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex h-full w-full max-w-[640px] flex-col rounded-t-lg border border-subtle surface shadow-sheet outline-none ${className}`.trim()}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted/40" aria-hidden="true" />
          {title ? (
            <Drawer.Title className="px-4 pb-2 pt-3 text-lg font-semibold">{title}</Drawer.Title>
          ) : (
            <Drawer.Title className="sr-only">Actions</Drawer.Title>
          )}
          <div className="min-h-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
