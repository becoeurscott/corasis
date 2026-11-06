import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Txt } from './Text';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  right?: React.ReactNode;
}

export function Input({ label, error, hint, right, style, multiline, ...rest }: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? (
        <Txt variant="caption" tone="secondary" weight="600">
          {label}
        </Txt>
      ) : null}
      <View
        style={[
          styles.field,
          { backgroundColor: colors.surface, borderColor: error ? colors.danger : focused ? colors.focus : colors.border, borderWidth: focused || error ? 2 : 1 },
          multiline && { minHeight: 110, alignItems: 'flex-start', paddingVertical: spacing.md },
        ]}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...rest}
          style={[styles.input, { color: colors.text }, multiline && { height: 'auto', minHeight: 80 }, style]}
        />
        {right}
      </View>
      {error ? (
        <Txt variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="caption" tone="muted">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  field: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 52 },
  input: { flex: 1, fontSize: 16, paddingVertical: spacing.md },
});
