'use client';

import { Suspense, lazy } from 'react';
import type { SwipeableRowProps } from '@/components/ui/SwipeableRow';

/**
 * `SwipeableRow` carries the gesture runtime, which is dead weight until a
 * finger actually touches a row. `lazy` + a fallback that renders the row
 * plainly means the list is usable (and tappable) from the first frame and the
 * swipe layer arrives a moment later — the same deal reduced-motion users get.
 */
const Impl = lazy(() => import('@/components/ui/SwipeableRow'));

export default function SwipeRow(props: SwipeableRowProps) {
  return (
    <Suspense fallback={<div className={props.className}>{props.children}</div>}>
      <Impl {...props} />
    </Suspense>
  );
}
