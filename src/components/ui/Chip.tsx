import { MotionPressable } from '@/components/ui/MotionPressable';
import React from 'react';
import { StyleSheet } from 'react-native';

import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/theme/tokens';
import { Txt } from './Text';

type PressState = { pressed: boolean; focused?: boolean };

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  small?: boolean;
}

export function Chip({ label, selected, onPress, icon, small }: ChipProps) {
  const { colors } = useTheme();
  return (
    <MotionPressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        haptic('selection');
        onPress?.();
      }}
      disabled={!onPress}
      style={({ pressed, focused }: PressState) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surfaceTint,
          borderColor: selected ? colors.primary : colors.border,
          minHeight: small ? 32 : touchTarget,
        },
        focused && { borderColor: colors.focus, borderWidth: 2 },
      ]}>
      {icon}
      <Txt variant={small ? 'caption' : 'bodyStrong'} style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '600' }}>
        {selected ? '✓ ' : ''}
        {label}
      </Txt>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1 },
});
