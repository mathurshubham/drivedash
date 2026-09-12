'use client';

import type { ReactNode } from 'react';

export type SkeletonVariant = 'row' | 'card' | 'chip' | 'text';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  /** `text` only: relative width, e.g. `"60%"`. */
  width?: string;
}

/**
 * CSS-only placeholder. The sweep lives in the `.skeleton` class in
 * globals.css, which is already flattened under `prefers-reduced-motion`.
 */
export default function Skeleton({ variant = 'text', className = '', width }: SkeletonProps) {
  if (variant === 'row') {
    return (
      <div
        className={`flex min-h-14 items-center gap-3 px-3 py-2 ${className}`.trim()}
        aria-hidden="true"
      >
        <div className="skeleton h-9 w-9 shrink-0 rounded-sm" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="skeleton h-3.5 w-3/5 rounded-full" />
          <div className="skeleton h-3 w-2/5 rounded-full" />
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={`h-[132px] w-[132px] shrink-0 rounded-md border border-subtle p-3 ${className}`.trim()}
        aria-hidden="true"
      >
        <div className="skeleton h-10 w-10 rounded-sm" />
        <div className="skeleton mt-4 h-3.5 w-full rounded-full" />
        <div className="skeleton mt-2 h-3 w-2/3 rounded-full" />
      </div>
    );
  }

  if (variant === 'chip') {
    return <div aria-hidden="true" className={`skeleton h-9 w-20 rounded-full ${className}`.trim()} />;
  }

  return (
    <div
      aria-hidden="true"
      className={`skeleton h-3.5 rounded-full ${className}`.trim()}
      style={{ width: width ?? '100%' }}
    />
  );
}

export interface SkeletonListProps {
  /** How many placeholders to draw. */
  count?: number;
  variant?: SkeletonVariant;
  /** Announced to screen readers while the real content loads. */
  label?: string;
  className?: string;
  /** Rendered instead of placeholders once `loading` is false. */
  loading?: boolean;
  children?: ReactNode;
}

/** Marks a region busy while it shows `count` placeholders. */
export function SkeletonList({
  count = 3,
  variant = 'row',
  label = 'Loading',
  className = '',
  loading = true,
  children,
}: SkeletonListProps) {
  if (!loading) return <>{children}</>;
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant={variant} />
      ))}
    </div>
  );
}
