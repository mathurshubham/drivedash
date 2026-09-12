import Pressable, { Link } from '@/components/ui/Pressable';
import Reveal from '@/components/landing/Reveal';
import PhoneMockup from '@/components/landing/PhoneMockup';

/**
 * Landing hero: the promise, the one action, and a still of the product.
 * Two columns from 1024px, stacked below, with the phone dropping under the
 * copy rather than shrinking.
 */
export default function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-16 pt-safe sm:pb-20">
      {/* Same CSS blob as the login page — decoration only, no motion under
          `prefers-reduced-motion` (handled in globals.css). */}
      <div
        aria-hidden="true"
        className="login-blob pointer-events-none absolute inset-x-0 -top-24 h-[420px] w-full motion-reduce:animate-none"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 pt-14 lg:grid-cols-2 lg:gap-16 lg:pt-20">
        <Reveal className="text-center lg:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">DriveDash</p>
          <h1 className="mt-3 text-[40px] font-bold leading-[1.1] tracking-tight lg:text-[56px]">
            Your Drive, one thumb away.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted lg:text-lg">
            Pin the files you actually use to shelves, find anything in your whole Drive in a tap,
            and hand clients a link that expires on its own.
          </p>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Pressable as={Link} href="/login" variant="primary" size="lg">
              Sign in with Google
            </Pressable>
            <Pressable as="a" href="#how-it-works" variant="ghost" size="lg">
              How it works
            </Pressable>
          </div>
        </Reveal>

        <Reveal index={1} className="flex justify-center lg:justify-end">
          <PhoneMockup />
        </Reveal>
      </div>
    </section>
  );
}
