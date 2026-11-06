import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { Input, Txt } from '@/components/ui';
import { formatDate } from '@/lib/time';

interface Props {
  label: string;
  value: string | null; // YYYY-MM-DD
  onChange: (v: string | null) => void;
  hint?: string;
  optional?: boolean;
  minToday?: boolean;
}

/**
 * Date entry as YYYY-MM-DD. Uses the browser's native date input on web and a
 * validated text field on native (keeps the component dependency-free and
 * fully keyboard accessible).
 */
export function DateField({ label, value, onChange, hint, optional, minToday }: Props) {
  const [text, setText] = useState(value ?? '');
  const [error, setError] = useState<string | null>(null);
  const commit = (v: string) => {
    setText(v);
    const clean = v.trim();
    if (!clean) {
      setError(optional ? null : 'Enter a date.');
      onChange(null);
      return;
    }
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(clean) && !Number.isNaN(Date.parse(clean + 'T00:00:00Z'));
    if (!ok) {
      setError('Use the format YYYY-MM-DD.');
      onChange(null);
      return;
    }
    if (minToday && clean < new Date().toISOString().slice(0, 10)) {
      setError('That date is in the past.');
      onChange(null);
      return;
    }
    setError(null);
    onChange(clean);
  };
  return (
    <View style={{ gap: 4 }}>
      <Input
        label={label}
        value={text}
        onChangeText={commit}
        placeholder="YYYY-MM-DD"
        keyboardType={Platform.OS === 'web' ? undefined : 'numbers-and-punctuation'}
        autoCapitalize="none"
        error={error}
        hint={hint}
        {...(Platform.OS === 'web' ? ({ type: 'date' } as object) : {})}
      />
      {value && !error ? (
        <Txt variant="caption" tone="muted">
          {formatDate(value, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </Txt>
      ) : null}
    </View>
  );
}
