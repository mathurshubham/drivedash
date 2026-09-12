'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { ToastProvider, useToast } from '@/components/Toast';
import { relativeTime } from '@/components/relativeTime';
import {
  addAdminUser,
  decideAccessRequest,
  getAccessMe,
  getAdminUsers,
  removeAdminUser,
} from '@/lib/client';
import type { AccessRequest, AdminUsersResponse } from '@/lib/types';

export default function AdminUsersPage() {
  return (
    <ToastProvider>
      <AdminUsers />
    </ToastProvider>
  );
}

function AdminUsers() {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await getAdminUsers();
    setData(next);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await getAccessMe();
        if (!active) return;
        if (!me.isAdmin) {
          router.replace('/');
          return;
        }
        await refresh();
      } catch {
        if (!active) return;
        router.replace('/');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh, router]);

  useEffect(() => {
    if (!confirmRemove) return;
    const timer = setTimeout(() => setConfirmRemove(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmRemove]);

  const pending = (data?.requests ?? []).filter((r) => r.status === 'pending');
  const adminSet = new Set(data?.admins ?? []);
  const approved = [...new Set([...(data?.allowlist ?? []), ...(data?.admins ?? [])])].sort();

  async function decide(email: string, decision: 'approved' | 'declined') {
    setBusy(`${decision}:${email}`);
    try {
      await decideAccessRequest(email, decision);
      await refresh();
      toast(decision === 'approved' ? `Approved ${email}` : `Declined ${email}`);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const email = addEmail.trim();
    if (!email) return;
    setBusy(`add:${email}`);
    try {
      await addAdminUser(email);
      setAddEmail('');
      await refresh();
      toast(`Added ${email}`);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function removeUser(email: string) {
    if (confirmRemove !== email) {
      setConfirmRemove(email);
      return;
    }
    setBusy(`remove:${email}`);
    try {
      await removeAdminUser(email);
      setConfirmRemove(null);
      await refresh();
      toast(`Removed ${email}`);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 pb-16 pt-safe">
      <header className="flex items-center gap-2 py-3">
        <Link
          href="/"
          aria-label="Back to home"
          className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Users</h1>
      </header>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : (
        <main className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Pending requests
            </h2>
            {pending.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">None.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {pending.map((r) => (
                  <PendingRow
                    key={r.email}
                    request={r}
                    busy={busy}
                    onApprove={() => void decide(r.email, 'approved')}
                    onDecline={() => void decide(r.email, 'declined')}
                  />
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Approved users
            </h2>
            <ul className="mt-3 space-y-2">
              {approved.map((email) => {
                const isAdmin = adminSet.has(email);
                return (
                  <li
                    key={email}
                    className="flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800"
                  >
                    <span className="min-w-0 flex-1 truncate text-[15px]">{email}</span>
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                        <Lock aria-hidden="true" className="h-3.5 w-3.5" />
                        Admin
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy === `remove:${email}`}
                        onClick={() => void removeUser(email)}
                        className={`min-h-[44px] rounded-lg px-3 text-sm font-medium ${
                          confirmRemove === email
                            ? 'bg-red-600 text-white'
                            : 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40'
                        }`}
                      >
                        {confirmRemove === email ? 'Confirm remove' : 'Remove'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Add user
            </h2>
            <form onSubmit={(e) => void addUser(e)} className="mt-3 flex gap-2">
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="name@example.com"
                aria-label="Email to add"
                className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 text-[15px] outline-none focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/40 dark:border-neutral-700 dark:bg-neutral-900"
              />
              <button
                type="submit"
                disabled={busy?.startsWith('add:') || !addEmail.trim()}
                className="min-h-[44px] rounded-xl bg-accent-600 px-4 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
              >
                Add
              </button>
            </form>
          </section>
        </main>
      )}
    </div>
  );
}

function PendingRow({
  request,
  busy,
  onApprove,
  onDecline,
}: {
  request: AccessRequest;
  busy: string | null;
  onApprove: () => void;
  onDecline: () => void;
}) {
  return (
    <li className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="font-medium">{request.email}</p>
      {request.name ? <p className="text-sm text-neutral-500">{request.name}</p> : null}
      {request.note ? <p className="mt-1 text-sm">{request.note}</p> : null}
      <p className="mt-1 text-xs text-neutral-500">Requested {relativeTime(request.requestedAt)}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy === `approved:${request.email}`}
          onClick={onApprove}
          className="min-h-[44px] flex-1 rounded-lg bg-accent-600 px-3 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy === `declined:${request.email}`}
          onClick={onDecline}
          className="min-h-[44px] flex-1 rounded-lg border border-neutral-300 px-3 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Decline
        </button>
      </div>
    </li>
  );
}
