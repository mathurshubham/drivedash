'use client';

import { Chip, ChipGroup } from '@/components/ui/Chip';
import type { ExpiryDays } from '@/lib/types';

const OPTIONS: { value: ExpiryDays; key: string; label: string }[] = [
  { value: 1, key: '1', label: '1 day' },
  { value: 3, key: '3', label: '3 days' },
  { value: 7, key: '7', label: '7 days' },
  { value: null, key: 'none', label: 'No expiry' },
];

function fromKey(key: string): ExpiryDays {
  const match = OPTIONS.find((o) => o.key === key);
  return match ? match.value : null;
}

export default function ExpiryChips({
  value,
  onChange,
}: {
  value: ExpiryDays;
  onChange: (next: ExpiryDays) => void;
}) {
  const active = value === null ? 'none' : String(value);

  return (
    <ChipGroup
      label="Expires in"
      value={active}
      onValueChange={(next) => onChange(fromKey(next))}
      className="flex-wrap"
    >
      {OPTIONS.map((opt) => (
        <Chip key={opt.key} value={opt.key} onSelect={() => onChange(opt.value)}>
          {opt.label}
        </Chip>
      ))}
    </ChipGroup>
  );
}
