import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useReducedMotion } from '@/lib/motion';
import { useAffection } from '@/store/affection';

/** Full-screen layer: each burst sends many copies of the emoji floating up and fading out. */
export function AffectionRain() {
  const bursts = useAffection((s) => s.bursts);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.map((b) => <Burst key={b.id} id={b.id} emoji={b.emoji} />)}
    </View>
  );
}

function Burst({ id, emoji }: { id: string; emoji: string }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const done = useAffection((s) => s.done);
  // Random positions are picked once, when the burst starts.
  const [particles] = useState(
    () => Array.from({ length: reduced ? 1 : 18 }, () => ({
      x: reduced ? width / 2 - 48 : 24 + Math.random() * Math.max(1, width - 72),
      delay: reduced ? 0 : Math.random() * 800,
      size: reduced ? 96 : 30 + Math.random() * 30,
      drift: (Math.random() - 0.5) * 120,
      spin: (Math.random() - 0.5) * 80,
      duration: 2200 + Math.random() * 1200,
      progress: new Animated.Value(0),
    })),
  );
  const finished = useRef(false);
  useEffect(() => {
    Animated.parallel(particles.map((p) => Animated.timing(p.progress, { toValue: 1, duration: reduced ? 1500 : p.duration, delay: p.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }))).start(() => {
      if (!finished.current) { finished.current = true; done(id); }
    });
  }, [particles, reduced, done, id]);
  return (
    <>
      {particles.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: p.x, top: reduced ? height / 2 - 48 : height,
          opacity: p.progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.9, 0] }),
          transform: reduced ? [] : [
            { translateY: p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -(height + 120)] }) },
            { translateX: p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
            { rotate: p.progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
          ],
        }}>
          <Text style={{ fontSize: p.size }}>{emoji}</Text>
        </Animated.View>
      ))}
    </>
  );
}
