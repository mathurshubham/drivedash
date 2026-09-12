import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

import type { AccessTokenClaims } from './token';
import { REFRESH_SKEW_SECONDS, refreshAccessToken, resolveAccessToken } from './token';

const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive';

declare module 'next-auth' {
  interface Session {
    /** Set to `'RefreshTokenError'` when the refresh token could not be exchanged. */
    error?: 'RefreshTokenError';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    /** Epoch seconds. */
    expiresAt?: number;
    error?: 'RefreshTokenError';
  }
}

function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = allowedEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Google({
      authorization: {
        params: {
          scope: SCOPES,
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    signIn({ profile, user }) {
      const email = profile?.email ?? user?.email;
      return isAllowedEmail(email);
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token ?? token.refreshToken;
        token.expiresAt =
          typeof account.expires_at === 'number'
            ? account.expires_at
            : Math.floor(Date.now() / 1000) + Number(account.expires_in ?? 3600);
        delete token.error;
        return token;
      }

      const expiresAt = token.expiresAt ?? 0;
      if (Date.now() / 1000 <= expiresAt - REFRESH_SKEW_SECONDS) return token;

      if (!token.refreshToken) {
        token.error = 'RefreshTokenError';
        return token;
      }

      try {
        const refreshed = await refreshAccessToken(token.refreshToken);
        token.accessToken = refreshed.access_token;
        token.expiresAt = Math.floor(Date.now() / 1000) + Number(refreshed.expires_in ?? 3600);
        if (refreshed.refresh_token) token.refreshToken = refreshed.refresh_token;
        delete token.error;
      } catch {
        token.error = 'RefreshTokenError';
      }
      return token;
    },
    session({ session, token }) {
      // Deliberately expose only `user` and `error` — never the access token.
      if (token.error) session.error = token.error;
      return session;
    },
  },
});

/**
 * The access token for the current session, or `null` when there is no usable
 * session. Server-only: never return this to the browser.
 */
export async function getAccessToken(req?: Request): Promise<string | null> {
  const { getToken } = await import('next-auth/jwt');
  const secureCookie = req
    ? new URL(req.url).protocol === 'https:'
    : (process.env.AUTH_URL ?? '').startsWith('https://');
  const source: Request | { headers: Headers } =
    req ?? { headers: await (await import('next/headers')).headers() };

  const token = await getToken({
    req: source,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });

  if (!token) return null;
  return resolveAccessToken(token as AccessTokenClaims);
}
