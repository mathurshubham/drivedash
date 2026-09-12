'use client';

import type { ComponentType, ReactNode } from 'react';
import Pressable from '@/components/ui/Pressable';

export interface EmptyStateProps {
  /** A lucide icon component, e.g. `Pin`. */
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  title: string;
  /** One sentence explaining what to do next. */
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  /** Rendered under the action, e.g. a "Show me around" link. */
  footer?: ReactNode;
  className?: string;
}

/** Teach-first placeholder for an empty list. */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  footer,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center px-6 py-10 text-center ${className}`.trim()}>
      {Icon ? (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-md surface-2 text-muted">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
      ) : null}
      <p className="text-base font-semibold">{title}</p>
      {description ? <p className="mt-1 max-w-[32ch] text-sm text-muted">{description}</p> : null}
      {action ? (
        <Pressable variant="primary" size="md" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Pressable>
      ) : null}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}
