import { Copy, Layers, ScrollText, Search, Smartphone, Timer } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';

const FEATURES = [
  {
    icon: Search,
    title: 'Search everything',
    body: 'One field over your entire Drive, with chips to narrow by docs, sheets, slides or PDFs.',
  },
  {
    icon: Layers,
    title: 'Shelves',
    body: 'Group the files you are living in this month. Name them, colour them, reorder them.',
  },
  {
    icon: Timer,
    title: 'Expiring links',
    body: 'Pick a date when you share. The link revokes itself, whether or not you remember.',
  },
  {
    icon: Copy,
    title: 'Copy for client',
    body: 'Duplicate a template into a named copy in one action, ready to fill in and send.',
  },
  {
    icon: ScrollText,
    title: 'Share log',
    body: 'Every link you have sent, who it went to, when it lapses — and a button to end it now.',
  },
  {
    icon: Smartphone,
    title: 'Installs like an app',
    body: 'Add it to your home screen and it opens full-screen, no browser chrome in the way.',
  },
] as const;

/** 2x3 on phones and up; a flat grid, one tinted glyph each. */
export default function Features() {
  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal as="h2" className="text-center text-xl font-semibold tracking-tight sm:text-[28px]">
          Everything it does
        </Reveal>

        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal as="li" index={i % 3} key={feature.title}>
              <div className="h-full rounded-md border border-subtle surface p-4 sm:p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-accent-600/10 text-accent">
                  <feature.icon aria-hidden="true" className="h-[18px] w-[18px]" />
                </span>
                <h3 className="mt-3 text-sm font-semibold leading-snug sm:text-base">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted sm:text-sm">
                  {feature.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
