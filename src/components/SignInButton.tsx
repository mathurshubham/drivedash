'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { LogIn } from 'lucide-react';

export default function SignInButton({ redirectTo = '/' }: { redirectTo?: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signIn('google', { redirectTo });
      }}
      className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-xl bg-accent-600 px-5 text-base font-medium text-white transition-colors hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:opacity-60 dark:focus-visible:outline-accent-400"
    >
      <LogIn aria-hidden="true" className="h-5 w-5" />
      {busy ? 'Redirecting…' : 'Sign in with Google'}
    </button>
  );
}
