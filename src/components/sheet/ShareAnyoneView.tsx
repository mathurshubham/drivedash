'use client';

import { useState } from 'react';
import { ExpiryField, SubView, SubmitRow } from '@/components/sheet/fields';
import type { ExpiryDays } from '@/lib/types';

export interface ShareAnyoneViewProps {
  busy: boolean;
  /** Called synchronously from the submit handler — the clipboard write depends on it. */
  onShare: (expiry: ExpiryDays) => void;
  onBack: () => void;
}

export default function ShareAnyoneView({ busy, onShare, onBack }: ShareAnyoneViewProps) {
  const [expiry, setExpiry] = useState<ExpiryDays>(3);

  return (
    <SubView title="Share a link" subtitle="Anyone with the link can view." onBack={onBack}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onShare(expiry);
        }}
      >
        <ExpiryField value={expiry} onChange={setExpiry} />
        <SubmitRow label="Create link" busyLabel="Creating…" busy={busy} onBack={onBack} />
      </form>
    </SubView>
  );
}
