import Reveal from '@/components/landing/Reveal';

const STEPS = [
  {
    title: 'Sign in with Google',
    body: 'DriveDash reads your own Drive, on your instruction, and nothing else. No new account, no upload, no migration.',
  },
  {
    title: 'Pin what you use',
    body: 'Long-press a file to pin it to a shelf. Shelves are yours to name, colour and reorder — the ten files you live in, one tap from the home screen.',
  },
  {
    title: 'Share with expiry',
    body: 'Send a link that stops working on a date you choose. Every link you have ever sent is listed, with its expiry, ready to revoke.',
  },
] as const;

/** The three-step explanation, numbered so the order is the point. */
export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-8 px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal as="h2" className="text-center text-xl font-semibold tracking-tight sm:text-[28px]">
          Three steps, then it is just there
        </Reveal>

        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal as="li" index={i} key={step.title}>
              <div className="h-full rounded-md border border-subtle surface p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-600 text-sm font-semibold tabular text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold leading-snug">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
