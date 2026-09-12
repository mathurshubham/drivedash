'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import TopBar from '@/components/TopBar';
import HotList from '@/components/HotList';
import RecentStrip from '@/components/RecentStrip';
import SearchResults from '@/components/SearchResults';
import {
  targetFromFile,
  targetFromHotItem,
  type SheetTarget,
  type SheetView,
} from '@/components/sheet/types';
import SwipeHint from '@/components/onboarding/SwipeHint';
import { useToast } from '@/components/Toast';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { useHotList } from '@/components/useHotList';
import { useShares } from '@/components/useShares';
import { recent as fetchRecent, search as fetchSearch } from '@/lib/client';
import type { DriveFile, HotItem, SearchType } from '@/lib/types';

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

export default function Home() {
  const hot = useHotList();
  const shares = useShares({ autoload: false });
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [type, setType] = useState<SearchType>('all');

  const [results, setResults] = useState<DriveFile[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const [recentFiles, setRecentFiles] = useState<DriveFile[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [sheetView, setSheetView] = useState<SheetView>('menu');

  const requestId = useRef(0);

  const openSheet = useCallback((next: SheetTarget, view: SheetView = 'menu') => {
    setSheetView(view);
    setTarget(next);
  }, []);

  const runSearch = useCallback(async (q: string, searchType: SearchType) => {
    const id = ++requestId.current;
    if (!q) {
      setResults([]);
      setNextPageToken(undefined);
      setSearchError(null);
      setLoadMoreError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError(null);
    setLoadMoreError(null);
    try {
      const res = await fetchSearch(q, searchType);
      if (id !== requestId.current) return;
      setResults(res.files);
      setNextPageToken(res.nextPageToken);
    } catch (err) {
      if (id !== requestId.current) return;
      setResults([]);
      setNextPageToken(undefined);
      setSearchError(err instanceof Error ? err.message : 'failed');
    } finally {
      if (id === requestId.current) setSearching(false);
    }
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

  // Debounce the search box by 300ms, then search.
  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(() => {
      setDebouncedQuery(q);
      void runSearch(q, type);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, type, runSearch]);

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

  const loadMore = useCallback(() => {
    if (!nextPageToken || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    fetchSearch(debouncedQuery, type, nextPageToken)
      .then((res) => {
        if (id !== requestId.current) return;
        setResults((prev) => [...prev, ...res.files]);
        setNextPageToken(res.nextPageToken);
      })
      .catch((err: unknown) => {
        // A "load more" failure must not wipe the pages already on screen, so it
        // gets its own error slot rendered under the list.
        if (id !== requestId.current) return;
        setLoadMoreError(err instanceof Error ? err.message : 'failed');
      })
      .finally(() => {
        // Always clear the flag: a debounced search landing mid-flight bumps
        // requestId, and a guarded reset would leave "Load more" stuck forever.
        setLoadingMore(false);
      });
  }, [debouncedQuery, loadingMore, nextPageToken, type]);

  const refresh = useCallback(async () => {
    await Promise.all([
      hot.refresh(),
      loadRecent(),
      debouncedQuery ? runSearch(debouncedQuery, type) : Promise.resolve(),
    ]);
  }, [debouncedQuery, hot, loadRecent, runSearch, type]);

  const showSearch = debouncedQuery.length > 0;
  const activeShares = shares.ledger?.shares.filter((s) => s.status === 'active') ?? [];
  const activeShareCount = activeShares.length;
  const expireTodayCount = activeShares.filter(
    (s) => s.expiresAt && expiresOnLocalDay(s.expiresAt, new Date()),
  ).length;

  const hotlistEmpty = hot.hotList?.groups.every((g) => g.items.length === 0) ?? true;
  // One hint in the whole app, on whichever row is first on screen.
  const swipeHint = (row: ReactNode) => (
    <SwipeHint storageKey="dd.hint.swipe-pin">{row}</SwipeHint>
  );
  const pinFile = (file: DriveFile) => {
    const groupId = hot.hotList?.groups[0]?.id;
    // Swiping to pin needs somewhere to put it; without a group the sheet asks.
    if (!groupId) {
      openSheet(targetFromFile(file), 'pin');
      return;
    }
    hot.addPin(
      {
        fileId: file.id,
        name: file.name,
        mimeType: file.mimeType,
        kind: file.kind,
        webViewLink: file.webViewLink,
        iconLink: file.iconLink,
      },
      groupId,
    );
    toast(`Pinned to ${hot.hotList?.groups[0]?.name ?? 'group'}`, 'success');
  };

  const unpinItem = (item: HotItem) => {
    hot.removePin(item.fileId);
    toast('Unpinned', 'success');
  };

  return (
    <>
      <TourLauncher hotlistEmpty={hotlistEmpty} />
      <TopBar query={query} onQueryChange={setQuery} type={type} onTypeChange={setType} />

      <PullToRefresh onRefresh={refresh} scrollRoot="window" disabled={target !== null}>
        <main className="pb-nav mx-auto w-full max-w-[640px] flex-1 space-y-6 px-4 pt-4">
          {showSearch ? (
            <SearchResults
              files={results}
              query={debouncedQuery}
              loading={searching}
              loadingMore={loadingMore}
              error={searchError}
              loadMoreError={loadMoreError}
              hasMore={Boolean(nextPageToken)}
              onLoadMore={loadMore}
              onOpen={(file) => openInDrive(file.webViewLink)}
              onSelect={(file) => openSheet(targetFromFile(file))}
              onPin={pinFile}
              onUnpin={(file) => {
                hot.removePin(file.id);
                toast('Unpinned', 'success');
              }}
              onShare={(file) => openSheet(targetFromFile(file), 'anyone')}
              isPinned={hot.isPinned}
              decorateFirstRow={swipeHint}
            />
          ) : (
            <>
              <HotList
                hotList={hot.hotList}
                loading={hot.loading}
                error={hot.error}
                onRenameGroup={hot.renameGroup}
                onMoveGroup={hot.moveGroup}
                onDeleteGroup={hot.deleteGroup}
                onAddGroup={hot.addGroup}
                onStartTour={() => window.dispatchEvent(new CustomEvent(TOUR_START))}
                onOpenItem={(item) => openInDrive(item.webViewLink)}
                onSelectItem={(item) => openSheet(targetFromHotItem(item))}
                onUnpinItem={unpinItem}
                onShareItem={(item) => openSheet(targetFromHotItem(item), 'anyone')}
                decorateFirstRow={hotlistEmpty ? undefined : swipeHint}
              />
              {activeShareCount > 0 ? (
                <a
                  href="/shares"
                  className="block text-sm text-muted underline-offset-2 hover:underline"
                >
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
            </>
          )}
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
