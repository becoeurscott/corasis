import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ThemeName } from '@/theme/tokens';

export type AppearancePref = 'light' | 'dark' | 'system';
export type Language = 'en' | 'fr';
/** 'auto' follows the phone's language (see resolveLanguage in lib/i18n). */
export type LanguagePref = Language | 'auto';
export type DistanceUnit = 'km' | 'mi';

export interface NotificationPrefs {
  dailyReminder: boolean;
  partnerMoments: boolean;
  activities: boolean;
  messages: boolean;
  meetings: boolean;
  reminderTime: string; // "HH:mm"
  quietStart: string; // "HH:mm"
  quietEnd: string; // "HH:mm"
  sound: boolean;
  haptics: boolean;
}

interface PrefsState {
  theme: ThemeName | null;
  appearance: AppearancePref;
  language: LanguagePref;
  distanceUnit: DistanceUnit;
  reduceMotion: boolean;
  notifications: NotificationPrefs;
  appLockEnabled: boolean;
  appLockPin: string | null; // demo-grade PIN; production should use SecureStore
  hydrated: boolean;
  setTheme: (t: ThemeName) => void;
  setAppearance: (a: AppearancePref) => void;
  setLanguage: (l: LanguagePref) => void;
  setDistanceUnit: (u: DistanceUnit) => void;
  setNotifications: (patch: Partial<NotificationPrefs>) => void;
  setAppLock: (enabled: boolean, pin?: string | null) => void;
  reset: () => void;
}

const defaultNotifications: NotificationPrefs = {
  dailyReminder: true,
  partnerMoments: true,
  activities: true,
  messages: true,
  meetings: true,
  reminderTime: '20:00',
  quietStart: '22:00',
  quietEnd: '08:00',
  sound: true,
  haptics: true,
};

const initial = {
  theme: null as ThemeName | null,
  appearance: 'system' as AppearancePref,
  language: 'auto' as LanguagePref,
  distanceUnit: 'km' as DistanceUnit,
  reduceMotion: false,
  notifications: defaultNotifications,
  appLockEnabled: false,
  appLockPin: null as string | null,
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...initial,
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      setAppearance: (appearance) => set({ appearance }),
      setLanguage: (language) => set({ language }),
      setDistanceUnit: (distanceUnit) => set({ distanceUnit }),
      setNotifications: (patch) => set((s) => ({ notifications: { ...s.notifications, ...patch } })),
      setAppLock: (appLockEnabled, pin) =>
        set((s) => ({ appLockEnabled, appLockPin: pin === undefined ? s.appLockPin : pin })),
      reset: () => set({ ...initial }),
    }),
    {
      name: 'together.prefs.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { hydrated: _h, ...rest } = s;
        return rest;
      },
      // v1: older installs saved the old default 'en'; switch them to follow the phone.
      version: 1,
      migrate: (state, version) => {
        const s = state as { language?: string };
        if (version < 1 && s.language === 'en') s.language = 'auto';
        return s as never;
      },
      onRehydrateStorage: () => () => {
        usePrefs.setState({ hydrated: true });
      },
    },
  ),
);
