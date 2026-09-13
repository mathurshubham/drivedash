'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  ClipboardList,
  Compass,
  Download,
  FileText,
  Home as HomeIcon,
  LogOut,
  Menu as MenuIcon,
  Search as SearchIcon,
  ShieldCheck,
  Users,
} from 'lucide-react';
import MotionProvider from '@/components/ui/MotionProvider';
import BottomNav, { type BottomNavItem } from '@/components/ui/BottomNav';
import Sheet from '@/components/ui/Sheet';
import Pressable from '@/components/ui/Pressable';
import { ToastProvider, useToast } from '@/components/Toast';
import InstallHint, {
  isIOSUserAgent,
  isStandaloneDisplay,
  triggerInstallPrompt,
  useInstallEventCaptured,
} from '@/components/pwa/InstallHint';
import { isInstallMenuEligible } from '@/components/pwa/installState';

/**
 * Event names are inlined rather than imported from the components that own
 * them: importing would pull those modules (and motion's `domAnimation`) into
 * every page's first load, and it would couple the shell to pages it does not
 * own.
 *
 * - `dd:search:focus` — dispatched when the already-active Search tab is
 *   re-selected; the `/search` page listens and re-focuses its input.
 * - `dd:menu:open` — listened for here; the home greeting bar's avatar button
 *   dispatches it to open the Menu sheet.
 * - `dd:tour:start` — dispatched to (re)launch the Spotlight tour.
 */
const SEARCH_FOCUS_EVENT = 'dd:search:focus';
export const MENU_OPEN_EVENT = 'dd:menu:open';
const TOUR_START_EVENT = 'dd:tour:start';

/**
 * Client half of `(app)/layout.tsx`: providers, the bottom nav (with its Menu
 * sheet) and the page-transition wrapper. `isAdmin` comes from the server
 * layout's `auth()` call so the admin-only Menu entry never flashes in for
 * non-admins.
 */
export default function AppShell({
  children,
  isAdmin,
}: {
  children: ReactNode;
  isAdmin: boolean;
}) {
  return (
    <MotionProvider>
      <ToastProvider>
        <Shell isAdmin={isAdmin}>{children}</Shell>
      </ToastProvider>
    </MotionProvider>
  );
}

function Shell({ children, isAdmin }: { children: ReactNode; isAdmin: boolean }) {
  const pathname = usePathname() ?? '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const toast = useToast();

  // The home greeting bar's avatar opens this same sheet (DESIGN_PLAN §7).
  useEffect(() => {
    const open = () => setMenuOpen(true);
    window.addEventListener(MENU_OPEN_EVENT, open);
    return () => window.removeEventListener(MENU_OPEN_EVENT, open);
  }, []);

  // "Install app" Menu row: same stashed `beforeinstallprompt` the card in
  // `InstallHint` uses, so it can be re-offered on demand even after the
  // card itself has been dismissed for the session.
  const installEventCaptured = useInstallEventCaptured();
  const [installMenuEligible, setInstallMenuEligible] = useState(false);
  useEffect(() => {
    // Reads UA/display-mode signals (unavailable during SSR/first paint,
    // hence the effect rather than a lazy useState initializer) — see
    // `onboarding/useTour`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstallMenuEligible(
      isInstallMenuEligible({
        hasInstallEvent: installEventCaptured,
        isIOSUA: isIOSUserAgent(),
        isStandalone: isStandaloneDisplay(),
      }),
    );
  }, [installEventCaptured]);

  async function handleInstallFromMenu() {
    setMenuOpen(false);
    if (isIOSUserAgent()) {
      toast('Tap the Share button, then "Add to Home Screen".', 'info');
      return;
    }
    const outcome = await triggerInstallPrompt();
    if (outcome === 'unavailable') {
      toast('Install isn’t available right now.', 'error');
    }
  }

  // DESIGN_PLAN §7: Home · Search · Shares · Menu. Users moved into the Menu
  // sheet, admin only.
  const items: BottomNavItem[] = [
    { href: '/', label: 'Home', icon: HomeIcon },
    { href: '/search', label: 'Search', icon: SearchIcon, tourId: 'search' },
    { href: '/shares', label: 'Shares', icon: ClipboardList, tourId: 'nav-shares' },
    {
      href: '/__menu',
      label: 'Menu',
      icon: MenuIcon,
      onClick: () => setMenuOpen(true),
    },
  ];

  return (
    <>
      <div className="flex flex-1 flex-col pb-nav">
        {/*
          Remounted on every navigation by `key`, so the CSS keyframe replays.
          Deliberately not a motion `initial`: `domAnimation` loads lazily, so
          an `initial={{opacity:0}}` left every page painted at its initial
          value — washed out — until the feature bundle arrived, and on the
          pages that never triggered a re-render, forever.
        */}
        <div
          key={pathname}
          className="flex flex-1 flex-col animate-page-enter motion-reduce:animate-none"
        >
          {children}
        </div>
      </div>

      <BottomNav
        items={items}
        onReselect={(href) => {
          // Home has no input to focus any more (§7: greeting bar, not search
          // bar), so re-selecting it does the other conventional thing.
          if (href === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
          if (href === '/search') window.dispatchEvent(new CustomEvent(SEARCH_FOCUS_EVENT));
        }}
      />

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Menu">
        <nav className="flex flex-col gap-1 pb-2">
          <MenuLink href="/shares" icon={ClipboardList} onNavigate={() => setMenuOpen(false)}>
            Share log
          </MenuLink>
          {isAdmin ? (
            <MenuLink href="/admin/users" icon={Users} onNavigate={() => setMenuOpen(false)}>
              Users
            </MenuLink>
          ) : null}
          <MenuButton
            icon={Compass}
            onClick={() => {
              setMenuOpen(false);
              window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
            }}
          >
            Show me around
          </MenuButton>
          {installMenuEligible ? (
            <MenuButton icon={Download} onClick={handleInstallFromMenu}>
              Install app
            </MenuButton>
          ) : null}
          <MenuLink href="/privacy" icon={ShieldCheck} onNavigate={() => setMenuOpen(false)}>
            Privacy
          </MenuLink>
          <MenuLink href="/terms" icon={FileText} onNavigate={() => setMenuOpen(false)}>
            Terms
          </MenuLink>
          <MenuButton
            icon={LogOut}
            onClick={() => {
              setMenuOpen(false);
              void signOut({ redirectTo: '/login' });
            }}
          >
            Sign out
          </MenuButton>
        </nav>
      </Sheet>

      <InstallHint />
    </>
  );
}

function MenuLink({
  href,
  icon: Icon,
  onNavigate,
  children,
}: {
  href: string;
  icon: typeof ClipboardList;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable as={Link} href={href} variant="ghost" onClick={onNavigate} className="w-full justify-start!">
      <Icon aria-hidden="true" className="h-4 w-4 text-muted" />
      {children}
    </Pressable>
  );
}

function MenuButton({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof ClipboardList;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable variant="ghost" onClick={onClick} className="w-full justify-start!">
      <Icon aria-hidden="true" className="h-4 w-4 text-muted" />
      {children}
    </Pressable>
  );
}
