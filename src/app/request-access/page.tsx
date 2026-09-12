'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ToastProvider, useToast } from '@/components/Toast';
import { relativeTime } from '@/components/relativeTime';
import { getAccessMe, requestAccess } from '@/lib/client';
import type { AccessMeResponse } from '@/lib/types';

export default function RequestAccessPage() {
  return (
    <ToastProvider>
      <RequestAccess />
    </ToastProvider>
  );
}

function RequestAccess() {
  const router = useRouter();
  const toast = useToast();
  const [me, setMe] = useState<AccessMeResponse | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAccessMe()
      .then((data) => {
        if (!active) return;
        if (data.allowed) {
          router.replace('/');
          return;
        }
        setMe(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'failed');
      });
    return () => {
      active = false;
    };
  }, [router]);

  const pending = me?.pendingRequest;

  async function submit() {
    if (busy || pending) return;
    setBusy(true);
    try {
      await requestAccess(note);
      setSent(true);
      toast('Request sent');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'failed';
      toast(message === 'try again in 7 days' ? 'You can request again in 7 days.' : message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6 pt-safe">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-2xl font-semibold tracking-tight">Request access</h1>

        {loadError ? (
          <p role="alert" className="mt-5 text-sm text-red-700 dark:text-red-300">
            {loadError}
          </p>
        ) : !me && !sent ? (
          <p className="mt-5 text-sm text-neutral-500">Checking your account…</p>
        ) : sent ? (
          <>
            <p className="mt-4 text-[15px] text-neutral-700 dark:text-neutral-300">
              Request sent. You can sign in once approved.
            </p>
            <button
              type="button"
              onClick={() => void signOut({ redirectTo: '/login' })}
              className="mt-6 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-accent-600 px-5 text-base font-medium text-white hover:bg-accent-700"
            >
              Done
            </button>
          </>
        ) : me ? (
          <>
            <p className="mt-3 text-[15px] text-neutral-700 dark:text-neutral-300">
              You are signed in as <span className="font-medium">{me.email}</span> but not approved
              yet.
            </p>

            {pending ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                Request pending since {relativeTime(pending.requestedAt)}.
              </p>
            ) : (
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                Declined emails may request again after 7 days.
              </p>
            )}

            <label className="mt-5 block text-sm font-medium" htmlFor="access-note">
              Note <span className="font-normal text-neutral-500">(optional)</span>
            </label>
            <textarea
              id="access-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              disabled={Boolean(pending) || busy}
              placeholder="Why you need access"
              className="mt-1 min-h-[96px] w-full rounded-xl border border-neutral-300 bg-white p-3 text-[15px] outline-none focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/40 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
            />
            <p className="mt-1 text-right text-xs text-neutral-400">{note.length}/300</p>

            <button
              type="button"
              disabled={Boolean(pending) || busy}
              onClick={() => void submit()}
              className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-accent-600 px-5 text-base font-medium text-white hover:bg-accent-700 disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Request access'}
            </button>

            <button
              type="button"
              onClick={() => void signOut({ redirectTo: '/login' })}
              className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl px-5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Sign in with a different account
            </button>
          </>
        ) : null}
      </div>
    </main>
  );
}
