'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import {
  ClipboardList,
  Compass,
  FileText,
  Home as HomeIcon,
  LogOut,
  Menu as MenuIcon,
  ShieldCheck,
  Users,
} from 'lucide-react';
import MotionProvider from '@/components/ui/MotionProvider';
import BottomNav, { type BottomNavItem } from '@/components/ui/BottomNav';
import Sheet from '@/components/ui/Sheet';
import Pressable from '@/components/ui/Pressable';
import { ToastProvider } from '@/components/Toast';
import { SEARCH_FOCUS_EVENT } from '@/components/TopBar';
// Inlined literal: importing from TourLauncher would pull motion's domAnimation into every page's first load.
const TOUR_START_EVENT = 'dd:tour:start';

/**
 * Client half of `(app)/layout.tsx`: providers, the bottom nav (with its Menu
 * sheet) and the page-transition wrapper. `isAdmin` comes from the server
 * layout's `auth()` call so the Users tab never flashes in for non-admins.
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
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);

  const items: BottomNavItem[] = [
    { href: '/', label: 'Home', icon: HomeIcon },
    { href: '/shares', label: 'Shares', icon: ClipboardList, tourId: 'nav-shares' },
    ...(isAdmin ? [{ href: '/admin/users', label: 'Users', icon: Users }] : []),
    {
      href: '/__menu',
      label: 'Menu',
      icon: MenuIcon,
      onClick: () => setMenuOpen(true),
    },
  ];

  const page = reduced ? (
    <div className="flex flex-1 flex-col">{children}</div>
  ) : (
    <AnimatePresence mode="wait">
      <m.div
        key={pathname}
        className="flex flex-1 flex-col"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );

  return (
    <>
      <div className="flex flex-1 flex-col pb-nav">{page}</div>

      <BottomNav
        items={items}
        onReselect={(href) => {
          if (href === '/') window.dispatchEvent(new CustomEvent(SEARCH_FOCUS_EVENT));
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
