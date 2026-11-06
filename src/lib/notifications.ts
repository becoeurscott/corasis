import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { usePrefs } from '@/store/prefs';

/** Ask for notification permission only after explaining why. */
export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return 'granted';
    const res = await Notifications.requestPermissionsAsync();
    return res.granted ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/** Schedules the local daily reminder at the chosen time. Remote pushes need a server. */
export async function scheduleDailyReminder(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { notifications } = usePrefs.getState();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!notifications.dailyReminder) return true;
    const [h, m] = notifications.reminderTime.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Your moment of the day', body: 'Send one photo or video to keep the flame going.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h, minute: m },
    });
    return true;
  } catch {
    return false;
  }
}

/** True when `now` falls inside the recipient's quiet hours. */
export function inQuietHours(nowHHmm: string, start: string, end: string): boolean {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const n = toMin(nowHHmm);
  const a = toMin(start);
  const b = toMin(end);
  return a <= b ? n >= a && n < b : n >= a || n < b;
}
