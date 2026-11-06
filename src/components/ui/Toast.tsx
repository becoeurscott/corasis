import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Txt } from './Text';

interface ToastState {
  message: string | null;
  kind: 'info' | 'success' | 'error';
  show: (message: string, kind?: ToastState['kind']) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  kind: 'info',
  show: (message, kind = 'info') => set({ message, kind }),
  hide: () => set({ message: null }),
}));

export const toast = (message: string, kind: ToastState['kind'] = 'info') => useToast.getState().show(message, kind);

export function ToastHost() {
  const { message, kind, hide } = useToast();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 3200);
    return () => clearTimeout(t);
  }, [message, hide]);
  if (!message) return null;
  const bg = kind === 'success' ? colors.successSoft : kind === 'error' ? colors.dangerSoft : colors.surfaceRaised;
  const prefix = kind === 'success' ? '✓ ' : kind === 'error' ? '✕ ' : '';
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + spacing.md }]}>
      <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.toast, { backgroundColor: bg, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <Txt variant="bodyStrong">
          {prefix}
          {message}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  toast: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1, maxWidth: 520, shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
});
