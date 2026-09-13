'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Shown once, at the top of `/about`, after a successful "Delete my data".
 *
 * Deliberately not persisted: it confirms something that just happened in this
 * tab, and a banner that survived a reload would start reading as a claim about
 * the account rather than a receipt for one action.
 */
export default function DeletedBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div role="status" className="border-b border-subtle surface-2">
      <div className="mx-auto flex max-w-3xl items-start gap-3 px-4 py-3 pt-safe">
        <p className="flex-1 text-[15px] text-fg">
          Your DriveDash data was deleted. Your Drive files were not touched.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="-m-2 shrink-0 rounded-md p-2 text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
