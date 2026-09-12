'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, X } from 'lucide-react';
import KindIcon from '@/components/KindIcon';
import { ToastProvider, useToast } from '@/components/Toast';
import { relativeFuture, relativeTime } from '@/components/relativeTime';
import { useShares } from '@/components/useShares';
import type { FileKind, ShareEntry } from '@/lib/types';

const ACTIVE_STATUSES = new Set(['active', 'private', 'external']);
const HISTORY_STATUSES = new Set(['expired', 'revoked']);

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

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-neutral-50/90 backdrop-blur-md pt-safe dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="mx-auto w-full max-w-[640px] px-4 pb-3 pt-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              aria-label="Back to home"
              className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-neutral-200/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:hover:bg-neutral-800"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold tracking-tight">Share log</h1>
          </div>
          <div className="relative mt-2">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by file, email, or client"
              aria-label="Filter share log"
              className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-white pl-9 pr-10 text-[15px] outline-none focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:border-neutral-700 dark:bg-neutral-900"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear filter"
                onClick={() => setQuery('')}
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[640px] flex-1 space-y-6 px-4 pb-16 pt-4">
        {showBanner ? (
          <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
            Some links may have outlived their expiry. Sweeps run when you open the app.
          </p>
        ) : null}

        {shares.loading && !shares.ledger ? (
          <p className="text-sm text-neutral-500">Loading share log…</p>
        ) : null}

        {failed ? (
          <p className="text-sm text-red-600">
            {shares.error}{' '}
            <button type="button" className="underline" onClick={() => void shares.refresh()}>
              Retry
            </button>
          </p>
        ) : empty ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No shares yet. Share a file from the home screen.
          </p>
        ) : null}

        {!empty && active.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Active</h2>
            <ul className="space-y-2">
              {active.map((entry) => (
                <ShareRow
                  key={entry.id}
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
              ))}
            </ul>
          </section>
        ) : null}

        {!empty && history.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              History
            </h2>
            <ul className="space-y-2">
              {history.map((entry) => (
                <ShareRow key={entry.id} entry={entry} history />
              ))}
            </ul>
          </section>
        ) : null}

        {!failed && !empty && filtered.length === 0 ? (
          <p className="text-sm text-neutral-500">No shares match that filter.</p>
        ) : null}
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
  const actionClass =
    'min-h-[44px] rounded-lg px-3 text-sm font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:opacity-40 dark:hover:bg-neutral-800';

  return (
    <li
      className={`rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900 ${
        history ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
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
          <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">{sentence(entry)}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {history ? historyMeta(entry) : expiryMeta(entry)}
            {entry.note ? ` · ${entry.note}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {!history && entry.status === 'active' ? (
              <>
                <button type="button" onClick={onRevoke} className={actionClass}>
                  {confirm ? 'Confirm revoke' : 'Revoke'}
                </button>
                <button
                  type="button"
                  disabled={entry.expiresAt === null}
                  onClick={onExtend}
                  className={actionClass}
                >
                  Extend 7d
                </button>
              </>
            ) : null}
            {entry.kind === 'copy' ? (
              <a
                href={entry.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`${actionClass} inline-flex items-center`}
              >
                Open copy
              </a>
            ) : null}
            {entry.kind === 'external' ? (
              <a
                href={entry.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`${actionClass} inline-flex items-center`}
              >
                Open sharing in Drive
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
