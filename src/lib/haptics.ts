import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { usePrefs } from '@/store/prefs';

export function haptic(kind: 'light' | 'medium' | 'success' | 'warning' | 'error' | 'selection' = 'light') {
  if (Platform.OS === 'web') return;
  if (!usePrefs.getState().notifications.haptics) return;
  try {
    if (kind === 'selection') return void Haptics.selectionAsync();
    if (kind === 'success') return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (kind === 'warning') return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (kind === 'error') return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    void Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* haptics unavailable */
  }
}
