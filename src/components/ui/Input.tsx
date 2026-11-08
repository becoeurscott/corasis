import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Txt } from './Text';

interface InputProps extends TextInputProps {
  label?: string;
  rounded?: boolean;
  error?: string | null;
  hint?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
}

export function Input({ rounded, label, error, hint, right, left, style, multiline, onFocus, onBlur, ...rest }: InputProps) {
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
          rounded && { borderRadius: 999 },
          { backgroundColor: colors.surface, borderColor: error ? colors.danger : focused ? colors.primary : colors.border, borderWidth: focused || error ? 2 : 1.5, paddingHorizontal: focused || error ? spacing.lg - 0.5 : spacing.lg },
          multiline && { minHeight: 110, alignItems: 'flex-start', paddingVertical: spacing.md },
        ]}>
        {left ? <View style={{ marginRight: spacing.sm }}>{left}</View> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          selectionColor={colors.primary}
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
  field: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 56 },
  input: { flex: 1, fontSize: 17, paddingVertical: spacing.md },
});
