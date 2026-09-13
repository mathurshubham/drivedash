'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { AlertTriangle, Check } from 'lucide-react';
import Pressable from '@/components/ui/Pressable';
import Sheet from '@/components/ui/Sheet';
import { deleteAccount } from '@/lib/client';
import type { AccountDeleteStep, AccountDeleteStepName } from '@/lib/types';

/** How long the armed danger button stays armed before disarming itself. */
const ARM_MS = 4000;

const STEP_LABEL: Record<AccountDeleteStepName, string> = {
  revokeShares: 'Revoking your links',
  appDataFiles: 'Deleting your two app files',
  registry: 'Releasing your seat',
  googleAccess: "Removing DriveDash's access",
};

/** The order the server runs them in, so the list does not reshuffle as it goes. */
const STEP_ORDER: AccountDeleteStepName[] = [
  'revokeShares',
  'appDataFiles',
  'registry',
  'googleAccess',
];

const DELETED = [
  "Your shelves and share log (two files in your Drive's hidden app folder)",
  'Your seat in DriveDash',
  "DriveDash's access to your Google account",
];

const KEPT = ['Your Drive files', 'Copies in Client Shares', 'Links you shared outside DriveDash'];

export interface DeleteDataSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Delete my data": one sheet that says plainly what goes and what stays, then
 * does it.
 *
 * The confirmation is a two-tap danger button rather than a typed phrase or a
 * second dialog — enough to make the tap deliberate without theatre. Copy is
 * flat and specific; the only red on the screen is the button itself.
 *
 * Progress is shown per step because the server reports per step: a partly
 * failed deletion is the one outcome the user must not be lied to about.
 */
export default function DeleteDataSheet({ open, onOpenChange }: DeleteDataSheetProps) {
  const [revokeShares, setRevokeShares] = useState(true);
  const [armed, setArmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<AccountDeleteStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The arming window owns its own timer: disarming is just `setArmed(false)`
  // anywhere, and the cleanup cancels the pending one. No ref to keep in sync.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARM_MS);
    return () => clearTimeout(t);
  }, [armed]);

  // Closing and reopening must not leave a primed delete button behind.
  // Adjusted during render (React's documented "derive from a prop" pattern,
  // the same one `Sheet` uses) rather than in an effect, which would paint the
  // armed label once before clearing it.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setArmed(false);
  }

  const expected = revokeShares ? STEP_ORDER : STEP_ORDER.filter((s) => s !== 'revokeShares');
  const done = steps !== null;
  const failures = steps?.filter((s) => !s.ok) ?? [];

  async function run() {
    setArmed(false);
    setRunning(true);
    setError(null);
    try {
      const result = await deleteAccount({ revokeShares });
      setSteps(result.steps);
      // A moment on the finished list, then out. The redirect target is the
      // public landing page, which shows the confirmation banner.
      setTimeout(() => {
        void signOut({ redirectTo: '/about?deleted=1' });
      }, 1200);
    } catch (e) {
      setRunning(false);
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  function onDangerTap() {
    if (running || done) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    void run();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Delete my data">
      <div className="flex flex-col gap-5 pb-2">
        {running || done ? (
          <Progress expected={expected} steps={steps} failures={failures.length} />
        ) : (
          <>
            <List title="Deleted" items={DELETED} />
            <List title="Kept" items={KEPT} />

            <label className="flex items-start gap-3 rounded-md border border-subtle px-3 py-3 text-[15px] text-fg">
              <input
                type="checkbox"
                checked={revokeShares}
                onChange={(e) => setRevokeShares(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-danger)]"
              />
              <span>Also revoke every link created through DriveDash</span>
            </label>

            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Pressable variant="danger" size="lg" block onClick={onDangerTap}>
                {armed ? 'Tap again to delete everything' : 'Delete my data'}
              </Pressable>
              <Pressable variant="ghost" block onClick={() => onOpenChange(false)}>
                Cancel
              </Pressable>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-[15px] text-fg">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true" className="text-muted">
              ·
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Progress({
  expected,
  steps,
  failures,
}: {
  expected: AccountDeleteStepName[];
  steps: AccountDeleteStep[] | null;
  failures: number;
}) {
  return (
    <section aria-live="polite">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {steps ? 'Done' : 'Deleting'}
      </h3>
      <ul className="mt-2 space-y-2 text-[15px] text-fg">
        {expected.map((name) => {
          const result = steps?.find((s) => s.step === name);
          return (
            <li key={name} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                {!result ? (
                  <Spinner />
                ) : result.ok ? (
                  <Check aria-hidden="true" className="h-4 w-4 text-success" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="h-4 w-4 text-warn" />
                )}
              </span>
              <span>
                {STEP_LABEL[name]}
                {result?.ok === false ? (
                  <span className="block text-sm text-muted">{result.detail ?? "didn't finish"}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {steps ? (
        <p className="mt-4 text-sm text-muted">
          {failures === 0
            ? 'Your data is gone. Signing you out…'
            : 'Some steps did not finish — the rest did. Signing you out…'}
        </p>
      ) : null}
    </section>
  );
}

/** Matches `Pressable`'s spinner; stops spinning under reduced motion. */
function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin motion-reduce:animate-none text-muted"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
