'use client';

import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
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
 * How long past its nominal duration a toast may survive a *paused* sonner
 * timer before we dismiss it ourselves. See `showToast` for why that is needed.
 */
const HARD_DISMISS_GRACE = 4000;
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

/** Errors are worth reading; everything else is an acknowledgement. */
export function toastDuration(kind: ToastKind): number {
  return kind === 'error' ? ERROR_DURATION : DURATION;
}

/**
 * Fires a toast. Exported (and pure enough to unit-test) so the durations below
 * are covered by a test rather than by hoping.
 *
 * Every call passes `duration` explicitly instead of leaning on the `<Toaster>`
 * default: sonner resolves `toast.duration || durationFromToaster || 4000`, and
 * a toast that was raised before the Toaster mounted, or from a second Toaster
 * that never got our props, silently fell back to sonner's own 4s. Never
 * `Infinity` — sonner skips the timer entirely for that value.
 *
 * The `setTimeout` is a backstop, not the mechanism. sonner 2.x pauses a
 * toast's timer whenever the toaster is hovered *or* `document.hidden` is true,
 * and (unlike sonner 1.x) exposes no `pauseWhenPageIsHidden` prop to turn the
 * latter off — so a tab that is driven while not frontmost, or a pointer parked
 * over the bottom-centre of the screen, left the toast up forever. That is the
 * defect the second Chrome pass hit. Toasts here cover the bottom nav, so they
 * get a hard ceiling regardless of what the paused timer thinks.
 */
export function showToast(message: string, kind: ToastKind = 'default'): void {
  const duration = toastDuration(kind);

  const id =
    kind === 'error'
      ? sonner.error(message, { duration })
      : kind === 'success'
        ? sonner.success(message, { duration, icon: <DrawnCheck /> })
        : sonner(message, { duration });

  setTimeout(() => sonner.dismiss(id), duration + HARD_DISMISS_GRACE);
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
      showToast(message, kind);
    },
    [mounted],
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const alreadyMounted = useContext(MountedContext);

  // Two toasters means two independent timers, two stacks and one of them
  // without our `duration`/offset props. The context above already prevents a
  // nested provider from mounting a second one; this catches the case it can't
  // see — a `<Toaster>` dropped in by hand somewhere outside this tree.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const count = document.querySelectorAll('[data-sonner-toaster]').length;
    if (count > 1) {
      console.warn(`${count} <Toaster>s are mounted; there must be exactly one.`);
    }
  });

  return (
    <MountedContext.Provider value>
      {children}
      {alreadyMounted ? null : (
        <Toaster
          position="bottom-center"
          // Clears the bottom nav, whatever `--nav-h` is set to.
          offset="calc(var(--nav-h) + env(safe-area-inset-bottom) + 12px)"
          mobileOffset="calc(var(--nav-h) + env(safe-area-inset-bottom) + 12px)"
          // A fallback only: `showToast` sets `duration` per toast. sonner 2.x
          // has no `pauseWhenPageIsHidden` prop (it pauses on `document.hidden`
          // unconditionally), which is why `showToast` keeps its own ceiling.
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
