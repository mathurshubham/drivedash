import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';

/**
 * The trust band. Restated plainly rather than hedged, because the claim is
 * literally true of the architecture: there is no application database.
 */
export default function PrivateByDesign() {
  return (
    <section className="px-6 py-16 sm:py-20">
      <Reveal className="mx-auto max-w-6xl">
        <div className="rounded-lg border border-subtle surface-2 p-8 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent-600/10 text-accent">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight sm:text-[28px]">
                Private by design
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
                Nothing about your files is stored on our side. Your shelves and your share log are
                JSON files in your own Drive, in the hidden folder this app owns; your session is an
                encrypted cookie in your browser. The only thing kept on the server is a 30-seat
                registry of who is allowed in — an email address and whether it is approved.
              </p>
              <p className="mt-4 text-sm">
                <Link
                  href="/privacy"
                  className="font-medium text-accent underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Read the privacy policy
                </Link>
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
