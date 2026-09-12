import Link from 'next/link';
import SignInButton from '@/components/SignInButton';

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

  return (
    <main className="flex flex-1 items-center justify-center p-6 pt-safe">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-2xl font-semibold tracking-tight">DriveDash</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Search, share and pin your Drive documents.
        </p>

        {denied ? (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            Access denied. This account is not on the allow list.
          </p>
        ) : null}

        <div className="mt-6">
          <SignInButton />
        </div>

        <footer className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          <nav className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link
              href="/privacy"
              className="min-h-[44px] inline-flex items-center underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:focus-visible:outline-accent-400"
            >
              Privacy
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/terms"
              className="min-h-[44px] inline-flex items-center underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:focus-visible:outline-accent-400"
            >
              Terms
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/about"
              className="min-h-[44px] inline-flex items-center underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:focus-visible:outline-accent-400"
            >
              About
            </Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
