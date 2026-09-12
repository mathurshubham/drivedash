'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { sheetSnapPoints } from '@/components/ui/sheetSnap';

export interface SheetPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendered as the sheet heading; also the accessible name. */
  title?: string;
  /**
   * Rest positions. Numbers are fractions of the viewport; strings are
   * pixels — vaul runs `parseInt` over them, so only plain `"560px"` forms
   * work, never a `calc()` or `min()`. Omit to get the content-sized default
   * from `sheetSnapPoints`.
   */
  snapPoints?: (number | string)[];
  /** Extra classes on the sheet panel. */
  className?: string;
  children: ReactNode;
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
  // `SheetImpl` is `ssr: false`, so `window` is always there on first render;
  // the fallback only covers a non-browser test renderer.
  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined' ? 844 : window.innerHeight,
  );

  useEffect(() => {
    const onResize = () => setViewport(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const points = snapPoints ?? sheetSnapPoints(viewport);
  const [snap, setSnap] = useState<number | string | null>(points[0] ?? null);

  // Reopening always starts at the smaller rest position. Done as a
  // render-phase adjustment rather than an effect so the first painted frame
  // is already at the right snap point.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSnap(points[0] ?? null);
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={points}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content
          className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex h-full max-h-[92dvh] w-full max-w-[640px] flex-col rounded-t-lg border border-subtle surface shadow-sheet outline-none ${className}`.trim()}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted/40" aria-hidden="true" />
          {title ? (
            <Drawer.Title className="px-4 pb-2 pt-3 text-lg font-semibold">{title}</Drawer.Title>
          ) : (
            <Drawer.Title className="sr-only">Actions</Drawer.Title>
          )}
          <div className="min-h-0 max-h-[92dvh] flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
