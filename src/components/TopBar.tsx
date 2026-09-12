'use client';

import { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import { firstName, formatGreetingDate, greetingFor, greetingLine } from '@/components/greeting';
import { useScrolledPast } from '@/components/hooks/useScrollDirection';
import Pressable from '@/components/ui/Pressable';
import { useMounted } from '@/components/ui/Portal';

/** Scroll offset past which the bar collapses to 44px. */
export const GREETING_COMPACT_AT = 32;

export interface GreetingBarProps {
  /**
   * The signed-in user's name. Omitted (the normal case) means "resolve it
   * yourself": `getSession()` is a plain fetch of `/api/auth/session`, so no
   * `SessionProvider` is needed anywhere — see the note below.
   */
  name?: string;
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
 *
 * One row, 56px, collapsing to 44px on scroll. The first phone pass measured
 * ~150px of sticky header before a single file was visible; the admin seat
 * badge and its `/api/admin/users` fetch went with it — the seat count is
 * actionable on `/admin/users`, where the meter already lives, and nowhere
 * else.
 */
export default function GreetingBar({ name, onMenu }: GreetingBarProps) {
  const [sessionName, setSessionName] = useState<string | null>(null);

  const selfResolve = name === undefined;

  useEffect(() => {
    if (!selfResolve) return;
    let active = true;
    getSession()
      .then((session) => {
        if (!active) return;
        setSessionName(firstName(session?.user?.name));
      })
      .catch(() => {
        // Session fetch failed; the bar degrades to "Hello".
      });
    return () => {
      active = false;
    };
  }, [selfResolve]);

  const who = firstName(name) ?? sessionName;

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

  /**
   * Past 32px the bar collapses from 56px to 44px and drops the date. The
   * threshold comes off the same shared scroll sampler the bottom nav reads,
   * so the two chrome elements can never disagree about where the page is.
   */
  const compact = useScrolledPast(GREETING_COMPACT_AT);

  return (
    <header
      data-compact={compact ? 'true' : 'false'}
      className="group/greet sticky top-0 z-30 border-b border-subtle bg-bg/80 backdrop-blur-md pt-safe"
    >
      {/*
        `height` is the one non-composited property here, and deliberately so:
        a sticky bar cannot shrink by `transform` without either leaving a strip
        of page showing at the top of the viewport or clipping its own first
        line. Everything inside it moves on transform/opacity only, and the
        global reduced-motion rule flattens all of it.
      */}
      <div className="mx-auto flex h-14 w-full max-w-[960px] items-center gap-2 px-4 transition-[height] duration-200 ease-out motion-reduce:transition-none group-data-[compact=true]/greet:h-11">
        <div className="relative min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight tracking-tight">
            {title}
          </h1>
          {/*
            Absolutely positioned so the row's flow height is the greeting
            alone — the date can fade out without the greeting jumping. Hidden
            below 480px, where 412px-class phones need the whole 56px for the
            name.
          */}
          <p className="absolute left-0 top-full mt-0.5 hidden max-w-full truncate text-[12px] leading-4 text-muted transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none group-data-[compact=true]/greet:-translate-y-1 group-data-[compact=true]/greet:opacity-0 min-[480px]:block">
            {now ? formatGreetingDate(now) : ''}
          </p>
        </div>

        {/* 44px target, 32px visible disc (DESIGN_PLAN §4 keeps the target).
            The admin seat badge used to live here; it is on /admin/users now,
            where the number is actionable. */}
        <Pressable
          variant="ghost"
          aria-label="Open menu"
          onClick={onMenu}
          className="h-11 w-11 shrink-0 rounded-full px-0"
          contentClassName="flex h-8 w-8 items-center justify-center rounded-full surface-2 text-sm font-semibold"
        >
          {initial}
        </Pressable>
      </div>
    </header>
  );
}
