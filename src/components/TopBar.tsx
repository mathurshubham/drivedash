'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { LogOut, MoreVertical, Search, Users, X } from 'lucide-react';
import TypeChips from '@/components/TypeChips';
import { getAdminUsers } from '@/lib/client';
import type { SearchType } from '@/lib/types';

export interface TopBarProps {
  query: string;
  onQueryChange: (next: string) => void;
  type: SearchType;
  onTypeChange: (next: SearchType) => void;
}

export default function TopBar({ query, onQueryChange, type, onTypeChange }: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    getAdminUsers()
      .then((data) => {
        if (!active) return;
        setIsAdmin(true);
        setPendingCount(data.requests.filter((r) => r.status === 'pending').length);
      })
      .catch(() => {
        // Non-admins get 403; ignore silently.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-neutral-50/90 backdrop-blur-md pt-safe dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto w-full max-w-[640px] px-4 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">DriveDash</h1>
          <div className="relative ml-auto" ref={menuRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More options"
              onClick={() => setMenuOpen((v) => !v)}
              className="relative flex h-11 w-11 items-center justify-center rounded-lg hover:bg-neutral-200/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:hover:bg-neutral-800 dark:focus-visible:outline-accent-400"
            >
              <MoreVertical aria-hidden="true" className="h-5 w-5" />
              {isAdmin && pendingCount > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-semibold text-white">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              ) : null}
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-12 z-40 w-48 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
              >
                {isAdmin ? (
                  <Link
                    href="/admin/users"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-left text-[15px] hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:hover:bg-neutral-800"
                  >
                    <Users aria-hidden="true" className="h-4 w-4 text-neutral-500" />
                    <span className="flex-1">Users</span>
                    {pendingCount > 0 ? (
                      <span className="rounded-full bg-accent-600 px-1.5 text-[11px] font-semibold text-white">
                        {pendingCount}
                      </span>
                    ) : null}
                  </Link>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void signOut({ redirectTo: '/login' });
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-left text-[15px] hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:hover:bg-neutral-800"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4 text-neutral-500" />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative mt-2">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search your Drive"
            aria-label="Search your Drive"
            className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-white pl-9 pr-10 text-[15px] outline-none focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:border-neutral-700 dark:bg-neutral-900"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onQueryChange('')}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:hover:bg-neutral-800"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-2">
          <TypeChips value={type} onChange={onTypeChange} />
        </div>
      </div>
    </header>
  );
}
