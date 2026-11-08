import { useReducedMotion } from '@/lib/motion';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AffectionRain } from '@/components/affection/AffectionRain';
import { AffectionSync } from '@/components/affection/AffectionSync';
import { AppLockGate } from '@/components/AppLockGate';
import { DeepLinkHandler } from '@/components/DeepLinkHandler';
import { Confirm, ToastHost } from '@/components/ui';
import { useHydrated } from '@/store/hooks';
import { usePrefs } from '@/store/prefs';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { colors, isDark } = useTheme();
  const reduced = useReducedMotion();
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: { ...(isDark ? DarkTheme : DefaultTheme).colors, background: colors.background, card: colors.surface, text: colors.text, primary: colors.primary, border: colors.border },
  };
  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: reduced ? 'none' : 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" options={{ animation: reduced ? 'none' : 'fade' }} />
        <Stack.Screen name="viewer" options={{ presentation: 'fullScreenModal', animation: reduced ? 'none' : 'fade' }} />
        <Stack.Screen name="lock" options={{ presentation: 'fullScreenModal', animation: reduced ? 'none' : 'fade', gestureEnabled: false }} />
      </Stack>
      <DeepLinkHandler />
      <AffectionSync />
      <AffectionRain />
      <AppLockGate />
      <ToastHost />
      <Confirm />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const prefsHydrated = usePrefs((s) => s.hydrated);
  const dataHydrated = useHydrated();
  useEffect(() => {
    if (prefsHydrated && dataHydrated) SplashScreen.hideAsync().catch(() => {});
  }, [prefsHydrated, dataHydrated]);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
