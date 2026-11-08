import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { backend } from '@/services/backend';

export type LocationOutcome = 'ok' | 'denied' | 'unavailable' | 'error';

/**
 * Foreground-only location refresh. We deliberately do not request
 * background permission: iOS and Android restrict it, and foreground updates
 * on app open plus manual refresh cover the "where are you" use case honestly.
 */
export async function refreshMyLocation(): Promise<LocationOutcome> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return 'denied';
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    let city: string | null = null;
    let country: string | null = null;
    let countryCode: string | null = null;
    if (Platform.OS !== 'web') {
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        city = place?.city ?? place?.region ?? null;
        country = place?.country ?? null;
        countryCode = place?.isoCountryCode ?? null;
      } catch {
        /* geocoding optional */
      }
    }
    await backend.pushLive({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracyMeters: pos.coords.accuracy ?? null, city, country, countryCode });
    return 'ok';
  } catch (e) {
    const msg = String((e as Error)?.message ?? '');
    return msg.toLowerCase().includes('denied') ? 'denied' : Platform.OS === 'web' ? 'unavailable' : 'error';
  }
}

export async function refreshMyBattery(): Promise<boolean> {
  try {
    const Battery = await import('expo-battery');
    const available = await Battery.isAvailableAsync();
    if (!available) return false;
    const level = await Battery.getBatteryLevelAsync();
    if (level < 0) return false;
    await backend.pushLive({ batteryPercent: Math.round(level * 100) });
    return true;
  } catch {
    return false;
  }
}
