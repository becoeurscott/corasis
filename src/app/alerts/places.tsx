import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Banner, Header, Screen, Txt } from '@/components/ui';
import { backend } from '@/services/backend';
import { useMe, usePartner, usePlaces } from '@/store/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Place alerts: saved places with arrive/leave alerts. Mirrors PlaceAlertsView in Places.swift. */
export default function PlaceAlerts() {
  const { colors } = useTheme();
  const me = useMe();
  const partner = usePartner();
  const places = usePlaces();
  const name = partner?.firstName ?? 'your partner';
  const suggestions = [
    { name: `${name}'s home`, emoji: '🏠', tint: '#FFE1EC' },
    { name: `${name}'s work`, emoji: '💼', tint: '#E1E8FF' },
  ].filter((s) => !places.some((p) => p.name === s.name));
  const add = (preset?: { name: string; emoji: string }) => router.push({ pathname: '/alerts/place', params: preset ? { name: preset.name, emoji: preset.emoji } : {} });

  return (
    <Screen>
      <Header title="" />
      <View style={{ gap: spacing.md }}>
        <Txt variant="title">Place alerts</Txt>
        <Txt tone="secondary">Add {name}'s home, work or other places they go often. Get an alert when they arrive or leave.</Txt>
        <Pressable accessibilityRole="button" onPress={() => add()} style={[styles.addBig, { borderColor: colors.primary }]}>
          <Ionicons name="add-circle" size={24} color={colors.primary} />
          <Txt style={{ color: colors.primary, fontWeight: '700', fontSize: 19 }}>Add a new place</Txt>
        </Pressable>
        {places.map((p) => (
          <Pressable key={p.id} onPress={() => router.push({ pathname: '/alerts/place', params: { id: p.id } })} style={[styles.row, { backgroundColor: colors.surface }]}>
            <View style={[styles.tile, { backgroundColor: p.ownerId === me?.id ? '#FFE1EC' : '#E1E8FF' }]}><Txt style={{ fontSize: 32 }}>{p.emoji}</Txt></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="heading">{p.name}</Txt>
              <Txt tone="secondary">Added by <Txt style={{ color: colors.primary }}>{p.addedBy === me?.id ? 'me' : name}</Txt></Txt>
            </View>
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: p.alerts }} accessibilityLabel="Alerts" onPress={() => backend.savePlace({ ...p, alerts: !p.alerts })} style={[styles.bell, { backgroundColor: p.alerts ? colors.primary : colors.primarySoft }]}>
              <Ionicons name={p.alerts ? 'notifications' : 'notifications-off-outline'} size={22} color={p.alerts ? '#FFFFFF' : colors.textSecondary} />
            </Pressable>
          </Pressable>
        ))}
        {suggestions.map((s) => (
          <View key={s.name} style={[styles.row, { backgroundColor: colors.surface }]}>
            <View style={[styles.tile, { backgroundColor: s.tint }]}><Txt style={{ fontSize: 32 }}>{s.emoji}</Txt></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="heading">{s.name}</Txt>
              <Txt tone="secondary">Not set</Txt>
            </View>
            <Pressable accessibilityRole="button" onPress={() => add(s)} style={[styles.pill, { backgroundColor: colors.primary }]}>
              <Ionicons name="add-circle" size={18} color="#FFFFFF" />
              <Txt style={{ color: '#FFFFFF', fontWeight: '700' }}>Add</Txt>
            </Pressable>
          </View>
        ))}
        {!partner ? <Banner kind="info" body="Connect your partner to use place alerts." /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBig: { borderWidth: 2, borderRadius: 26, paddingVertical: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 24 },
  tile: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bell: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999 },
});
