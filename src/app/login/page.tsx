import Link from 'next/link';
import { Layers, Search, Timer } from 'lucide-react';
import SignInButton from '@/components/SignInButton';
import { safeNextPath } from '@/lib/safe-next';

export const metadata = {
  title: 'Sign in · DriveDash',
};

const VALUE_PROPS = [
  { icon: Search, label: 'Search your whole Drive' },
  { icon: Layers, label: 'Pin shelves for the move' },
  { icon: Timer, label: 'Share links that expire' },
] as const;

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
    /*
      `flex-1` makes this exactly one viewport tall (see `about/page.tsx` for
      why), which is what the full-height brand moment wants — but the inner
      column must be `shrink-0` or a short viewport squashes the value props
      instead of scrolling, and the clip must be x-only or the overflow is
      unreachable.
    */
    <main className="relative flex flex-1 flex-col overflow-x-hidden">
      <div
        aria-hidden="true"
        className="login-blob pointer-events-none absolute inset-x-0 top-0 h-[46vh] min-h-[280px] w-full motion-reduce:animate-none"
      />

      <div className="relative flex flex-1 shrink-0 flex-col justify-center px-6 py-10 pt-safe">
        {/*
          One frame, two columns from 1024px. Below that the same elements
          stack into a single full-height column; above it the button moves
          into a card so it is not a lone control floating in whitespace.
        */}
        <div className="mx-auto grid w-full max-w-sm items-center gap-10 lg:max-w-5xl lg:grid-cols-2 lg:gap-16">
          <section className="text-center lg:text-left">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight lg:text-[40px]">
              DriveDash
            </h1>
            <p className="mt-2 text-base text-muted">Your Drive, one thumb away.</p>

            <ul className="mx-auto mt-8 flex max-w-xs flex-col gap-4 text-left lg:mx-0 lg:max-w-none">
              {VALUE_PROPS.map((prop) => (
                <li key={prop.label} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-accent-600/10 text-accent">
                    <prop.icon aria-hidden="true" className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-sm font-medium">{prop.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="lg:rounded-lg lg:border lg:border-subtle lg:surface lg:p-8 lg:shadow-pop">
            {denied ? (
              <p
                role="alert"
                className="mb-6 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                Access denied. This account is not on the allow list.
              </p>
            ) : null}

            <SignInButton redirectTo={redirectTo} />

            <p className="mt-4 text-center text-xs leading-relaxed text-muted">
              By signing in you agree to our{' '}
              <Link
                href="/terms"
                className="underline underline-offset-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
              >
                Terms
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="underline underline-offset-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
              >
                Privacy policy
              </Link>
              .
            </p>

            <footer className="mt-8 text-center text-sm text-muted">
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
          </section>
        </div>
      </div>
    </main>
  );
}
