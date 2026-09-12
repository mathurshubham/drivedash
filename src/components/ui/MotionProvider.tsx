'use client';

import { LazyMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * The `domAnimation` feature bundle is fetched after hydration rather than
 * bundled into the first load. Measured on this app: eager `domAnimation` puts
 * 32 KB gzipped into `/`'s first load, the async form 21 KB. Until it arrives,
 * `m.*` elements render as plain DOM at their target values.
 */
const loadFeatures = () => import('motion/react').then((mod) => mod.domAnimation);

/**
 * Mounted once, in `(app)/layout.tsx`. `strict` makes importing the full
 * `motion.*` components a runtime error, which is the guard that keeps the
 * animation bundle at `domAnimation` size — always use `m.*` instead.
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}
