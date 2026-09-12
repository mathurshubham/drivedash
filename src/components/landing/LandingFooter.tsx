import Link from 'next/link';

const LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

export default function LandingFooter() {
  return (
    <footer className="border-t border-subtle px-6 py-10 pb-safe">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-sm text-muted sm:flex-row sm:justify-between">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center underline-offset-4 hover:text-fg hover:underline focus-visible:ring-2 focus-visible:ring-accent"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:text-fg hover:underline focus-visible:ring-2 focus-visible:ring-accent"
          >
            Sign in
          </Link>
        </nav>
        <p>Made by Shubham Mathur</p>
      </div>
    </footer>
  );
}
