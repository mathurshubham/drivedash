'use client';

import { useEffect, useRef, useState } from 'react';
import { getSession } from 'next-auth/react';
import { Search, X } from 'lucide-react';
import TypeChips from '@/components/TypeChips';
import Pressable from '@/components/ui/Pressable';
import { getAdminUsers } from '@/lib/client';
import type { SearchType } from '@/lib/types';

export interface TopBarProps {
  query: string;
  onQueryChange: (next: string) => void;
  type: SearchType;
  onTypeChange: (next: SearchType) => void;
}

/**
 * Dispatched (by `AppShell`, via `BottomNav`'s `onReselect`) when the Home nav
 * item is tapped while already on `/`. `TopBar` listens globally and focuses
 * its search input — the nav's "Search" affordance from DESIGN_PLAN §0.
 */
export const SEARCH_FOCUS_EVENT = 'dd:search:focus';

/**
 * Compact sticky header: wordmark + admin seat badge, a full-width search
 * input, then the type chips row. The overflow menu that used to live here
 * moved to `BottomNav`'s Menu sheet.
 */
export default function TopBar({ query, onQueryChange, type, onTypeChange }: TopBarProps) {
  const [seatCount, setSeatCount] = useState<{ used: number; max: number } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    getSession()
      .then((session) => {
        if (!active || session?.isAdmin !== true) return;
        setIsAdmin(true);
        return getAdminUsers().then((data) => {
          if (!active) return;
          const nonAdminCount = data.users.filter((u) => !data.admins.includes(u.email)).length;
          setSeatCount({ used: nonAdminCount, max: data.maxUsers });
        });
      })
      .catch(() => {
        // Session or admin fetch failed; hide the badge.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onFocusRequest = () => inputRef.current?.focus();
    window.addEventListener(SEARCH_FOCUS_EVENT, onFocusRequest);
    return () => window.removeEventListener(SEARCH_FOCUS_EVENT, onFocusRequest);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-subtle bg-bg/80 backdrop-blur-md pt-safe">
      <div className="mx-auto w-full max-w-[640px] px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold tracking-tight">DriveDash</h1>
          {isAdmin && seatCount ? (
            <span className="tabular rounded-full surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
              {seatCount.used}/{seatCount.max}
            </span>
          ) : null}
        </div>

        <div className="relative mt-2" data-tour="search">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            inputMode="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search your Drive"
            aria-label="Search your Drive"
            className="min-h-[52px] w-full rounded-md surface-2 pl-10 pr-11 text-[15px] text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
          />
          {query ? (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <Pressable
                variant="ghost"
                size="md"
                aria-label="Clear search"
                onClick={() => onQueryChange('')}
                className="px-0! min-h-10! w-10!"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Pressable>
            </span>
          ) : null}
        </div>

        <div className="mt-2">
          <TypeChips value={type} onChange={onTypeChange} />
        </div>
      </div>
    </header>
  );
}
