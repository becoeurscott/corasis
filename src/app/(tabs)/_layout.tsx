import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ColorValue, Platform } from 'react-native';

import { useT } from '@/lib/i18n';
import { useHydrated, useMessages, useSession } from '@/store/hooks';
import { usePrefs } from '@/store/prefs';
import { useTheme } from '@/theme/ThemeProvider';

function TabIcon({ name, outline, color, focused, size, fallback }: { name: keyof typeof Ionicons.glyphMap; outline: keyof typeof Ionicons.glyphMap; color: ColorValue; focused: boolean; size: number; fallback: string }) {
  return <Ionicons name={focused ? name : outline} size={size} color={typeof color === 'string' ? color : fallback} />;
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const t = useT();
  const session = useSession();
  const hydrated = useHydrated();
  const theme = usePrefs((s) => s.theme);
  const messages = useMessages();
  const unread = session ? messages.filter((m) => m.senderId !== session.userId && !m.readAt).length : 0;

  if (hydrated && (!session || !theme)) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // Never pass `height: undefined` here: it overrides the navigator's computed height (49pt + home-indicator inset).
        tabBarStyle: [{ backgroundColor: colors.surface, borderTopColor: colors.border }, Platform.OS === 'web' ? { height: 64, paddingTop: 6 } : null],
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: (p) => <TabIcon {...p} name="home" outline="home-outline" fallback={colors.textMuted} /> }} />
      <Tabs.Screen name="map" options={{ title: t('tabs.map'), tabBarIcon: (p) => <TabIcon {...p} name="map" outline="map-outline" fallback={colors.textMuted} /> }} />
      <Tabs.Screen name="together" options={{ title: t('tabs.together'), tabBarIcon: (p) => <TabIcon {...p} name="heart" outline="heart-outline" fallback={colors.textMuted} />, tabBarBadge: unread > 0 ? unread : undefined, tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary } }} />
      <Tabs.Screen name="memories" options={{ title: t('tabs.memories'), tabBarIcon: (p) => <TabIcon {...p} name="images" outline="images-outline" fallback={colors.textMuted} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: (p) => <TabIcon {...p} name="person" outline="person-outline" fallback={colors.textMuted} /> }} />
    </Tabs>
  );
}
