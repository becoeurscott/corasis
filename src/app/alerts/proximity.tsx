import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Gradient, Header, Screen, Txt } from '@/components/ui';
import { PROXIMITY_METERS, useProximity } from '@/lib/alerts';
import { haptic } from '@/lib/haptics';
import { askPermission } from '@/lib/permissions';
import { backend } from '@/services/backend';
import { useMe, usePartner, useSharing } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { router } from 'expo-router';

/** Proximity alert: a radar with both of you. Mirrors ProximityAlertView in Places.swift. */
export default function ProximityScreen() {
  const { colors } = useTheme();
  const me = useMe();
  const partner = usePartner();
  const mine = useSharing(me?.id);
  const { enabled, set } = useProximity();
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const toggle = async () => {
    if (enabled) return set(false);
    if (!(await askPermission('notifications'))) return;
    await Notifications.requestPermissionsAsync().catch(() => undefined);
    if (!mine?.location) await backend.setSharing({ location: true });
    set(true);
    haptic('success');
  };

  return (
    <Screen>
      <Header title="" />
      <View style={{ gap: spacing.md, alignItems: 'center' }}>
        <Txt variant="title" style={{ textAlign: 'center' }}>🔔 Proximity <Txt variant="title" style={{ color: colors.primary }}>Alert</Txt></Txt>
        <Txt tone="secondary" style={{ textAlign: 'center' }}>Turn this on to be told when you and {partner?.firstName ?? 'your partner'} are close to each other.</Txt>
        <Gradient colors={['#E9B8FF', '#B07CFF']} style={styles.radar}>
          {[1, 2, 3].map((i) => <View key={i} style={[styles.ring, { width: i * 90, height: i * 90, borderRadius: i * 45 }]} />)}
          <Animated.View style={[styles.sweep, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
            <View style={styles.beam} />
          </Animated.View>
          <Txt style={{ fontSize: 34, color: '#FFFFFF' }}>♥</Txt>
          {partner ? <View style={[styles.avatar, { left: 24, bottom: 40 }]}><Avatar name={partner.firstName} uri={partner.avatarUri} size={70} /></View> : null}
          {me ? <View style={[styles.avatar, { right: 36, top: 50 }]}><Avatar name={me.firstName} uri={me.avatarUri} size={48} /></View> : null}
        </Gradient>
        <Pressable accessibilityRole="button" onPress={toggle} style={[styles.button, { backgroundColor: enabled ? colors.primarySoft : colors.primary }]}>
          <Txt style={{ color: enabled ? colors.primary : '#FFFFFF', fontWeight: '700', fontSize: 17 }}>{enabled ? 'Turn off proximity alert' : 'Turn on proximity alert'}</Txt>
        </Pressable>
        {enabled ? (
          <Txt variant="caption" tone="secondary" style={{ textAlign: 'center' }}>On · alerts within {PROXIMITY_METERS} m. You both need location sharing turned on.</Txt>
        ) : (
          <Pressable onPress={() => router.back()} style={{ padding: 10 }}><Txt tone="secondary" style={{ fontWeight: '600' }}>Not now</Txt></Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  radar: { width: '100%', aspectRatio: 0.95, borderRadius: 40, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  sweep: { position: 'absolute', width: 270, height: 270, alignItems: 'center' },
  beam: { width: 135, height: 135, marginLeft: 135, backgroundColor: 'rgba(255,255,255,0.22)', borderTopRightRadius: 135 },
  avatar: { position: 'absolute', borderWidth: 4, borderColor: '#FFFFFF', borderRadius: 999 },
  button: { width: '100%', borderRadius: 999, paddingVertical: 17, alignItems: 'center' },
});
