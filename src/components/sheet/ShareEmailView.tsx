'use client';

import { useId, useState } from 'react';
import {
  ExpiryField,
  MessageField,
  NotifyToggle,
  SubView,
  SubmitRow,
  inputClass,
} from '@/components/sheet/fields';
import type { ExpiryDays } from '@/lib/types';

export interface ShareEmailSubmit {
  email: string;
  notify: boolean;
  message: string;
  expiry: ExpiryDays;
}

export interface ShareEmailViewProps {
  busy: boolean;
  onShare: (values: ShareEmailSubmit) => void;
  onBack: () => void;
}

export default function ShareEmailView({ busy, onShare, onBack }: ShareEmailViewProps) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState('');
  const [expiry, setExpiry] = useState<ExpiryDays>(3);

  return (
    <SubView title="Share to email" onBack={onBack}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onShare({ email: email.trim(), notify, message, expiry });
        }}
      >
        <div className="space-y-1">
          <label htmlFor={`${id}-email`} className="block text-sm font-medium">
            Share with email
          </label>
          <input
            id={`${id}-email`}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className={inputClass}
          />
        </div>

        <NotifyToggle checked={notify} onChange={setNotify} />
        {notify ? <MessageField id={`${id}-msg`} value={message} onChange={setMessage} /> : null}

        <ExpiryField value={expiry} onChange={setExpiry} />
        <SubmitRow
          label="Share"
          busyLabel="Sharing…"
          busy={busy}
          disabled={!email.trim()}
          onBack={onBack}
        />
      </form>
    </SubView>
  );
}
