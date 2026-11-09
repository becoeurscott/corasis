/**
 * Every system permission is introduced by our own screen first; the OS prompt only
 * appears after "Continue". Mirrors native-ios/Together/Permissions.swift.
 *
 *   if (!(await askPermission('microphone'))) return;
 *   const perm = await requestRecordingPermissionsAsync();
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Gradient, Txt } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

export type PermissionKind = 'location' | 'notifications' | 'microphone' | 'camera' | 'photos' | 'faceID';

type Copy = { emoji: string; title: string; subtitle: string; points: [keyof typeof Ionicons.glyphMap, string][]; colors: [string, string] };
export const permissionCopy: Record<PermissionKind, Copy> = {
  location: { emoji: '📍', title: 'Share where you are', subtitle: 'Your location shows on the map, the distance between you and your country flag. Only your partner sees it, and only while sharing is on.', points: [['heart', 'Only your partner can see it'], ['hand-left', 'Turn sharing off any time']], colors: ['#8FD3FF', '#6C7BFF'] },
  notifications: { emoji: '🔔', title: 'Never miss your partner', subtitle: 'Get kisses, messages, place alerts and the “you’re close!” alert the moment they happen.', points: [['heart', 'Affection and messages'], ['location', 'Place and proximity alerts'], ['calendar', 'Reminders before you meet']], colors: ['#FFD36E', '#FF8A5B'] },
  microphone: { emoji: '🎙️', title: 'Send your voice', subtitle: 'Record little voice notes for your partner. We only listen while you record.', points: [['mic', 'Only while recording'], ['lock-closed', 'Sent to your partner only']], colors: ['#F7A8C4', '#C2477A'] },
  camera: { emoji: '📸', title: 'Capture your moment', subtitle: 'Take today’s moment and share it with your partner.', points: [['camera', 'Only when you open the camera'], ['lock-closed', 'Shared with your partner only']], colors: ['#F7A8C4', '#C2477A'] },
  photos: { emoji: '🖼️', title: 'Your photos', subtitle: 'Pick photos to share, or save your wallpaper and memories to your library.', points: [['images', 'Only the photos you choose'], ['eye-off', 'We never browse your library']], colors: ['#B9A4FF', '#7C5CFF'] },
  faceID: { emoji: '🔒', title: 'Keep it just for you', subtitle: 'Lock Corasis with Face ID or your fingerprint so your private moments stay private.', points: [['finger-print', 'Stays on this phone'], ['lock-closed', 'Nothing leaves your device']], colors: ['#B9A4FF', '#7C5CFF'] },
};

/** True only when the OS would show its prompt now. */
async function needsAsking(kind: PermissionKind): Promise<boolean> {
  try {
    switch (kind) {
      // Loaded on demand so plain logic modules (and tests) don't pull in every native module.
      case 'location': return (await (await import('expo-location')).getForegroundPermissionsAsync()).status === 'undetermined';
      case 'notifications': return (await (await import('expo-notifications')).getPermissionsAsync()).status === 'undetermined';
      case 'microphone': return (await (await import('expo-audio')).getRecordingPermissionsAsync()).status === 'undetermined';
      case 'camera': return (await (await import('expo-image-picker')).getCameraPermissionsAsync()).status === 'undetermined';
      case 'photos': return (await (await import('expo-media-library')).getPermissionsAsync()).status === 'undetermined';
      case 'faceID': return (await AsyncStorage.getItem('primer-faceID')) == null;
    }
  } catch {
    return false;
  }
}

type Gate = { current: PermissionKind | null; resolve: ((yes: boolean) => void) | null };
const useGate = create<Gate>(() => ({ current: null, resolve: null }));

/** Shows our screen (if the OS would prompt) and resolves true to go ahead with the system request. */
export async function askPermission(kind: PermissionKind): Promise<boolean> {
  if (!(await needsAsking(kind))) return true;
  if (kind === 'faceID') AsyncStorage.setItem('primer-faceID', '1').catch(() => undefined);
  useGate.getState().resolve?.(false);
  return new Promise((resolve) => useGate.setState({ current: kind, resolve }));
}
function answer(yes: boolean) {
  const { resolve } = useGate.getState();
  useGate.setState({ current: null, resolve: null });
  resolve?.(yes);
}

/** Mount once at the root. */
export function PermissionPrimerHost() {
  const kind = useGate((s) => s.current);
  return (
    <Modal visible={!!kind} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => answer(false)}>
      {kind ? <PermissionPrimer kind={kind} onAnswer={answer} /> : null}
    </Modal>
  );
}

export function PermissionPrimer({ kind, onAnswer }: { kind: PermissionKind; onAnswer: (yes: boolean) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const c = permissionCopy[kind];
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={[styles.wrap, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.hero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={[styles.ring, { width: 120 + i * 56, height: 120 + i * 56, borderRadius: 200, borderColor: c.colors[1] + '40', opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.3] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }] }]}
          />
        ))}
        <Gradient colors={c.colors} style={styles.circle}>
          <Txt style={{ fontSize: 56 }}>{c.emoji}</Txt>
        </Gradient>
      </View>
      <Txt variant="title" style={{ textAlign: 'center' }}>{c.title}</Txt>
      <Txt tone="secondary" style={{ textAlign: 'center' }}>{c.subtitle}</Txt>
      <View style={[styles.points, { backgroundColor: colors.surface }]}>
        {c.points.map(([icon, text]) => (
          <View key={text} style={styles.point}>
            <Ionicons name={icon} size={20} color={c.colors[1]} />
            <Txt style={{ fontWeight: '600' }}>{text}</Txt>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" onPress={() => onAnswer(true)}>
        <Gradient colors={c.colors} style={styles.button}>
          <Txt style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 17 }}>Continue</Txt>
        </Gradient>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => onAnswer(false)} style={{ alignSelf: 'center', padding: 12 }}>
        <Txt tone="secondary" style={{ fontWeight: '600' }}>Not now</Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, gap: 18, maxWidth: 560, width: '100%', alignSelf: 'center' },
  hero: { height: 240, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
  circle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  points: { borderRadius: 20, padding: 18, gap: 12 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: { borderRadius: 999, paddingVertical: 17, alignItems: 'center' },
});
