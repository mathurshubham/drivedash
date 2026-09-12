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
    <main className="flex flex-1 animate-fade-in justify-center p-6 pt-safe pb-safe">
      <article className="w-full max-w-[640px]">
        <div className="rounded-lg border border-subtle surface p-7 shadow-pop">
          <header>
            <p className="text-sm font-medium text-accent">DriveDash</p>
            <h1 className="mt-1 text-xl font-semibold leading-[1.3] tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted">Last updated {lastUpdated}</p>
          </header>

          <div className="mt-6 space-y-4 text-base leading-[1.6] text-fg [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-[1.3] [&_section+section]:mt-6">
            {children}
          </div>

          <footer className="mt-8 border-t border-subtle pt-5 text-sm">
            <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
              {otherLinks.map((link, index) => (
                <span key={link.href} className="inline-flex items-center gap-3">
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-muted">
                      ·
                    </span>
                  ) : null}
                  <Link
                    href={link.href}
                    className="min-h-11 inline-flex items-center underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {link.label}
                  </Link>
                </span>
              ))}
              <span aria-hidden="true" className="text-muted">
                ·
              </span>
              <Link
                href="/login"
                className="min-h-11 inline-flex items-center underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent"
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
