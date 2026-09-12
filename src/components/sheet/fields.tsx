'use client';

import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import ExpiryChips from '@/components/ExpiryChips';
import { TOOLTIP_COPY } from '@/components/onboarding/tooltipCopy';
import Pressable from '@/components/ui/Pressable';
import Toggletip from '@/components/ui/Toggletip';
import type { ExpiryDays } from '@/lib/types';

/** Shared input skin for every sheet form. */
export const inputClass =
  'min-h-11 w-full rounded-sm border border-subtle surface px-3 text-sm text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent';

/** Google caps the share notification note; mirrored here so the counter is honest. */
export const MESSAGE_MAX = 500;

export function SubView({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center gap-1">
        <Pressable
          variant="ghost"
          aria-label="Back"
          onClick={onBack}
          className="w-11 shrink-0 rounded-md px-0 text-muted"
        >
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </Pressable>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function ExpiryField({
  value,
  onChange,
}: {
  value: ExpiryDays;
  onChange: (next: ExpiryDays) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium">Link expiry</span>
        <Toggletip label="About link expiry">{TOOLTIP_COPY.expiryChips}</Toggletip>
      </div>
      <ExpiryChips value={value} onChange={onChange} />
    </div>
  );
}

export function NotifyToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5 accent-accent-600"
        />
        Notify by email
      </label>
      <Toggletip label="About the notify toggle">{TOOLTIP_COPY.notifyToggle}</Toggletip>
    </div>
  );
}

export function MessageField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        Message
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={MESSAGE_MAX}
        rows={3}
        placeholder="Optional note included in Google's email"
        className={`${inputClass} min-h-[72px] py-2`}
      />
      <p className="tabular text-right text-xs text-muted">
        {value.length}/{MESSAGE_MAX}
      </p>
    </div>
  );
}

export function SubmitRow({
  label,
  busyLabel,
  busy,
  disabled,
  onBack,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled?: boolean;
  onBack: () => void;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <Pressable variant="primary" type="submit" loading={busy} disabled={disabled}>
        {busy ? busyLabel : label}
      </Pressable>
      <Pressable variant="ghost" onClick={onBack}>
        Back
      </Pressable>
    </div>
  );
}
