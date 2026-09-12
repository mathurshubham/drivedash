'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { m, useReducedMotion } from 'motion/react';
import type { ComponentType } from 'react';
import { useNavLocked, useNavVisibility } from '@/components/hooks/useScrollDirection';

export interface BottomNavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  /** Small count bubble, e.g. active shares. */
  badge?: number | string;
  /**
   * When set, tapping this item calls this instead of navigating — e.g. the
   * "Menu" item, which opens a `Sheet` rather than routing anywhere. Renders
   * as a `<button>` instead of a `Link`.
   */
  onClick?: () => void;
  /** `data-tour` passthrough for the Spotlight tour (e.g. `"nav-shares"`). */
  tourId?: string;
}

export interface BottomNavProps {
  items: BottomNavItem[];
  className?: string;
  /**
   * Called with `href` when an already-active nav item is tapped again — e.g.
   * tapping Search while already on `/search` re-focuses the input via
   * `dd:search:focus` (dispatched by the caller, not here, to keep this
   * primitive event-agnostic).
   */
  onReselect?: (href: string) => void;
}

/** Routes that are full-screen moments and must not show app chrome. */
const HIDDEN = /^\/(login|access-denied|about|privacy|terms)(\/|$)/;

/** True when `href` is the current section. */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Fixed bottom navigation: `--nav-h` tall plus safe area, blurred surface, and
 * hide-on-scroll-down.
 *
 * Hiding is deliberately hard to reach and easy to undo — see
 * `decideNavVisibility`. The first phone pass could hide the nav on a page
 * with 100px of overflow and leave the user with no gesture to bring it back.
 *
 * The active state is a per-item background that fades in with a CSS
 * transition, not a shared sliding pill. The pill was measured from the DOM
 * after `usePathname` changed, which on a real navigation meant it spent the
 * whole transition parked under the *previous* item; a static state cannot
 * disagree with the route.
 */
export default function BottomNav({ items, className = '', onReselect }: BottomNavProps) {
  const pathname = usePathname() ?? '/';
  const reduced = useReducedMotion();
  const locked = useNavLocked();
  const hidden = useNavVisibility({ locked, resetKey: pathname });

  const active = items.find((i) => isNavActive(pathname, i.href))?.href ?? null;

  if (HIDDEN.test(pathname)) return null;

  return (
    <m.nav
      aria-label="Primary"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-subtle bg-surface/80 backdrop-blur-md pb-safe ${className}`.trim()}
      animate={{ y: hidden ? 88 : 0 }}
      initial={false}
      transition={reduced ? { duration: 0 } : { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="relative mx-auto flex h-[var(--nav-h)] w-full max-w-[640px] items-stretch px-2">
        {items.map((item) => {
          const isActive = item.href === active;
          const Icon = item.icon;
          const itemClassName = [
            'group relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-sm',
            'text-[11px] font-medium outline-none transition-colors duration-150',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
            isActive ? 'text-accent' : 'text-muted hover:text-fg',
          ].join(' ');
          const content = (
            <>
              {/*
                Per-item pill. Opacity-only transition so there is nothing to
                measure and nothing to mis-position; flattened by the global
                reduced-motion rule.
              */}
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-x-1 inset-y-1 rounded-sm bg-accent-600/10 transition-opacity duration-150 motion-reduce:transition-none ${
                  isActive ? 'opacity-100' : 'opacity-0'
                }`}
              />
              <span className="relative">
                <Icon aria-hidden="true" className="h-5 w-5" />
                {item.badge ? (
                  <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-accent-600 px-1 text-center text-[9px] font-semibold tabular text-white">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span className="relative">{item.label}</span>
            </>
          );

          if (item.onClick) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={item.onClick}
                data-tour={item.tourId}
                className={itemClassName}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              data-tour={item.tourId}
              onClick={() => {
                if (isActive) onReselect?.(item.href);
              }}
              className={itemClassName}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </m.nav>
  );
}
