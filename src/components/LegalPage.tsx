import Link from 'next/link';
import type { ReactNode } from 'react';

export type LegalPageKind = 'about' | 'privacy' | 'terms';

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  kind: LegalPageKind;
  children: ReactNode;
}

const PAGE_LINKS: { kind: LegalPageKind; href: string; label: string }[] = [
  { kind: 'about', href: '/about', label: 'About' },
  { kind: 'privacy', href: '/privacy', label: 'Privacy' },
  { kind: 'terms', href: '/terms', label: 'Terms' },
];

export default function LegalPage({ title, lastUpdated, kind, children }: LegalPageProps) {
  const otherLinks = PAGE_LINKS.filter((link) => link.kind !== kind);

  return (
    <main className="flex flex-1 justify-center p-6 pt-safe pb-safe">
      <article className="w-full max-w-lg">
        <div className="rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <header>
            <p className="text-sm font-medium text-accent-600 dark:text-accent-400">DriveDash</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Last updated {lastUpdated}
            </p>
          </header>

          <div className="prose-legal mt-6 space-y-4 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {children}
          </div>

          <footer className="mt-8 border-t border-neutral-200 pt-5 text-sm dark:border-neutral-800">
            <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-neutral-600 dark:text-neutral-400">
              {otherLinks.map((link, index) => (
                <span key={link.href} className="inline-flex items-center gap-3">
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">
                      ·
                    </span>
                  ) : null}
                  <Link
                    href={link.href}
                    className="min-h-[44px] inline-flex items-center underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:focus-visible:outline-accent-400"
                  >
                    {link.label}
                  </Link>
                </span>
              ))}
              <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">
                ·
              </span>
              <Link
                href="/login"
                className="min-h-[44px] inline-flex items-center underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:focus-visible:outline-accent-400"
              >
                Sign in
              </Link>
            </nav>
          </footer>
        </div>
      </article>
    </main>
  );
}
