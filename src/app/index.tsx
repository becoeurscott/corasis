import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { AppMark } from '@/components/AppMark';
import { Gradient, Txt } from '@/components/ui';
import { resolveStartRoute } from '@/lib/routing';
import { backend, useData } from '@/services/backend';
import { useHydrated } from '@/store/hooks';
import { usePrefs } from '@/store/prefs';

/** Splash: original mark, subtle animation, then route by saved state. */
export default function SplashRoute() {
  const prefsHydrated = usePrefs((s) => s.hydrated);
  const dataHydrated = useHydrated();
  const reduceMotion = usePrefs((s) => s.reduceMotion);
  const [scale] = useState(() => new Animated.Value(0.8));
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.05, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const t = setTimeout(() => pulse.start(), 600);
    return () => {
      clearTimeout(t);
      pulse.stop();
    };
  }, [opacity, scale, reduceMotion]);

  useEffect(() => {
    if (!prefsHydrated || !dataHydrated) return;
    const t = setTimeout(() => {
      const { session, onboarding, pendingInviteCode } = useData.getState();
      const route = resolveStartRoute({ theme: usePrefs.getState().theme, onboarding, session, couple: backend.couple(), pendingInviteCode });
      router.replace(route as never);
    }, reduceMotion ? 200 : 1100);
    return () => clearTimeout(t);
  }, [prefsHydrated, dataHydrated, reduceMotion]);

  return (
    <Gradient style={styles.root}>
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center', gap: 16 }}>
        <AppMark size={112} />
        <Txt variant="display" style={{ color: '#fff' }}>
          Corasis
        </Txt>
      </Animated.View>
      <View style={styles.footer}>
        <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
          A little space for the two of you
        </Txt>
      </View>
    </Gradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: 48 },
});
