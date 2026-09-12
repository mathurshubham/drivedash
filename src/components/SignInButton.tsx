'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Pressable from '@/components/ui/Pressable';

/** Google's four-colour "G" mark, inlined so no icon pack dependency is added. */
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path
        fill="#FFFFFF"
        d="M23.49 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81z"
      />
      <path
        fill="#FFFFFF"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.92H1.3v3.09C3.27 21.3 7.31 24 12 24z"
        opacity="0.85"
      />
      <path
        fill="#FFFFFF"
        d="M5.31 14.32A7.2 7.2 0 0 1 4.93 12c0-.8.14-1.58.38-2.32V6.6H1.3A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.3 5.4l4.01-3.08z"
        opacity="0.7"
      />
      <path
        fill="#FFFFFF"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.27 2.7 1.3 6.6l4.01 3.08C6.25 6.86 8.89 4.75 12 4.75z"
        opacity="0.55"
      />
    </svg>
  );
}

export default function SignInButton({ redirectTo = '/' }: { redirectTo?: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <Pressable
      variant="primary"
      size="lg"
      block
      loading={busy}
      onClick={() => {
        setBusy(true);
        void signIn('google', { redirectTo });
      }}
    >
      {!busy ? <GoogleGlyph /> : null}
      {busy ? 'Redirecting…' : 'Sign in with Google'}
    </Pressable>
  );
}
