import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { Screen, Txt } from '@/components/ui';
import { useReducedMotion } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';
import product from '../../shared/product.json';

/** One short choreography: arrive, connect, radiate, then reveal the questions. */
export function OnboardingTransition() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [time] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) { time.setValue(0.55); return; }
    time.setValue(0);
    const animation = Animated.timing(time, { toValue: 1, duration: product.onboardingTransition.durationMs, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [reduced, time]);
  const curve = (inputRange: number[], outputRange: number[]) => time.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });
  return <Screen scroll={false} keyboard={false} contentStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Animated.View accessible accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: 24, maxWidth: 420, opacity: reduced ? 1 : curve([0, 0.08, 0.9, 1], [0, 1, 1, 0]) }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 224, height: 224, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: colors.primarySoft, opacity: 0.55 }} />
        {[0, 1].map(i => <Animated.View key={i} style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: colors.primary, opacity: reduced ? 0.15 : curve([0, 0.25 + i * 0.12, 0.48 + i * 0.12, 1], [0, 0, 0.32, 0]), transform: [{ scale: reduced ? 1 + i * 0.2 : curve([0, 0.25 + i * 0.12, 1], [0.7, 0.7, 1.65]) }] }} />)}
        {[-1, 1].map(side => <Animated.View key={side} style={{ position: 'absolute', transform: [{ translateX: reduced ? side * 18 : curve([0, 0.16, 0.42, 0.55, 0.72, 1], [side * 58, side * 58, side * 15, side * 20, side * 18, side * 18]) }, { translateY: side * 7 }, { rotate: `${side * 14}deg` }, { scale: reduced ? 1 : curve([0, 0.16, 0.42, 0.55, 0.72, 1], [0.7, 0.9, 1.08, 0.97, 1, 1]) }] }}>
          <Txt style={{ fontSize: 64, lineHeight: 80, color: side < 0 ? colors.primary : colors.primaryStrong }}>♥</Txt>
        </Animated.View>)}
        {[0, 1, 2, 3].map(i => <Animated.View key={i} style={{ position: 'absolute', opacity: reduced ? 0.4 : curve([0, 0.4, 0.55, 0.88], [0, 0, 0.8, 0]), transform: [{ translateX: (i % 2 ? 1 : -1) * (i < 2 ? 80 : 59) }, { translateY: (i < 2 ? -1 : 1) * 62 }, { scale: reduced ? 1 : curve([0, 0.4, 0.6, 1], [0, 0, 1, 0.5]) }] }}><Txt style={{ fontSize: i < 2 ? 21 : 14, color: colors.primary }}>✦</Txt></Animated.View>)}
      </View>
      <View style={{ gap: 10 }}>
        <Txt variant="title" center>{product.onboardingTransition.title}</Txt>
        <Txt tone="secondary" center>{product.onboardingTransition.message}</Txt>
      </View>
    </Animated.View>
  </Screen>;
}
