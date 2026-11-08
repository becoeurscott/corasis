import React from 'react';
import { View } from 'react-native';

import { Txt } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

/** A drawn battery whose fill follows the level: green, orange at 20 % or less, red at 10 % or less. */
export function BatteryGauge({ percent, charging = false }: { percent: number; charging?: boolean }) {
  const { colors } = useTheme();
  const level = Math.max(0, Math.min(100, Math.round(percent)));
  const fill = charging ? colors.success : level <= 10 ? colors.danger : level <= 20 ? colors.warning : colors.success;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Battery ${level} percent${charging ? ', charging' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 24, height: 12, borderRadius: 3, borderWidth: 1.5, borderColor: colors.textMuted, padding: 1.5, justifyContent: 'center' }}>
          <View style={{ width: `${Math.max(level, 4)}%`, height: '100%', borderRadius: 1.5, backgroundColor: fill }} />
        </View>
        <View style={{ width: 2, height: 5, marginLeft: 1, borderTopRightRadius: 1, borderBottomRightRadius: 1, backgroundColor: colors.textMuted }} />
      </View>
      <Txt variant="caption" tone={level <= 10 && !charging ? 'danger' : 'muted'} style={{ fontVariant: ['tabular-nums'] }}>
        {charging ? '⚡' : ''}
        {level}%
      </Txt>
    </View>
  );
}
