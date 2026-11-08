import { useReducedMotion } from '@/lib/motion';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

const GAP = 10;
const DOT = 4;

/** Dots marching from one partner to the other. Fills its parent's width; overflow is clipped. */
export function DottedConnector({ width }: { width: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [shift] = useState(() => new Animated.Value(0));
  useEffect(() => {
    shift.setValue(0);
    if (reduced) return;
    const loop = Animated.loop(Animated.timing(shift, { toValue: GAP, duration: 700, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web', isInteraction: false }));
    loop.start();
    return () => loop.stop();
  }, [shift, reduced]);
  const count = Math.ceil(width / GAP) + 2;
  return (
    <View pointerEvents="none" style={{ width, height: DOT, overflow: 'hidden' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ flexDirection: 'row', marginLeft: -GAP, transform: [{ translateX: shift }] }}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={{ width: DOT, height: DOT, borderRadius: DOT / 2, marginRight: GAP - DOT, backgroundColor: colors.primary, opacity: 0.35 + 0.5 * ((i % 3) / 2) }} />
        ))}
      </Animated.View>
    </View>
  );
}
