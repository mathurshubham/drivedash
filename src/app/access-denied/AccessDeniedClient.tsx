'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { getAccessMe } from '@/lib/client';

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
    <main className="flex flex-1 items-center justify-center p-6 pt-safe">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {reason === 'full' ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">DriveDash is full</h1>
            <p className="mt-4 text-[15px] text-neutral-700 dark:text-neutral-300">
              This instance is limited to {maxUsers ?? 30} users and every seat is taken. Contact{' '}
              <a
                href={`mailto:${CONTACT}`}
                className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                {CONTACT}
              </a>{' '}
              if you need access.
            </p>
            {email ? (
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                Signed in as <span className="font-medium">{email}</span>.
              </p>
            ) : null}
          </>
        ) : reason === 'blocked' ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Access disabled</h1>
            <p className="mt-4 text-[15px] text-neutral-700 dark:text-neutral-300">
              Your access to DriveDash has been disabled by the administrator. Contact{' '}
              <a
                href={`mailto:${CONTACT}`}
                className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                {CONTACT}
              </a>{' '}
              if you think this is a mistake.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Access unavailable</h1>
            <p className="mt-5 text-sm text-neutral-500">Checking your account…</p>
          </>
        )}

        <button
          type="button"
          onClick={signOutElsewhere}
          className="mt-6 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-accent-600 px-5 text-base font-medium text-white hover:bg-accent-700"
        >
          Sign in with a different account
        </button>
      </div>
    </main>
  );
}
