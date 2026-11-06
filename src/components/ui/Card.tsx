import React from 'react';
import { Pressable, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

type PressState = { pressed: boolean; focused?: boolean };

interface CardProps extends ViewProps {
  tint?: boolean;
  onPress?: () => void;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
}

export function Card({ tint, onPress, padded = true, style, children, accessibilityLabel, ...rest }: CardProps) {
  const { colors, isDark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: tint ? colors.surfaceTint : colors.surface,
    borderRadius: radius.lg,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: isDark ? 0 : 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: isDark ? 0 : 2,
  };
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed, focused }: PressState) => [base, padded && styles.padded, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }, focused && { borderWidth: 2, borderColor: colors.focus }, style]}
        {...rest}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[base, padded && styles.padded, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ padded: { padding: spacing.lg } });
