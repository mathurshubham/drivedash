'use client';

import { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import { firstName, formatGreetingDate, greetingFor, greetingLine } from '@/components/greeting';
import Pressable from '@/components/ui/Pressable';
import { useMounted } from '@/components/ui/Portal';
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

  /**
   * Both the greeting word and the date read the *viewer's* clock, which the
   * server does not have: it renders in UTC, so "Evening" and even the calendar
   * day can disagree with the browser. Everything clock-derived is therefore
   * gated on `mounted` — the server and the hydrating pass render "Hello,
   * <name>" and an empty, fixed-height date line, and the real values commit a
   * frame later. The placeholder keeps the header the same height throughout,
   * so nothing below it shifts.
   */
  const mounted = useMounted();
  const now = mounted ? new Date() : null;
  const title = greetingLine(now ? greetingFor(now.getHours()) : null, who);
  const initial = (who ?? '?').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-subtle bg-bg/80 backdrop-blur-md pt-safe">
      <div className="mx-auto flex w-full max-w-[960px] items-center gap-2 px-4 pb-3 pt-3">
        <div className="min-w-0 flex-1">
          {/* Wraps rather than truncates: "Mornin…" at 360px was the first
              Chrome pass's worst line of copy. */}
          <h1 className="text-balance text-lg font-semibold leading-tight tracking-tight">
            {title}
          </h1>
          <p className="min-h-4 truncate text-xs leading-4 text-muted">
            {now ? formatGreetingDate(now) : ''}
          </p>
        </div>

        {/* Below 400px the seat badge is what pushes the greeting into a third
            line; admins still have the count in Menu → Users. */}
        {admin && seatText ? (
          <span className="tabular hidden shrink-0 rounded-full surface-2 px-2 py-0.5 text-xs font-semibold text-muted min-[400px]:inline-flex">
            {seatText}
          </span>
        ) : null}

        {/* 44px target, 36px visible disc (DESIGN_PLAN §4 keeps the target). */}
        <Pressable
          variant="ghost"
          aria-label="Open menu"
          onClick={onMenu}
          className="h-11 w-11 shrink-0 rounded-full px-0"
          contentClassName="flex h-9 w-9 items-center justify-center rounded-full surface-2 text-sm font-semibold"
        >
          {initial}
        </Pressable>
      </div>
    </header>
  );
}
