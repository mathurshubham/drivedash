'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock, MoreHorizontal } from 'lucide-react';
import { ToastProvider, useToast } from '@/components/Toast';
import { relativeTime } from '@/components/relativeTime';
import { getAccessMe, getAdminUsers, removeUser, setUserBlocked } from '@/lib/client';
import type { AdminUsersResponse, UserRecord } from '@/lib/types';
import { TOOLTIP_COPY } from '@/components/onboarding/tooltipCopy';
import Pressable, { Link } from '@/components/ui/Pressable';
import Sheet from '@/components/ui/Sheet';
import { SkeletonList } from '@/components/ui/Skeleton';
import Toggletip from '@/components/ui/Toggletip';

export default function AdminUsersPage() {
  return (
    <ToastProvider>
      <AdminUsers />
    </ToastProvider>
  );
}

/** Thin seat meter: accent under 80% full, warn at 80%+, danger at 100%. */
function SeatMeter({ count, max }: { count: number; max: number }) {
  const ratio = max > 0 ? Math.min(1, count / max) : 0;
  const barClass = ratio >= 1 ? 'bg-danger' : ratio >= 0.8 ? 'bg-warn' : 'bg-accent-600';
  return (
    <div className="mt-3">
      <div className="h-1.5 w-full overflow-hidden rounded-full surface-2">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${barClass}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs tabular text-muted">
        {count} / {max} seats
      </p>
    </div>
  );
}

function AdminUsers() {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [sheetUser, setSheetUser] = useState<UserRecord | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

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

  const openSheetFor = useCallback((user: UserRecord) => {
    setConfirmRemove(false);
    setSheetUser(user);
  }, []);

  useEffect(() => {
    if (!confirmRemove) return;
    const timer = setTimeout(() => setConfirmRemove(false), 4000);
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
    setSheetUser((current) =>
      current && current.email === user.email ? { ...current, blocked: nextBlocked } : current,
    );
    try {
      const { users: nextUsers } = await setUserBlocked(user.email, nextBlocked);
      setData((current) => (current ? { ...current, users: nextUsers } : current));
      toast(nextBlocked ? `Blocked ${user.email}` : `Unblocked ${user.email}`);
    } catch (err: unknown) {
      setData(previous);
      setSheetUser((current) => (current && current.email === user.email ? user : current));
      toast(err instanceof Error ? err.message : 'failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(user: UserRecord) {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    if (!data) return;
    const key = `remove:${user.email}`;
    const previous = data;
    setBusy(key);
    setConfirmRemove(false);
    setSheetUser(null);
    setData({ ...data, users: data.users.filter((u) => u.email !== user.email) });
    try {
      const { users: nextUsers } = await removeUser(user.email);
      setData((current) => (current ? { ...current, users: nextUsers } : current));
      toast(`Removed ${user.email}. Seat freed.`);
    } catch (err: unknown) {
      setData(previous);
      toast(err instanceof Error ? err.message : 'failed', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 pb-nav pt-safe">
      <header className="py-3">
        <div className="flex items-center gap-2">
          <Pressable as={Link} href="/" variant="ghost" aria-label="Back to home" className="px-0! min-h-11! w-11!">
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Pressable>
          <h1 className="text-lg font-semibold tracking-tight">Users</h1>
        </div>
        {data ? <SeatMeter count={nonAdminCount} max={maxUsers} /> : null}
      </header>

      {loading || !data ? (
        <SkeletonList count={5} variant="row" label="Loading users" className="mt-4 space-y-2" />
      ) : (
        <main className="space-y-8 pb-8">
          {budget ? (
            <div className="text-xs">
              <p
                className={
                  budget.writesToday >= budget.hardLimit
                    ? 'text-danger'
                    : budget.writesToday >= budget.softLimit
                      ? 'text-warn'
                      : 'text-muted'
                }
              >
                KV writes today: {budget.writesToday} / {budget.hardLimit}
              </p>
              <p className="mt-0.5 text-muted">last-seen refreshes pause after {budget.softLimit}</p>
            </div>
          ) : null}

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Admins</h2>
            <ul className="mt-3 space-y-2">
              {admins.map((email) => (
                <li
                  key={email}
                  className="flex min-h-11 items-center gap-2 rounded-md border border-subtle px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-[15px]">{email}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <Lock aria-hidden="true" className="h-3.5 w-3.5" />
                    Admin
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Users</h2>
              <Toggletip label="About Block vs Remove">{TOOLTIP_COPY.adminBlockVsRemove}</Toggletip>
            </div>
            <p className="mt-1 text-xs text-muted">
              Block disables sign-in but keeps the seat. Remove frees the seat and is only
              available for blocked users; an unblocked account can sign in again and take a new
              seat.
            </p>
            {users.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No users have signed in yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {users.map((user) => (
                  <UserRow key={user.email} user={user} onOpenMenu={() => openSheetFor(user)} />
                ))}
              </ul>
            )}
          </section>
        </main>
      )}

      <Sheet
        open={sheetUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSheetUser(null);
            setConfirmRemove(false);
          }
        }}
        title={sheetUser?.email}
      >
        {sheetUser ? (
          <div className="flex flex-col gap-2 pb-2">
            <Pressable
              variant="secondary"
              size="lg"
              block
              disabled={busy === `${sheetUser.blocked ? 'unblock' : 'block'}:${sheetUser.email}`}
              onClick={() => void toggleBlocked(sheetUser)}
            >
              {sheetUser.blocked ? 'Unblock' : 'Block'}
            </Pressable>
            {sheetUser.blocked ? (
              <Pressable
                variant={confirmRemove ? 'danger' : 'secondary'}
                size="lg"
                block
                disabled={busy === `remove:${sheetUser.email}`}
                onClick={() => void handleRemove(sheetUser)}
              >
                {confirmRemove ? 'Confirm remove' : 'Remove'}
              </Pressable>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function UserRow({ user, onOpenMenu }: { user: UserRecord; onOpenMenu: () => void }) {
  const initial = (user.name?.trim()[0] ?? user.email[0] ?? '?').toUpperCase();

  return (
    <li className="flex items-center gap-3 rounded-md border border-subtle p-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-accent-600/10 text-sm font-semibold text-accent"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[15px] font-medium">{user.email}</span>
          {user.blocked ? (
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
              Blocked
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {user.name ? `${user.name} · ` : ''}Last seen {relativeTime(user.lastSeenAt)}
        </p>
      </div>
      <Pressable
        variant="ghost"
        size="md"
        aria-label={`Manage ${user.email}`}
        onClick={onOpenMenu}
        className="shrink-0 px-0! min-h-11! w-11!"
      >
        <MoreHorizontal aria-hidden="true" className="h-5 w-5 text-muted" />
      </Pressable>
    </li>
  );
}
