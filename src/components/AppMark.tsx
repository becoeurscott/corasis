import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * Original app mark: two overlapping rounded "pebbles" that form a soft knot.
 * Pure views, so it renders everywhere and recolors with the theme.
 */
export function AppMark({ size = 96, onLight = false }: { size?: number; onLight?: boolean }) {
  const { colors } = useTheme();
  const fill = onLight ? colors.primary : '#FFFFFF';
  const r = size / 2;
  const pebble = size * 0.5;
  return (
    <View accessibilityRole="image" accessibilityLabel="Together app mark" style={{ width: size, height: size, borderRadius: r, backgroundColor: onLight ? colors.primarySoft : 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: pebble, height: pebble, borderRadius: pebble / 2, backgroundColor: fill, opacity: 0.95, transform: [{ translateX: -pebble * 0.22 }, { translateY: -pebble * 0.08 }] }} />
      <View style={{ position: 'absolute', width: pebble, height: pebble, borderRadius: pebble / 2, backgroundColor: fill, opacity: 0.75, transform: [{ translateX: pebble * 0.22 }, { translateY: pebble * 0.08 }] }} />
      <View style={{ position: 'absolute', width: pebble * 0.36, height: pebble * 0.36, borderRadius: pebble * 0.18, backgroundColor: onLight ? colors.primaryStrong : colors.gradientEnd, opacity: 0.9 }} />
    </View>
  );
}
