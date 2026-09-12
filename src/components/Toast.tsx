'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { Toaster, toast as sonner } from 'sonner';

/**
 * `'default'` is the legacy name for `'info'`; both are kept so existing call
 * sites (`toast(msg)` / `toast(msg, 'error')`) keep working unchanged.
 */
export type ToastKind = 'success' | 'error' | 'info' | 'default';
export type ToastTone = ToastKind;

type ShowToast = (message: string, kind?: ToastKind) => void;

/**
 * Toasts sit right on top of the bottom nav, so they must not linger: without
 * an explicit duration sonner's default (4s) plus a growing stack left the nav
 * unreachable. Errors get longer because they are worth reading.
 */
const DURATION = 2500;
const ERROR_DURATION = 4000;
/**
 * Above the sheet (50), below nothing. See the z-layer table in
 * `src/components/ui/README.md`.
 */
const TOAST_Z = 60;

/** Present only so a nested `ToastProvider` does not mount a second `Toaster`. */
const MountedContext = createContext(false);

/**
 * A check that draws itself in, 300ms.
 *
 * Deliberately CSS rather than `m.path` + `pathLength`: toasts fire on pages
 * that may not have the motion runtime on screen yet, and pulling motion into
 * the toast path cost ~25 KB gzipped of first load for one 300ms flourish.
 * `.draw-check` in globals.css animates `stroke-dashoffset` to the same effect
 * and is flattened under `prefers-reduced-motion` with everything else.
 */
function DrawnCheck() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
      <path
        className="draw-check"
        d="M4.5 10.5 8.5 14.5 15.5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function useToast(): ShowToast {
  // The provider no longer holds state, so a missing provider is not fatal —
  // but without it there is no `Toaster` to render into, so warn loudly in dev.
  const mounted = useContext(MountedContext);

  return useCallback<ShowToast>(
    (message, kind = 'default') => {
      if (process.env.NODE_ENV !== 'production' && !mounted) {
        console.warn('useToast() used outside <ToastProvider>; the toast will not be visible.');
      }
      if (kind === 'error') {
        sonner.error(message, { duration: ERROR_DURATION });
        return;
      }
      if (kind === 'success') {
        sonner.success(message, { icon: <DrawnCheck /> });
        return;
      }
      sonner(message);
    },
    [mounted],
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const alreadyMounted = useContext(MountedContext);

  return (
    <MountedContext.Provider value>
      {children}
      {alreadyMounted ? null : (
        <Toaster
          position="bottom-center"
          // Clears the bottom nav, whatever `--nav-h` is set to.
          offset="calc(var(--nav-h) + env(safe-area-inset-bottom) + 12px)"
          mobileOffset="calc(var(--nav-h) + env(safe-area-inset-bottom) + 12px)"
          duration={DURATION}
          visibleToasts={2}
          richColors={false}
          gap={8}
          style={{ zIndex: TOAST_Z }}
          // The region spans the width of the screen; only the toasts
          // themselves may take pointer events, or the nav underneath is dead
          // wherever the region overlaps it.
          className="pointer-events-none"
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                'pointer-events-auto flex w-full items-center gap-2 rounded-md border border-subtle surface px-4 py-3 text-sm font-medium text-fg shadow-pop',
              description: 'text-muted',
              success: 'text-success',
              error: 'text-danger',
              actionButton: 'text-accent font-semibold',
              cancelButton: 'text-muted font-semibold',
            },
          }}
        />
      )}
    </MountedContext.Provider>
  );
}

/** Escape hatch for call sites that want sonner's richer options directly. */
export { sonner as toast };
