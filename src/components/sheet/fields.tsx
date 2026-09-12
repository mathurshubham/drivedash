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

/** Section/field label: 13px, medium, muted. Sentence case — never uppercase. */
export const fieldLabelClass = 'block text-xs font-medium text-muted';

/** Google caps the share notification note; mirrored here so the counter is honest. */
export const MESSAGE_MAX = 500;

export function SubView({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  /** One line under the title saying what the form will actually do. */
  subtitle?: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 py-1">
      <div className="flex items-start gap-1">
        <Pressable
          variant="ghost"
          aria-label="Back"
          onClick={onBack}
          className="-ml-1 w-11 shrink-0 rounded-md px-0 text-muted"
        >
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </Pressable>
        <div className="min-w-0 flex-1 pt-2">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

/** A labelled block in a sheet form. The 16px rhythm comes from the parent's `space-y-4`. */
export function Field({
  label,
  htmlFor,
  info,
  children,
}: {
  label: string;
  htmlFor?: string;
  /** Optional `Toggletip` body rendered beside the label. */
  info?: { label: string; body: ReactNode };
  children: ReactNode;
}) {
  const text = htmlFor ? (
    <label htmlFor={htmlFor} className={fieldLabelClass}>
      {label}
    </label>
  ) : (
    <span className={fieldLabelClass}>{label}</span>
  );

  return (
    <div className="space-y-1.5">
      {info ? (
        <div className="flex items-center gap-1">
          {text}
          <Toggletip label={info.label}>{info.body}</Toggletip>
        </div>
      ) : (
        text
      )}
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
    <Field label="Expires in" info={{ label: 'About link expiry', body: TOOLTIP_COPY.expiryChips }}>
      <ExpiryChips value={value} onChange={onChange} />
    </Field>
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
    <Field label="Message" htmlFor={id}>
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
    </Field>
  );
}

/**
 * The end of every sheet form: one full-width primary action with the back
 * route demoted to a text button under it. Two side-by-side buttons read as a
 * choice between equals, which the old share form was not.
 */
export function SubmitRow({
  label,
  busyLabel,
  busy,
  disabled,
  onBack,
  backLabel = 'Back',
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled?: boolean;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <div className="space-y-1 pt-1">
      <Pressable variant="primary" size="lg" block type="submit" loading={busy} disabled={disabled}>
        {busy ? busyLabel : label}
      </Pressable>
      <BackButton onClick={onBack} label={backLabel} />
    </div>
  );
}

/** Text-weight back/dismiss control, full width so it lines up under the primary. */
export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <Pressable variant="ghost" block onClick={onClick} className="text-sm font-medium text-muted">
      {label}
    </Pressable>
  );
}
