import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * Dependency-free "gradient": two stacked tints with a soft diagonal blend.
 * Keeps the bundle small and renders identically on web and native.
 */
export function Gradient({ style, children, colors: override }: { style?: ViewStyle | ViewStyle[]; children?: React.ReactNode; colors?: [string, string] }) {
  const { colors } = useTheme();
  const [a, b] = override ?? [colors.gradientStart, colors.gradientEnd];
  return (
    <View style={[{ backgroundColor: b, overflow: 'hidden' }, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: a, opacity: 0.85, transform: [{ rotate: '-18deg' }, { translateY: -140 }, { scaleX: 1.6 }], borderBottomLeftRadius: 400, borderBottomRightRadius: 400 }]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: 0.12, transform: [{ rotate: '12deg' }, { translateY: 160 }, { scaleX: 1.8 }], borderTopLeftRadius: 400, borderTopRightRadius: 400 }]} />
      {children}
    </View>
  );
}
