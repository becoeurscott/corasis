/**
 * Proximity + place alerts on the phone (mirrors native-ios/Together/Places.swift).
 * - Proximity: when both of you share location and come within 500 m, you both get "You're close!".
 * - Places: while Corasis is open, your phone notices when you arrive at or leave one of your places
 *   and alerts your partner. (The iOS app also does this in the background with region monitoring.)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { create } from 'zustand';

import { backend, useData } from '@/services/backend';

export const PROXIMITY_METERS = 500;

export const useProximity = create<{ enabled: boolean; set: (on: boolean) => void }>((set) => ({
  enabled: false,
  set: (on) => { set({ enabled: on }); AsyncStorage.setItem('proximity-alert', on ? '1' : '0').catch(() => undefined); },
}));
AsyncStorage.getItem('proximity-alert').then((v) => useProximity.setState({ enabled: v === '1' })).catch(() => undefined);

export function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const inside: Record<string, boolean> = {};
let wasNear: boolean | null = null;

/** Mount once at the root. */
export function AlertWatcher() {
  const live = useData((s) => s.live);
  const session = useData((s) => s.session);
  const couples = useData((s) => s.couples);
  const places = useData((s) => s.places);
  const sharing = useData((s) => s.sharing);
  const enabled = useProximity((s) => s.enabled);

  useEffect(() => {
    if (!session) return;
    const couple = Object.values(couples).find((c) => c.memberIds.includes(session.userId));
    if (!couple) return;
    const partnerId = couple.memberIds.find((m) => m !== session.userId);
    const me = live[session.userId];
    const mine = me?.lat != null && me?.lon != null ? { lat: me.lat, lon: me.lon } : null;

    // Proximity
    const them = partnerId ? live[partnerId] : null;
    if (enabled && mine && them?.lat != null && them?.lon != null && sharing[session.userId]?.location && partnerId && sharing[partnerId]?.location) {
      const near = distanceMeters(mine, { lat: them.lat, lon: them.lon }) <= PROXIMITY_METERS;
      if (near && wasNear === false) {
        if (backend.isRemoteSession()) backend.sendPartnerAlert('near', null).catch(() => undefined);
        else Notifications.scheduleNotificationAsync({ content: { title: "💞 You're close!", body: 'You two are near each other right now.' }, trigger: null }).catch(() => undefined);
      }
      wasNear = near;
    }

    // My places (foreground)
    if (!mine) return;
    for (const p of (places ?? []).filter((x) => x.coupleId === couple.id && x.ownerId === session.userId && x.alerts)) {
      const now = distanceMeters(mine, p) <= Math.max(100, p.radius);
      const before = inside[p.id];
      inside[p.id] = now;
      if (before === undefined || before === now) continue;
      backend.sendPartnerAlert(now ? 'arrive' : 'leave', p.name).catch(() => undefined);
    }
  }, [live, session, couples, places, sharing, enabled]);
  return null;
}
