'use client';

import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { dismissHint, isHintDismissed, subscribeHints } from '@/components/ui/hintStorage';

export interface HintBadgeProps {
  /** Id under `dd.hint.<id>` in localStorage. Shown once per browser. */
  storageKey: string;
  /** Short nudge, e.g. "Swipe → to pin". */
  label: string;
  /** Corner of the wrapper the badge hangs off. */
  side?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
  /** The element being pointed at. */
  children: ReactNode;
}

const SIDE: Record<NonNullable<HintBadgeProps['side']>, string> = {
  'top-right': 'right-2 top-0 -translate-y-1/2',
  'top-left': 'left-2 top-0 -translate-y-1/2',
  'bottom-right': 'right-2 bottom-0 translate-y-1/2',
  'bottom-left': 'left-2 bottom-0 translate-y-1/2',
};

/**
 * A one-time pulsing dot + label anchored to whatever it wraps. Any pointer
 * interaction inside the wrapper counts as "seen" and retires it for good.
 *
 * SSR-safe: the server snapshot is always "dismissed", so the badge appears
 * only after hydration and never mismatches.
 */
export default function HintBadge({
  storageKey,
  label,
  side = 'top-right',
  className = '',
  children,
}: HintBadgeProps) {
  const visible = useSyncExternalStore(
    subscribeHints,
    () => !isHintDismissed(storageKey),
    () => false,
  );

  const dismiss = useCallback(() => {
    dismissHint(storageKey);
  }, [storageKey]);

  if (!visible) return <div className={className || undefined}>{children}</div>;

  return (
    <div className={`relative ${className}`.trim()} onPointerDown={dismiss}>
      {children}
      <button
        type="button"
        onClick={dismiss}
        aria-label={`${label}. Dismiss hint.`}
        className={`absolute z-10 flex items-center gap-1.5 rounded-full bg-accent-600 py-1 pl-2 pr-2.5 text-[11px] font-semibold text-white shadow-pop ${SIDE[side]}`}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
        {label}
      </button>
    </div>
  );
}
