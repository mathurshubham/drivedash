'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { ToastProvider, useToast } from '@/components/Toast';
import { relativeTime } from '@/components/relativeTime';
import { getAccessMe, getAdminUsers, removeUser, setUserBlocked } from '@/lib/client';
import type { AdminUsersResponse, UserRecord } from '@/lib/types';

type AdminUsersData = AdminUsersResponse & {
  budget: { writesToday: number; softLimit: number; hardLimit: number };
};

export default function AdminUsersPage() {
  return (
    <ToastProvider>
      <AdminUsers />
    </ToastProvider>
  );
}

function SeatChip({ count, max }: { count: number; max: number }) {
  const ratio = max > 0 ? count / max : 0;
  const tone =
    ratio >= 1
      ? 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
      : ratio >= 0.8
        ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
        : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${tone}`}>
      {count} / {max} seats
    </span>
  );
}

function AdminUsers() {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<AdminUsersData | null>(null);
  const [loading, setLoading] = useState(true);
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

  const admins = data?.admins ?? [];
  const users = [...(data?.users ?? [])].sort(
    (a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt),
  );
  const nonAdminCount = users.filter((u) => !admins.includes(u.email)).length;
  const maxUsers = data?.maxUsers ?? 0;
  const budget = data?.budget;

  async function toggleBlocked(user: UserRecord) {
    if (!data) return;
    const nextBlocked = !user.blocked;
    const key = `${nextBlocked ? 'block' : 'unblock'}:${user.email}`;
    const previous = data;
    setBusy(key);
    setData({
      ...data,
      users: data.users.map((u) => (u.email === user.email ? { ...u, blocked: nextBlocked } : u)),
    });
    try {
      const { users: nextUsers } = await setUserBlocked(user.email, nextBlocked);
      setData((current) => (current ? { ...current, users: nextUsers } : current));
      toast(nextBlocked ? `Blocked ${user.email}` : `Unblocked ${user.email}`);
    } catch (err: unknown) {
      setData(previous);
      toast(err instanceof Error ? err.message : 'failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(user: UserRecord) {
    if (confirmRemove !== user.email) {
      setConfirmRemove(user.email);
      return;
    }
    if (!data) return;
    const key = `remove:${user.email}`;
    const previous = data;
    setBusy(key);
    setConfirmRemove(null);
    setData({ ...data, users: data.users.filter((u) => u.email !== user.email) });
    try {
      const { users: nextUsers } = await removeUser(user.email);
      setData((current) => (current ? { ...current, users: nextUsers } : current));
      toast(`Removed ${user.email}, seat freed`);
    } catch (err: unknown) {
      setData(previous);
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
        {data ? (
          <span className="ml-auto">
            <SeatChip count={nonAdminCount} max={maxUsers} />
          </span>
        ) : null}
      </header>

      {loading || !data ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : (
        <main className="space-y-8">
          {budget ? (
            <p
              className={`text-xs ${
                budget.writesToday >= budget.hardLimit
                  ? 'text-red-600 dark:text-red-400'
                  : budget.writesToday >= budget.softLimit
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-neutral-500'
              }`}
            >
              KV writes today: {budget.writesToday} / {budget.softLimit}
            </p>
          ) : null}

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Admins
            </h2>
            <ul className="mt-3 space-y-2">
              {admins.map((email) => (
                <li
                  key={email}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-800"
                >
                  <span className="min-w-0 flex-1 truncate text-[15px]">{email}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                    <Lock aria-hidden="true" className="h-3.5 w-3.5" />
                    Admin
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Users
            </h2>
            {users.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">No users have signed in yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {users.map((user) => (
                  <UserRow
                    key={user.email}
                    user={user}
                    busy={busy}
                    confirmingRemove={confirmRemove === user.email}
                    onToggleBlocked={() => void toggleBlocked(user)}
                    onRemove={() => void handleRemove(user)}
                  />
                ))}
              </ul>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

function UserRow({
  user,
  busy,
  confirmingRemove,
  onToggleBlocked,
  onRemove,
}: {
  user: UserRecord;
  busy: string | null;
  confirmingRemove: boolean;
  onToggleBlocked: () => void;
  onRemove: () => void;
}) {
  const blockKey = `${user.blocked ? 'unblock' : 'block'}:${user.email}`;
  const removeKey = `remove:${user.email}`;

  return (
    <li className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{user.email}</span>
            {user.blocked ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800 dark:bg-red-950/50 dark:text-red-300">
                Blocked
              </span>
            ) : null}
          </p>
          {user.name ? <p className="text-sm text-neutral-500">{user.name}</p> : null}
          <p className="mt-1 text-xs text-neutral-500">
            First seen {relativeTime(user.firstSeenAt)} · Last seen {relativeTime(user.lastSeenAt)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy === blockKey}
          onClick={onToggleBlocked}
          className="min-h-[44px] flex-1 rounded-lg border border-neutral-300 px-3 text-sm font-medium hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {user.blocked ? 'Unblock' : 'Block'}
        </button>
        <button
          type="button"
          disabled={busy === removeKey}
          onClick={onRemove}
          className={`min-h-[44px] flex-1 rounded-lg px-3 text-sm font-medium disabled:opacity-60 ${
            confirmingRemove
              ? 'bg-red-600 text-white'
              : 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40'
          }`}
        >
          {confirmingRemove ? 'Confirm remove' : 'Remove'}
        </button>
      </div>
    </li>
  );
}
