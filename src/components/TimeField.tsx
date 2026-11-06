import React, { useState } from 'react';

import { Input } from '@/components/ui';

/** HH:mm text field with validation; native time pickers can replace it later. */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  return (
    <Input
      label={label}
      value={text}
      placeholder="HH:mm"
      keyboardType="numbers-and-punctuation"
      error={error}
      onChangeText={(v) => {
        setText(v);
        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) {
          setError(null);
          onChange(v);
        } else setError('Use 24-hour HH:mm');
      }}
    />
  );
}
