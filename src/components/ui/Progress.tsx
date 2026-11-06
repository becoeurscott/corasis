import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }} style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: colors.primary }} />
    </View>
  );
}
