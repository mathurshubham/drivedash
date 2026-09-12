'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import GreetingBar, { MENU_OPEN_EVENT } from '@/components/TopBar';
import HotList from '@/components/HotList';
import RecentStrip from '@/components/RecentStrip';
import { takeNewPin } from '@/components/shelves/newPin';
import { targetFromFile, targetFromHotItem, type SheetTarget, type SheetView } from '@/components/sheet/types';
import { useToast } from '@/components/Toast';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { useHotList } from '@/components/useHotList';
import { useShares } from '@/components/useShares';
import { recent as fetchRecent } from '@/lib/client';
import type { DriveFile } from '@/lib/types';
import '@/app/shelves.css';

/**
 * The sheet — and with it vaul, the sub-forms and the group picker — is worth
 * ~45 KB gzipped and nothing on a cold home screen needs it until the first
 * long press, so it is fetched on demand.
 */
const ActionSheet = dynamic(() => import('@/components/ActionSheet'), { ssr: false });

/**
 * The tour offer imports motion's `domAnimation` bundle directly, so it stays
 * off the critical path too — it has a 400ms appear delay anyway.
 */
const TourLauncher = dynamic(() => import('@/components/onboarding/TourLauncher'), { ssr: false });

function expiresOnLocalDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * `TOUR_START_EVENT` from `onboarding/TourLauncher`, inlined: importing the
 * constant would pull that module (and the `domAnimation` bundle it imports)
 * back into the first load, defeating the dynamic import above.
 */
const TOUR_START = 'dd:tour:start';

/** Tap opens the file in Drive; `noopener` keeps the opened tab off `window.opener`. */
function openInDrive(webViewLink: string) {
  window.open(webViewLink, '_blank', 'noopener,noreferrer');
}

/**
 * Home v2 (DESIGN_PLAN §7): the hot list *is* the page. A greeting bar, a grid
 * of shelves, and the recent strip. Search moved to its own `/search` route.
 */
export default function Home() {
  const hot = useHotList();
  const shares = useShares({ autoload: false });
  const toast = useToast();

  const [recentFiles, setRecentFiles] = useState<DriveFile[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [sheetView, setSheetView] = useState<SheetView>('menu');
  const [newItemId, setNewItemId] = useState<string | undefined>(undefined);

  const openSheet = useCallback((next: SheetTarget, view: SheetView = 'menu') => {
    setSheetView(view);
    setTarget(next);
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetchRecent();
      setRecentFiles(res.files);
      setRecentError(null);
    } catch (err: unknown) {
      setRecentError(err instanceof Error ? err.message : 'failed');
    } finally {
      setRecentLoading(false);
    }
  }, []);

  // One ledger read per load: sweep when due, otherwise just fetch the log.
  useEffect(() => {
    let shouldSweep = true;
    try {
      const last = sessionStorage.getItem('lastSweepAttempt');
      if (last && Date.now() - Number(last) < 10 * 60 * 1000) shouldSweep = false;
      else sessionStorage.setItem('lastSweepAttempt', String(Date.now()));
    } catch {
      // sessionStorage can throw in private mode; still attempt the sweep.
    }
    if (shouldSweep) {
      void shares.sweep({ silent: true }).then((res) => {
        if (!res) return;
        const n = res.revoked + res.expired;
        if (n > 0) toast(`Revoked ${n} expired link${n === 1 ? '' : 's'}`);
      });
    } else {
      void shares.refresh();
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  // Recent strip (loaded once). Written out rather than calling `loadRecent`
  // so the state updates stay inside promise callbacks, where the
  // set-state-in-effect rule expects them.
  useEffect(() => {
    let active = true;
    fetchRecent()
      .then((res) => {
        if (!active) return;
        setRecentFiles(res.files);
        setRecentError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setRecentError(err instanceof Error ? err.message : 'failed');
      })
      .finally(() => {
        if (active) setRecentLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // A file pinned on `/search` gets one rise-in when Home comes back.
  useEffect(() => {
    const id = takeNewPin();
    // Reading (and clearing) sessionStorage, which only exists on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setNewItemId(id);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([hot.refresh(), loadRecent()]);
  }, [hot, loadRecent]);

  const activeShares = shares.ledger?.shares.filter((s) => s.status === 'active') ?? [];
  const activeShareCount = activeShares.length;
  const expireTodayCount = activeShares.filter(
    (s) => s.expiresAt && expiresOnLocalDay(s.expiresAt, new Date()),
  ).length;

  /**
   * The tour is only offered once the hot list has actually loaded: while
   * `hot.ready` is false the list *looks* empty, and offering a tour over a
   * spinner is how the first Chrome pass ended up showing it to everyone.
   */
  const pinnedCount =
    hot.hotList?.groups.reduce((total, g) => total + g.items.length, 0) ?? 0;
  const offerTour = hot.ready && pinnedCount === 0;

  return (
    <>
      <TourLauncher hotlistEmpty={offerTour} />
      <GreetingBar onMenu={() => window.dispatchEvent(new CustomEvent(MENU_OPEN_EVENT))} />

      <PullToRefresh onRefresh={refresh} scrollRoot="window" disabled={target !== null}>
        <main className="pb-nav mx-auto w-full max-w-[960px] flex-1 space-y-6 px-4 pt-4">
          <HotList
            hotList={hot.hotList}
            loading={hot.loading}
            error={hot.error}
            onRenameGroup={hot.renameGroup}
            onMoveGroup={hot.moveGroup}
            onDeleteGroup={hot.deleteGroup}
            onAddGroup={hot.addGroup}
            onSetGroupStyle={hot.setGroupStyle}
            onStartTour={() => window.dispatchEvent(new CustomEvent(TOUR_START))}
            onOpenItem={(item) => openInDrive(item.webViewLink)}
            onSelectItem={(item) => openSheet(targetFromHotItem(item))}
            newItemId={newItemId}
          />

          {activeShareCount > 0 ? (
            <a href="/shares" className="block text-sm text-muted underline-offset-2 hover:underline">
              {activeShareCount} active share{activeShareCount === 1 ? '' : 's'}
              {expireTodayCount > 0
                ? ` · ${expireTodayCount} expire${expireTodayCount === 1 ? 's' : ''} today`
                : ''}
            </a>
          ) : null}

          <RecentStrip
            files={recentFiles}
            loading={recentLoading}
            error={recentError}
            onOpen={(file) => openInDrive(file.webViewLink)}
            onSelect={(file) => openSheet(targetFromFile(file))}
          />
        </main>
      </PullToRefresh>

      <ActionSheet
        target={target}
        initialView={sheetView}
        groups={hot.hotList?.groups ?? []}
        onClose={() => setTarget(null)}
        onPin={hot.addPin}
        onUnpin={hot.removePin}
        onSetLabel={hot.setLabel}
        onMoveToGroup={hot.moveItem}
        onCreateGroup={hot.addGroup}
        hotListReady={hot.ready}
        onAfterCopy={() => void hot.refresh()}
        onShareCreated={shares.add}
      />
    </>
  );
}
