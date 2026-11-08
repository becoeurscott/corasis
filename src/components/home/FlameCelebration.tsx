import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Animated, AppState, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useReducedMotion } from '@/lib/motion';
import { todayKey } from '@/lib/time';
import { backend, useData } from '@/services/backend';
import { useCouple } from '@/store/hooks';

/** Full-screen flame when both partners have sent today's moment. Once per day per phone. */
export function FlameCelebration() {
  const couple = useCouple();
  const moments = useData((s) => s.moments);
  const [show, setShow] = useState<number | null>(null);
  const today = couple ? todayKey(couple.coupleTimezone) : null;
  const done = !!couple && !!today && couple.memberIds.length === 2 && couple.memberIds.every((m) => moments.some((x) => x.coupleId === couple.id && x.authorId === m && x.dayKey === today));

  useEffect(() => {
    if (!done || !couple || !today) return;
    const key = `flame-celebrated-${couple.id}-${today}`;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = async () => {
      if (AppState.currentState !== 'active' || (await AsyncStorage.getItem(key))) return;
      timer = setTimeout(async () => {
        if (await AsyncStorage.getItem(key)) return;
        await AsyncStorage.setItem(key, '1');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setShow(backend.streak()?.current ?? 1);
      }, 900);
    };
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => { sub.remove(); if (timer) clearTimeout(timer); };
  }, [done, couple, today]);

  if (show == null) return null;
  return <FlameBurst days={show} onDone={() => setShow(null)} />;
}

function FlameBurst({ days, onDone }: { days: number; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [lit] = useState(() => new Animated.Value(0));
  const [flicker] = useState(() => new Animated.Value(0));
  const [embers] = useState(() => Array.from({ length: reduced ? 0 : 24 }, () => ({
    x: 20 + Math.random() * Math.max(1, width - 60), delay: Math.random() * 1200, size: 18 + Math.random() * 24,
    drift: (Math.random() - 0.5) * 100, duration: 1800 + Math.random() * 1200, p: new Animated.Value(0),
  })));
  useEffect(() => {
    Animated.spring(lit, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
    embers.forEach((e) => Animated.timing(e.p, { toValue: 1, duration: e.duration, delay: e.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start());
    const loop = reduced ? null : Animated.loop(Animated.sequence([
      Animated.timing(flicker, { toValue: 1, duration: 350, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(flicker, { toValue: 0, duration: 350, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop?.start();
    const t = setTimeout(onDone, 4200);
    return () => { loop?.stop(); clearTimeout(t); };
  }, [lit, flicker, embers, reduced, onDone]);
  const scale = Animated.multiply(lit.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] }), flicker.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.06] }));
  return (
    <Pressable onPress={onDone} style={StyleSheet.absoluteFill} accessibilityRole="alert" accessibilityLabel={`Flame day ${days}. You both sent today's moment.`}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)', opacity: lit }]} />
      {embers.map((e, i) => (
        <Animated.Text key={i} style={{ position: 'absolute', left: e.x, top: height, fontSize: e.size,
          opacity: e.p.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.9, 0.7, 0] }),
          transform: [{ translateY: e.p.interpolate({ inputRange: [0, 1], outputRange: [0, -(height + 80)] }) }, { translateX: e.p.interpolate({ inputRange: [0, 1], outputRange: [0, e.drift] }) }] }}>🔥</Animated.Text>
      ))}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 }]}>
        <Animated.Text style={{ fontSize: 150, textShadowColor: 'rgba(255,140,0,0.9)', textShadowRadius: 40, transform: [{ scale }] }}>🔥</Animated.Text>
        <Animated.View style={{ alignItems: 'center', gap: 6, paddingHorizontal: 28, paddingVertical: 18, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.35)', opacity: lit, transform: [{ translateY: lit.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }}>
          <Text style={{ color: '#fff', fontSize: 40, fontWeight: '900' }}>{`Day ${days} 🔥`}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 17, fontWeight: '600' }}>You both sent today’s moment</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}
