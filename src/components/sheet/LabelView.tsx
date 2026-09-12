'use client';

import { useId, useState } from 'react';
import { SubView, SubmitRow, inputClass } from '@/components/sheet/fields';

export interface LabelViewProps {
  /** The label currently stored for the pinned item, if any. */
  initial: string;
  /** Shown as the placeholder: the real file name. */
  fileName: string;
  onSave: (label: string) => void;
  onBack: () => void;
}

export default function LabelView({ initial, fileName, onSave, onBack }: LabelViewProps) {
  const id = useId();
  const [label, setLabel] = useState(initial);

  return (
    <SubView title="Set label" onBack={onBack}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(label);
        }}
      >
        <label htmlFor={id} className="block text-sm font-medium">
          Label (shown instead of the file name)
        </label>
        <input
          id={id}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={fileName}
          className={inputClass}
        />
        <SubmitRow label="Save" busyLabel="Saving…" busy={false} onBack={onBack} />
        <p className="text-xs text-muted">Leave empty to clear the label.</p>
      </form>
    </SubView>
  );
}
