'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import TopBar from '@/components/TopBar';
import HotList from '@/components/HotList';
import RecentStrip from '@/components/RecentStrip';
import SearchResults from '@/components/SearchResults';
import ActionSheet, {
  targetFromFile,
  targetFromHotItem,
  type SheetTarget,
} from '@/components/ActionSheet';
import { ToastProvider } from '@/components/Toast';
import { useHotList } from '@/components/useHotList';
import { recent as fetchRecent, search as fetchSearch } from '@/lib/client';
import type { DriveFile, SearchType } from '@/lib/types';

export default function Page() {
  return (
    <ToastProvider>
      <Home />
    </ToastProvider>
  );
}

function Home() {
  const hot = useHotList();

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

  const requestId = useRef(0);

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

  // Debounce the search box by 300ms, then search.
  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(() => {
      setDebouncedQuery(q);
      void runSearch(q, type);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, type, runSearch]);

  // Recent strip (loaded once).
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

  const showSearch = debouncedQuery.length > 0;

  return (
    <>
      <TopBar query={query} onQueryChange={setQuery} type={type} onTypeChange={setType} />

      <main className="mx-auto w-full max-w-[640px] flex-1 space-y-6 px-4 pb-16 pt-4">
        {showSearch ? (
          <SearchResults
            files={results}
            loading={searching}
            loadingMore={loadingMore}
            error={searchError}
            loadMoreError={loadMoreError}
            hasMore={Boolean(nextPageToken)}
            onLoadMore={loadMore}
            onSelect={(file) => setTarget(targetFromFile(file))}
            isPinned={hot.isPinned}
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
              onSelectItem={(item) => setTarget(targetFromHotItem(item))}
            />
            <RecentStrip
              files={recentFiles}
              loading={recentLoading}
              error={recentError}
              onSelect={(file) => setTarget(targetFromFile(file))}
            />
          </>
        )}
      </main>

      <ActionSheet
        key={target?.id ?? 'none'}
        target={target}
        groups={hot.hotList?.groups ?? []}
        onClose={() => setTarget(null)}
        onPin={hot.addPin}
        onUnpin={hot.removePin}
        onSetLabel={hot.setLabel}
        onMoveToGroup={hot.moveItem}
        onCreateGroup={hot.addGroup}
        hotListReady={hot.ready}
        onAfterCopy={() => void hot.refresh()}
      />
    </>
  );
}
