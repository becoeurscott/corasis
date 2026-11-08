import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { backend, useData } from '@/services/backend';
import { useCouple, useSession } from '@/store/hooks';

let cachedPlace: { lat: number; lon: number; country: string | null; code: string | null } | null = null;

/** What this phone may share right now: only reads location/battery when that switch is on. */
async function readMine(userId: string) {
  const perm = useData.getState().sharing[userId];
  const out: { lat?: number | null; lon?: number | null; country?: string | null; countryCode?: string | null; battery?: number | null } = {};
  if (perm?.location) {
    try {
      const p = await Location.getForegroundPermissionsAsync();
      if (p.granted) {
        const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
        if (pos) {
          const moved = !cachedPlace || Math.abs(cachedPlace.lat - pos.coords.latitude) + Math.abs(cachedPlace.lon - pos.coords.longitude) > 0.05;
          if (moved) {
            const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }).catch(() => []);
            cachedPlace = { lat: pos.coords.latitude, lon: pos.coords.longitude, country: place?.country ?? null, code: place?.isoCountryCode ?? null };
          }
          Object.assign(out, { lat: pos.coords.latitude, lon: pos.coords.longitude, country: cachedPlace?.country ?? null, countryCode: cachedPlace?.code ?? null });
        }
      }
    } catch { /* location optional */ }
  }
  if (perm?.battery) {
    try {
      const level = await Battery.getBatteryLevelAsync();
      if (level >= 0) out.battery = Math.round(level * 100);
    } catch { /* battery optional */ }
  }
  return out;
}

/** While the app is open: shared content every ~10s, location/battery every ~30s (and right after a switch changes). */
export function LiveSync() {
  const session = useSession();
  const couple = useCouple();
  const mySharing = useData((s) => (session ? s.sharing[session.userId] : undefined));
  const on = !!session && !!couple && backend.isRemoteSession();

  useEffect(() => {
    if (!on || !session) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    let n = 0;
    const tick = async () => {
      try { await backend.syncShared(); } catch { /* try again */ }
      if (n++ % 3 === 0) { try { await backend.syncLive(await readMine(session.userId)); } catch { /* try again */ } }
    };
    const start = () => { if (!timer) { tick(); timer = setInterval(tick, 10_000); } };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (st) => (st === 'active' ? start() : stop()));
    return () => { stop(); sub.remove(); };
    // Re-run when my switches change so turning one off reaches the server right away.
  }, [on, session, mySharing?.location, mySharing?.battery]);

  return null;
}
