'use client';

import { Chip, ChipGroup } from '@/components/ui/Chip';
import type { SearchType } from '@/lib/types';

const TYPES: { value: SearchType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'slides', label: 'Slides' },
  { value: 'docs', label: 'Docs' },
  { value: 'sheets', label: 'Sheets' },
  { value: 'pdf', label: 'PDF' },
  { value: 'pptx', label: 'PPTX' },
  { value: 'docx', label: 'DOCX' },
  { value: 'xlsx', label: 'XLSX' },
];

export default function TypeChips({
  value,
  onChange,
}: {
  value: SearchType;
  onChange: (next: SearchType) => void;
}) {
  return (
    // The scroller is the wrapper, not the group: the sliding indicator is
    // positioned against the group's own box, which must not scroll under it.
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-1">
      <ChipGroup
        label="Filter by file type"
        value={value}
        onValueChange={(next) => onChange(next as SearchType)}
        className="w-max"
      >
        {TYPES.map((t) => (
          <Chip key={t.value} value={t.value} onSelect={() => onChange(t.value)}>
            {t.label}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  );
}
