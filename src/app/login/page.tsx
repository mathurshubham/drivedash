import Link from 'next/link';
import SignInButton from '@/components/SignInButton';
import { safeNextPath } from '@/lib/safe-next';

export const metadata = {
  title: 'Sign in · DriveDash',
};

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const raw = params.error;
  const error = Array.isArray(raw) ? raw[0] : raw;
  const denied = error === 'AccessDenied';
  const rawNext = params.next;
  const redirectTo = safeNextPath(Array.isArray(rawNext) ? rawNext[0] : rawNext) ?? '/';

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="login-blob pointer-events-none absolute inset-x-0 top-0 h-[40vh] min-h-[280px] w-full motion-reduce:animate-none"
      />

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-10 pt-safe">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight">DriveDash</h1>
          <p className="mt-2 text-base text-muted">
            Search, share and pin your Drive documents.
          </p>

          {denied ? (
            <p
              role="alert"
              className="mt-6 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              Access denied. This account is not on the allow list.
            </p>
          ) : null}

          <div className="mt-8">
            <SignInButton redirectTo={redirectTo} />
          </div>

          <footer className="mt-8 text-sm text-muted">
            <nav className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <Link
                href="/privacy"
                className="min-h-11 inline-flex items-center underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              >
                Privacy
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                href="/terms"
                className="min-h-11 inline-flex items-center underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              >
                Terms
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                href="/about"
                className="min-h-11 inline-flex items-center underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              >
                About
              </Link>
            </nav>
          </footer>
        </div>
      </div>
    </main>
  );
}
