import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

import type { AccessTokenClaims } from './token';
import {
  REFRESH_SKEW_SECONDS,
  getSessionToken,
  isAllowedEmail,
  refreshAccessToken,
  resolveAccessToken,
} from './token';

export { isAllowedEmail };

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive',
  // appDataFolder access is documented against this scope; `drive` alone is not
  // reliably sufficient for the hot list file.
  'https://www.googleapis.com/auth/drive.appdata',
].join(' ');

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

/**
 * The config is built lazily, per request. On Workers `process.env` is
 * populated by the opennext adapter for the duration of a request, so reading
 * `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` at module scope on a cold isolate can
 * capture empty credentials and produce `invalid_client`.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  trustHost: true,
  session: { strategy: 'jwt' as const },
  pages: { signIn: '/login' },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
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
      if (profile?.email) {
        // Google only vouches for a verified address.
        if (profile.email_verified !== true) return false;
        return isAllowedEmail(profile.email);
      }
      return isAllowedEmail(user?.email);
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
}));

/**
 * The access token for the current session, or `null` when there is no usable
 * session. Server-only: never return this to the browser.
 */
export async function getAccessToken(req: Request): Promise<string | null> {
  const claims = await getSessionToken(req);
  if (!claims) return null;
  return resolveAccessToken(claims as AccessTokenClaims);
}
