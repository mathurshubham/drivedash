'use client';

import { useId, useState } from 'react';
import {
  ExpiryField,
  Field,
  MessageField,
  NotifyToggle,
  SubView,
  SubmitRow,
  fieldLabelClass,
  inputClass,
} from '@/components/sheet/fields';
import type { ExpiryDays, ShareMode } from '@/lib/types';

export interface CopyForClientSubmit {
  clientName: string;
  share: ShareMode;
  email: string;
  notify: boolean;
  message: string;
  expiry: ExpiryDays;
}

export interface CopyForClientViewProps {
  busy: boolean;
  onCopy: (values: CopyForClientSubmit) => void;
  onBack: () => void;
}

const MODES: [ShareMode, string][] = [
  ['anyone', 'Anyone with the link'],
  ['email', 'A specific email'],
  ['none', "Don't share"],
];

export default function CopyForClientView({ busy, onCopy, onBack }: CopyForClientViewProps) {
  const id = useId();
  const [clientName, setClientName] = useState('');
  const [share, setShare] = useState<ShareMode>('anyone');
  const [email, setEmail] = useState('');
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState('');
  const [expiry, setExpiry] = useState<ExpiryDays>(3);

  return (
    <SubView
      title="Copy for a client"
      subtitle="Makes a copy in Client Shares and shares that copy, so the original stays untouched."
      onBack={onBack}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onCopy({
            clientName: clientName.trim(),
            share,
            email: email.trim(),
            notify,
            message,
            expiry,
          });
        }}
      >
        <Field label="Client name" htmlFor={`${id}-client`}>
          <input
            id={`${id}-client`}
            required
            maxLength={80}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Acme Ltd"
            className={inputClass}
          />
        </Field>

        <fieldset className="space-y-1">
          <legend className={fieldLabelClass}>Share the copy</legend>
          {MODES.map(([value, text]) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-2 text-sm hover:surface-2"
            >
              <input
                type="radio"
                name={`${id}-share-mode`}
                value={value}
                checked={share === value}
                onChange={() => setShare(value)}
                className="h-4 w-4 accent-accent-600"
              />
              {text}
            </label>
          ))}
        </fieldset>

        {share === 'email' ? (
          <div className="space-y-4">
            <Field label="Their email" htmlFor={`${id}-client-email`}>
              <input
                id={`${id}-client-email`}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className={inputClass}
              />
            </Field>
            <NotifyToggle checked={notify} onChange={setNotify} />
            {notify ? (
              <MessageField id={`${id}-copy-msg`} value={message} onChange={setMessage} />
            ) : null}
          </div>
        ) : null}

        {share !== 'none' ? <ExpiryField value={expiry} onChange={setExpiry} /> : null}

        <SubmitRow
          label="Create copy"
          busyLabel="Copying…"
          busy={busy}
          disabled={!clientName.trim()}
          onBack={onBack}
        />
      </form>
    </SubView>
  );
}
