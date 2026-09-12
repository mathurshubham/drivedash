'use client';

import { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import Pressable from '@/components/ui/Pressable';
import { getAdminUsers } from '@/lib/client';

export interface GreetingBarProps {
  /**
   * The signed-in user's name. Omitted (the normal case) means "resolve it
   * yourself": `getSession()` is a plain fetch of `/api/auth/session`, so no
   * `SessionProvider` is needed anywhere — see the note below.
   */
  name?: string;
  isAdmin?: boolean;
  /** e.g. "3/10". Rendered next to the avatar for admins only. */
  seatLabel?: string;
  /** Opens the Menu sheet, which `AppShell` (Agent E) owns. */
  onMenu: () => void;
}

/**
 * Dispatched when the Home nav item is tapped while already on `/`. Kept
 * exported for `AppShell`, which wires it to `BottomNav`'s `onReselect`; Home
 * v2 has no search input to focus, so the home page now scrolls to the top
 * instead.
 */
export const SEARCH_FOCUS_EVENT = 'dd:search:focus';

/**
 * Dispatched by the greeting bar's avatar. `AppShell` owns the Menu sheet and
 * listens for this globally rather than prop-drilling an opener down into the
 * page — the two live in different ownership halves of the tree.
 *
 *   window.addEventListener('dd:menu:open', () => setMenuOpen(true))
 */
export const MENU_OPEN_EVENT = 'dd:menu:open';

function greetingFor(hour: number): string {
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

function firstName(full: string | null | undefined): string | null {
  const first = full?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}

/**
 * Home v2's top bar (DESIGN_PLAN §7): a greeting, today's date, and the avatar
 * that opens the Menu. Search moved out to `/search`, so there is no input and
 * no chips row here any more.
 */
export default function GreetingBar({ name, isAdmin, seatLabel, onMenu }: GreetingBarProps) {
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [resolvedAdmin, setResolvedAdmin] = useState(false);
  const [seats, setSeats] = useState<string | null>(null);

  const selfResolve = name === undefined;

  useEffect(() => {
    if (!selfResolve) return;
    let active = true;
    getSession()
      .then((session) => {
        if (!active) return;
        setSessionName(firstName(session?.user?.name));
        if (session?.isAdmin !== true) return;
        setResolvedAdmin(true);
        return getAdminUsers().then((data) => {
          if (!active) return;
          const nonAdminCount = data.users.filter((u) => !data.admins.includes(u.email)).length;
          setSeats(`${nonAdminCount}/${data.maxUsers}`);
        });
      })
      .catch(() => {
        // Session or admin fetch failed; the bar degrades to "Hello".
      });
    return () => {
      active = false;
    };
  }, [selfResolve]);

  const who = firstName(name) ?? sessionName;
  const admin = isAdmin ?? resolvedAdmin;
  const seatText = seatLabel ?? seats;

  // Rendered client-side only, so "now" is the user's own clock. The first
  // paint is the same string for everyone at a given hour; no hydration risk
  // because the whole page is a client component.
  const now = new Date();
  const greeting = greetingFor(now.getHours());
  const initial = (who ?? '?').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-subtle bg-bg/80 backdrop-blur-md pt-safe">
      <div className="mx-auto flex w-full max-w-[960px] items-center gap-3 px-4 pb-3 pt-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {who ? `${greeting}, ${who}` : greeting}
          </h1>
          <p className="truncate text-xs text-muted">
            {now.toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>

        {admin && seatText ? (
          <span className="tabular shrink-0 rounded-full surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
            {seatText}
          </span>
        ) : null}

        <Pressable
          variant="ghost"
          aria-label="Open menu"
          onClick={onMenu}
          className="h-11 w-11 shrink-0 rounded-full surface-2 px-0 text-sm font-semibold"
        >
          {initial}
        </Pressable>
      </div>
    </header>
  );
}
