'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw, Search, Trash2, X } from 'lucide-react';
import KindIcon from '@/components/KindIcon';
import { ToastProvider, useToast } from '@/components/Toast';
import { relativeFuture, relativeTime } from '@/components/relativeTime';
import { useShares } from '@/components/useShares';
import { SharesEmpty } from '@/components/onboarding/EmptyStates';
import { TOOLTIP_COPY } from '@/components/onboarding/tooltipCopy';
import { ChipGroup, Chip } from '@/components/ui/Chip';
import Pressable, { Link } from '@/components/ui/Pressable';
import { SkeletonList } from '@/components/ui/Skeleton';
import SwipeableRow from '@/components/ui/SwipeableRow';
import Toggletip from '@/components/ui/Toggletip';
import type { FileKind, ShareEntry } from '@/lib/types';

const ACTIVE_STATUSES = new Set(['active', 'private', 'external']);
const HISTORY_STATUSES = new Set(['expired', 'revoked']);

type Tab = 'active' | 'history';

function matchesQuery(entry: ShareEntry, q: string): boolean {
  if (!q) return true;
  const hay = [entry.fileName, entry.email ?? '', entry.clientName ?? ''].join(' ').toLowerCase();
  return hay.includes(q);
}

function sentence(entry: ShareEntry): string {
  if (entry.kind === 'anyone') return 'Link created for anyone';
  if (entry.kind === 'email') {
    const who = entry.email ?? 'someone';
    return entry.notified === false ? `Shared with ${who} (no email sent)` : `Emailed to ${who}`;
  }
  if (entry.kind === 'copy') {
    const client = entry.clientName ?? 'client';
    if (entry.shareKind === 'none' || entry.status === 'private') {
      return `Copy created for ${client}, not shared`;
    }
    if (entry.shareKind === 'email') {
      const who = entry.email ?? 'someone';
      const emailed =
        entry.notified === false ? `shared with ${who} (no email sent)` : `emailed to ${who}`;
      return `Copy created for ${client}, ${emailed}`;
    }
    return `Copy created for ${client}, link for anyone`;
  }
  return 'Link copied, file was already public before this app';
}

function historyMeta(entry: ShareEntry): string {
  const ago = relativeTime(entry.revokedAt);
  if (entry.revokedBy === 'you') return `Revoked by you${ago ? ` · ${ago}` : ''}`;
  if (entry.revokedBy === 'sweep') return `Revoked automatically, expired${ago ? ` · ${ago}` : ''}`;
  if (entry.revokedBy === 'google') return `Expired, removed by Google${ago ? ` · ${ago}` : ''}`;
  return ago;
}

function expiryMeta(entry: ShareEntry): string {
  if (entry.expiresAt === null) return 'no expiry';
  const rel = relativeFuture(entry.expiresAt);
  if (rel === 'expired' || rel === 'today') return rel;
  return `expires ${rel}`;
}

function needsSweepBanner(entries: ShareEntry[], lastSweepAt: string | null): boolean {
  const stale = !lastSweepAt || Date.now() - Date.parse(lastSweepAt) > 3 * 24 * 60 * 60 * 1000;
  if (!stale) return false;
  return entries.some(
    (s) => s.status === 'active' && s.expiresAt !== null && s.nativeExpiry !== true,
  );
}

function byNewest(a: ShareEntry, b: ShareEntry): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function fileKindOf(entry: ShareEntry): FileKind {
  if (entry.fileKind) return entry.fileKind;
  const name = entry.fileName.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.pptx')) return 'pptx';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.xlsx')) return 'xlsx';
  return 'other';
}

/** 3px left rail colour: accent for a live link, warn for Drive-native external sharing, muted otherwise. */
function railClass(entry: ShareEntry): string {
  if (entry.status === 'external') return 'bg-warn';
  if (ACTIVE_STATUSES.has(entry.status)) return 'bg-accent-600';
  return 'bg-muted/50';
}

export default function SharesPage() {
  return (
    <ToastProvider>
      <ShareLog />
    </ToastProvider>
  );
}

function ShareLog() {
  const shares = useShares();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('active');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (shares.ledger?.shares ?? []).filter((s) => matchesQuery(s, q));
  }, [query, shares.ledger]);

  const active = filtered.filter((s) => ACTIVE_STATUSES.has(s.status)).sort(byNewest);
  const history = filtered.filter((s) => HISTORY_STATUSES.has(s.status)).sort(byNewest);
  const failed = Boolean(shares.error && !shares.ledger);
  const empty = !shares.loading && !failed && (shares.ledger?.shares.length ?? 0) === 0;
  const showBanner = shares.ledger
    ? needsSweepBanner(shares.ledger.shares, shares.ledger.lastSweepAt)
    : false;
  const loadingFirstPage = shares.loading && !shares.ledger;

  const onRevoke = (id: string) => {
    if (confirmId === id) {
      setConfirmId(null);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      shares.revoke(id);
      return;
    }
    setConfirmId(id);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmId(null), 4000);
  };

  const visible = tab === 'active' ? active : history;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-subtle bg-bg/80 backdrop-blur-md pt-safe">
        <div className="mx-auto w-full max-w-[640px] px-4 pb-3 pt-3">
          <div className="flex items-center gap-2">
            <Pressable
              as={Link}
              href="/"
              variant="ghost"
              size="md"
              aria-label="Back to home"
              className="px-0! min-h-11! w-11!"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Pressable>
            <h1 className="text-lg font-semibold tracking-tight">Share log</h1>
          </div>

          <div className="relative mt-3">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by file, email, or client"
              aria-label="Filter share log"
              className="min-h-[48px] w-full rounded-md surface-2 pl-10 pr-11 text-[15px] text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
            />
            {query ? (
              <span className="absolute right-1 top-1/2 -translate-y-1/2">
                <Pressable
                  variant="ghost"
                  size="md"
                  aria-label="Clear filter"
                  onClick={() => setQuery('')}
                  className="px-0! min-h-9! w-9!"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Pressable>
              </span>
            ) : null}
          </div>

          <ChipGroup label="Share status" value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-3 w-full">
            <Chip value="active" className="flex-1 justify-center">
              Active{active.length ? ` (${active.length})` : ''}
            </Chip>
            <Chip value="history" className="flex-1 justify-center">
              History{history.length ? ` (${history.length})` : ''}
            </Chip>
          </ChipGroup>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[640px] flex-1 space-y-4 px-4 pb-nav pt-4">
        {showBanner ? (
          <p className="flex items-start gap-1.5 rounded-md bg-warn/10 px-3 py-3 text-sm text-warn">
            <span className="flex-1">
              Some links may have outlived their expiry. Sweeps run when you open the app.
            </span>
            <Toggletip label="About link expiry">{TOOLTIP_COPY.expiryChips}</Toggletip>
          </p>
        ) : null}

        {loadingFirstPage ? (
          <SkeletonList count={4} variant="row" label="Loading share log" />
        ) : failed ? (
          <p className="text-sm text-danger">
            {shares.error}{' '}
            <button type="button" className="underline" onClick={() => void shares.refresh()}>
              Retry
            </button>
          </p>
        ) : empty ? (
          <SharesEmpty />
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted">
            {query ? 'No shares match that filter.' : `No ${tab} shares.`}
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((entry) =>
              tab === 'active' ? (
                <li key={entry.id} className="overflow-hidden rounded-md">
                  <SwipeableRow
                    leftAction={{
                      label: 'Revoke',
                      tone: 'danger',
                      icon: <Trash2 aria-hidden="true" className="h-4 w-4" />,
                      onTrigger: () => shares.revoke(entry.id),
                    }}
                  >
                    <ShareRow
                      entry={entry}
                      history={false}
                      confirm={confirmId === entry.id}
                      onRevoke={() => onRevoke(entry.id)}
                      onExtend={() => {
                        if (entry.expiresAt === null) {
                          toast('This share has no expiry', 'error');
                          return;
                        }
                        shares.extend(entry.id, 7);
                      }}
                    />
                  </SwipeableRow>
                </li>
              ) : (
                <li key={entry.id}>
                  <ShareRow entry={entry} history />
                </li>
              ),
            )}
          </ul>
        )}
      </main>
    </>
  );
}

function ShareRow({
  entry,
  history,
  confirm,
  onRevoke,
  onExtend,
}: {
  entry: ShareEntry;
  history: boolean;
  confirm?: boolean;
  onRevoke?: () => void;
  onExtend?: () => void;
}) {
  return (
    <div className={`flex gap-3 rounded-md border border-subtle surface p-3 ${history ? 'opacity-70' : ''}`}>
      <span aria-hidden="true" className={`w-[3px] shrink-0 self-stretch rounded-full ${railClass(entry)}`} />
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm surface-2">
        <KindIcon kind={fileKindOf(entry)} />
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={entry.webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-[15px] font-medium hover:underline"
        >
          {entry.fileName}
        </a>
        <p className="mt-0.5 text-sm text-muted">{sentence(entry)}</p>
        <p className="mt-0.5 text-xs text-muted">
          {history ? historyMeta(entry) : expiryMeta(entry)}
          {entry.note ? ` · ${entry.note}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {!history && entry.status === 'active' ? (
            <>
              <Pressable
                variant={confirm ? 'danger' : 'secondary'}
                size="md"
                className="min-h-9! px-3! text-sm"
                onClick={onRevoke}
              >
                {confirm ? 'Confirm revoke' : 'Revoke'}
              </Pressable>
              <Pressable
                variant="secondary"
                size="md"
                disabled={entry.expiresAt === null}
                onClick={onExtend}
                className="min-h-9! px-3! text-sm"
              >
                <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                Extend 7d
              </Pressable>
            </>
          ) : null}
          {entry.kind === 'copy' ? (
            <Pressable as="a" href={entry.webViewLink} target="_blank" rel="noopener noreferrer" variant="secondary" size="md" className="min-h-9! px-3! text-sm">
              Open copy
            </Pressable>
          ) : null}
          {entry.kind === 'external' ? (
            <Pressable as="a" href={entry.webViewLink} target="_blank" rel="noopener noreferrer" variant="secondary" size="md" className="min-h-9! px-3! text-sm">
              Open sharing in Drive
            </Pressable>
          ) : null}
        </div>
      </div>
    </div>
  );
}
