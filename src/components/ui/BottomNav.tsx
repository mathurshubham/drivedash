'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { m, useReducedMotion } from 'motion/react';
import type { ComponentType } from 'react';
import { useSlidingIndicator } from '@/components/hooks/useSlidingIndicator';
import { useScrollDirection } from '@/components/hooks/useScrollDirection';

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
   * tapping Home while already on `/` re-focuses the search input via
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
 * Fixed bottom navigation: 56px plus safe area, blurred surface, a pill that
 * slides to the active tab, and hide-on-scroll-down / show-on-scroll-up.
 */
export default function BottomNav({ items, className = '', onReselect }: BottomNavProps) {
  const pathname = usePathname() ?? '/';
  const reduced = useReducedMotion();
  const direction = useScrollDirection();

  const active = items.find((i) => isNavActive(pathname, i.href))?.href ?? null;
  const { containerRef, register, rect } = useSlidingIndicator(active);

  if (HIDDEN.test(pathname)) return null;

  const hidden = direction === 'down';

  return (
    <m.nav
      aria-label="Primary"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-subtle bg-surface/80 backdrop-blur-md pb-safe ${className}`.trim()}
      animate={{ y: hidden ? 88 : 0 }}
      initial={false}
      transition={reduced ? { duration: 0 } : { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div
        ref={containerRef}
        className="relative mx-auto flex h-14 w-full max-w-[640px] items-stretch px-2"
      >
        {rect ? (
          <m.span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 rounded-sm bg-accent-600/10"
            initial={false}
            animate={{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
          />
        ) : null}

        {items.map((item) => {
          const isActive = item.href === active;
          const Icon = item.icon;
          const itemClassName = `relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-sm text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
            isActive ? 'text-accent' : 'text-muted'
          }`;
          const content = (
            <>
              <span className="relative">
                <Icon aria-hidden="true" className="h-5 w-5" />
                {item.badge ? (
                  <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-accent-600 px-1 text-center text-[9px] font-semibold tabular text-white">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
            </>
          );

          if (item.onClick) {
            return (
              <button
                key={item.href}
                type="button"
                ref={(el) => register(item.href, el)}
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
              ref={(el) => register(item.href, el)}
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
