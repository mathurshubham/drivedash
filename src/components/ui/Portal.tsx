'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** A store that never changes: `false` on the server, `true` once hydrated. */
const noopSubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `true` only after hydration. `useSyncExternalStore` rather than
 * `useState`+`useEffect` because React is then told explicitly that the server
 * and client snapshots differ, so the first client render matches the server
 * HTML and the switch happens in a committed pass — no hydration warning.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, getSnapshot, getServerSnapshot);
}

/**
 * Renders `children` into `document.body`, after mount.
 *
 * Every fixed overlay in the app goes through this. A `position: fixed` element
 * is only fixed to the viewport — and only free to sit at its own z-layer —
 * while no ancestor has a transform, filter, backdrop-filter, `will-change` or
 * a containing `contain`. The page-transition wrapper in `AppShell` animates
 * `transform`, and any of the page's own animated cards can do the same, so an
 * overlay rendered in place was a child of a stacking context that the bottom
 * nav (`fixed z-40`, a sibling of that wrapper) sat above regardless of its own
 * `z-50`. Portalling to `document.body` puts every overlay on the root stacking
 * context, where the z-ladder in `README.md` actually means something.
 *
 * SSR-safe: renders nothing on the server and on the hydrating pass.
 */
export default function Portal({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(children, document.body);
}
