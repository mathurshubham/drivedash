'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react';
import SearchResults from '@/components/SearchResults';
import TypeChips from '@/components/TypeChips';
import { targetFromFile, type SheetTarget, type SheetView } from '@/components/sheet/types';
import { useToast } from '@/components/Toast';
import HintBadge from '@/components/ui/HintBadge';
import Pressable from '@/components/ui/Pressable';
import { useHotList } from '@/components/useHotList';
import { useShares } from '@/components/useShares';
import { search as fetchSearch } from '@/lib/client';
import { rankResults } from '@/lib/rank';
import {
  mergeRecentSearch,
  readRecentSearches,
  writeRecentSearches,
} from '@/lib/recentSearches';
import { NEW_PIN_KEY } from '@/components/shelves/newPin';
import type { DriveFile, SearchType } from '@/lib/types';
import '@/app/shelves.css';

/** Same deal as on Home: the sheet (and vaul with it) waits for a long press. */
const ActionSheet = dynamic(() => import('@/components/ActionSheet'), { ssr: false });

function openInDrive(webViewLink: string) {
  window.open(webViewLink, '_blank', 'noopener,noreferrer');
}

/**
 * `/search` (DESIGN_PLAN §7): search is a utility, so it left Home for its own
 * full-screen route — autofocused input, type chips, swipeable result rows and
 * the recent-search chips that make a repeat lookup one tap.
 */
export default function SearchPage() {
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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [sheetView, setSheetView] = useState<SheetView>('menu');

  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const openSheet = useCallback((next: SheetTarget, view: SheetView = 'menu') => {
    setSheetView(view);
    setTarget(next);
  }, []);

  useEffect(() => {
    // localStorage is unavailable during SSR, hence an effect rather than a
    // lazy initializer that would differ between server and client render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentSearches(readRecentSearches());
  }, []);

  const remember = useCallback((q: string) => {
    setRecentSearches((prev) => {
      const next = mergeRecentSearch(prev, q);
      writeRecentSearches(next);
      return next;
    });
  }, []);

  const runSearch = useCallback(
    async (q: string, searchType: SearchType) => {
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
        setResults(rankResults(res.files, q));
        setNextPageToken(res.nextPageToken);
        if (res.files.length > 0) remember(q);
      } catch (err) {
        if (id !== requestId.current) return;
        setResults([]);
        setNextPageToken(undefined);
        setSearchError(err instanceof Error ? err.message : 'failed');
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    },
    [remember],
  );

  // Debounce the box by 300ms, then search.
  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(() => {
      setDebouncedQuery(q);
      void runSearch(q, type);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, type, runSearch]);

  const loadMore = useCallback(() => {
    if (!nextPageToken || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    fetchSearch(debouncedQuery, type, nextPageToken)
      .then((res) => {
        if (id !== requestId.current) return;
        // Rank within the new page only: re-ranking the whole list would
        // shuffle rows the user is already looking at.
        setResults((prev) => [...prev, ...rankResults(res.files, debouncedQuery)]);
        setNextPageToken(res.nextPageToken);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setLoadMoreError(err instanceof Error ? err.message : 'failed');
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [debouncedQuery, loadingMore, nextPageToken, type]);

  const pinFile = (file: DriveFile) => {
    const group = hot.hotList?.groups[0];
    // Pinning needs a shelf to land on; without one the sheet asks which.
    if (!group) {
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
      group.id,
    );
    // Home reads this once on mount and rises the matching tile in.
    try {
      sessionStorage.setItem(NEW_PIN_KEY, file.id);
    } catch {
      // Private mode: the tile just appears without the flourish.
    }
    toast(`Pinned to ${group.name}`, 'success');
  };

  const showResults = debouncedQuery.length > 0;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-subtle bg-bg/80 backdrop-blur-md pt-safe">
        <div className="mx-auto w-full max-w-[640px] px-4 pb-3 pt-3">
          <div className="flex items-center gap-2">
            <Pressable
              as={Link}
              href="/"
              variant="ghost"
              aria-label="Back to home"
              className="w-11 shrink-0 rounded-md px-0 text-muted"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Pressable>

            <div className="relative flex-1">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              />
              <input
                ref={inputRef}
                type="search"
                // A dedicated search route exists to be typed into; landing
                // without focus would cost a tap every time.
                autoFocus
                enterKeyHint="search"
                inputMode="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your Drive"
                aria-label="Search your Drive"
                className="min-h-[52px] w-full rounded-md surface-2 pl-10 pr-11 text-[15px] text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
              />
              {query ? (
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <Pressable
                    variant="ghost"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery('');
                      inputRef.current?.focus();
                    }}
                    className="px-0! min-h-10! w-10!"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </Pressable>
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-2">
            <TypeChips value={type} onChange={setType} />
          </div>
        </div>
      </header>

      <main className="pb-nav mx-auto w-full max-w-[640px] flex-1 space-y-4 px-4 pt-4">
        {showResults ? (
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
            decorateFirstRow={(row) => (
              // Leading edge only: the trailing half of the row belongs to the
              // Share and actions buttons, and a badge over them is untappable.
              <HintBadge storageKey="swipe-pin" label="Swipe → to pin" side="top-left">
                {row}
              </HintBadge>
            )}
          />
        ) : recentSearches.length > 0 ? (
          <section aria-label="Recent searches" className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Recent searches
            </h2>
            <ul className="flex flex-wrap gap-2">
              {recentSearches.map((q) => (
                <li key={q}>
                  <Pressable
                    variant="secondary"
                    onClick={() => setQuery(q)}
                    className="min-h-9 rounded-full px-3 text-sm"
                  >
                    {q}
                  </Pressable>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="px-1 text-sm text-muted">
            Search every file in your Drive. Chips narrow it down by type.
          </p>
        )}
      </main>

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
