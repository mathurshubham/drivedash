'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { getAccessMe } from '@/lib/client';
import Pressable from '@/components/ui/Pressable';
import { ToastProvider } from '@/components/Toast';

/**
 * The same sheet the in-app Menu opens. This page sits outside the app shell,
 * so it brings its own `ToastProvider` — the sheet's tree expects one.
 */
const DeleteDataSheet = dynamic(() => import('@/components/account/DeleteDataSheet'), {
  ssr: false,
});

type Reason = 'full' | 'blocked';

const CONTACT = 'mathurshubham@gmail.com';

function isReason(value: unknown): value is Reason {
  return value === 'full' || value === 'blocked';
}

export default function AccessDeniedClient({ initialReason }: { initialReason: Reason | null }) {
  const router = useRouter();
  const [reason, setReason] = useState<Reason | null>(initialReason);
  const [email, setEmail] = useState<string | null>(null);
  const [maxUsers, setMaxUsers] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getAccessMe()
      .then((data) => {
        if (!active) return;
        if (data.allowed) {
          router.replace('/');
          return;
        }
        setEmail(data.email);
        setMaxUsers(data.maxUsers);
        if (isReason(data.reason)) setReason(data.reason);
      })
      .catch(() => {
        if (!active) return;
        router.replace('/login');
      });
    return () => {
      active = false;
    };
  }, [router]);

  function signOutElsewhere() {
    void signOut({ redirectTo: '/login' });
  }

  return (
    <main className="flex flex-1 animate-fade-in items-center justify-center p-6 pt-safe">
      <div className="w-full max-w-sm rounded-lg border border-subtle surface p-7 shadow-pop">
        {reason === 'full' ? (
          <>
            <h1 className="text-lg font-semibold tracking-tight">DriveDash is full</h1>
            <p className="mt-4 text-[15px] text-fg">
              This instance is limited to {maxUsers ?? 30} users and every seat is taken. Contact{' '}
              <a href={`mailto:${CONTACT}`} className="underline underline-offset-2 hover:text-fg">
                {CONTACT}
              </a>{' '}
              if you need access.
            </p>
            {email ? (
              <p className="mt-3 text-sm text-muted">
                Signed in as <span className="font-medium">{email}</span>.
              </p>
            ) : null}
          </>
        ) : reason === 'blocked' ? (
          <>
            <h1 className="text-lg font-semibold tracking-tight">Access disabled</h1>
            <p className="mt-4 text-[15px] text-fg">
              Your access to DriveDash has been disabled by the administrator. Contact{' '}
              <a href={`mailto:${CONTACT}`} className="underline underline-offset-2 hover:text-fg">
                {CONTACT}
              </a>{' '}
              if you think this is a mistake.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold tracking-tight">Access unavailable</h1>
            <p className="mt-5 text-sm text-muted">Checking your account…</p>
          </>
        )}

        <Pressable variant="primary" size="lg" block className="mt-6" onClick={signOutElsewhere}>
          Sign in with a different account
        </Pressable>

        {/*
          Being refused must not trap the account's data here: a blocked or
          capped user can still purge everything and hand the seat back.
        */}
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="mt-4 block w-full min-h-11 text-sm text-muted underline underline-offset-2 transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-md"
        >
          Delete my data
        </button>
      </div>

      {deleteOpen ? (
        <ToastProvider>
          <DeleteDataSheet open={deleteOpen} onOpenChange={setDeleteOpen} />
        </ToastProvider>
      ) : null}
    </main>
  );
}
