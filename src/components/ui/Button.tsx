import { MotionPressable } from '@/components/ui/MotionPressable';
import React from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';

import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/theme/tokens';
import { Txt } from './Text';

type PressState = { pressed: boolean; focused?: boolean };

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'md' | 'lg' | 'sm';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  accessibilityHint?: string;
  testID?: string;
  full?: boolean;
}

export function Button({ title, onPress, variant = 'primary', size = 'md', disabled, loading, icon, style, accessibilityHint, testID, full = true }: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const bg =
    variant === 'primary' ? colors.primary
    : variant === 'secondary' ? colors.primarySoft
    : variant === 'danger' ? colors.dangerSoft
    : 'transparent';
  const fg =
    variant === 'primary' ? colors.onPrimary
    : variant === 'danger' ? colors.danger
    : colors.primary;
  const height = size === 'lg' ? 56 : size === 'sm' ? touchTarget : 50;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityHint={accessibilityHint}
      testID={testID}
      disabled={isDisabled}
      onPress={() => {
        haptic('light');
        onPress?.();
      }}
      style={({ focused }: PressState) => [
        styles.base,
        { backgroundColor: bg, height, borderRadius: radius.pill, opacity: isDisabled ? 0.5 : 1 },
        variant === 'outline' && { borderWidth: 1.5, borderColor: colors.primary },
        focused && { borderWidth: 2, borderColor: colors.focus },
        !full && { alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Txt variant={size === 'sm' ? 'caption' : 'bodyStrong'} style={{ color: fg, fontWeight: '700' }}>
            {title}
          </Txt>
        </View>
      )}
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, minHeight: touchTarget },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
