import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { remote } from '@/services/backend/remote';
import { backend } from '@/services/backend';
import { useCouple, useSession } from '@/store/hooks';
import { useAffection } from '@/store/affection';

type AffectionPayload = { affection?: { emoji?: string } };
const emojiOf = (n: Notifications.Notification) => (n.request.content.data as AffectionPayload | undefined)?.affection?.emoji;

// App open: affection pushes play the floating emojis instead of a banner.
Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const isAffection = !!emojiOf(n);
    return { shouldShowAlert: !isAffection, shouldShowBanner: !isAffection, shouldShowList: !isAffection, shouldPlaySound: !isAffection, shouldSetBadge: false };
  },
});

/** Keeps affection live: registers for pushes, plays received emojis, polls while the app is open. */
export function AffectionSync() {
  const session = useSession();
  const couple = useCouple();
  const show = useAffection((s) => s.show);
  const remoteOn = !!couple && backend.isRemoteSession();

  // Register this phone for pushes once connected.
  useEffect(() => {
    if (!remoteOn || Platform.OS !== 'ios') return;
    (async () => {
      try {
        let perm = await Notifications.getPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
        if (!perm.granted) return;
        const { data } = await Notifications.getDevicePushTokenAsync();
        await AsyncStorage.setItem('apns-token', String(data));
        await remote.savePushToken(String(data), __DEV__ ? 'sandbox' : 'production');
      } catch { /* push optional (simulator, Expo Go) */ }
    })();
  }, [remoteOn]);

  // Foreground notification or tap → floating emojis.
  useEffect(() => {
    const a = Notifications.addNotificationReceivedListener((n) => { const e = emojiOf(n); if (e) show(e); });
    const b = Notifications.addNotificationResponseReceivedListener((r) => { const e = emojiOf(r.notification); if (e) show(e); });
    return () => { a.remove(); b.remove(); };
  }, [show]);

  // Poll every few seconds while the app is in front.
  useEffect(() => {
    if (!remoteOn || !session) return;
    const key = `affection-seen-${session.userId}`;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = async () => {
      try {
        const since = (await AsyncStorage.getItem(key)) ?? new Date().toISOString();
        const items = await backend.receivedAffections(since);
        if (items.length) {
          items.slice(-3).forEach((i) => show(i.emoji));
          await AsyncStorage.setItem(key, items[items.length - 1].created_at);
        } else if (!(await AsyncStorage.getItem(key))) {
          await AsyncStorage.setItem(key, since);
        }
      } catch { /* try again */ }
    };
    const start = () => { if (!timer) { tick(); timer = setInterval(tick, 4000); } };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (st) => (st === 'active' ? start() : stop()));
    return () => { stop(); sub.remove(); };
  }, [remoteOn, session, show]);

  return null;
}
