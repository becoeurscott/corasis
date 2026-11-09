/**
 * Hooks that bind screens to the backend. Every hook derives its value from
 * subscribed store slices (never from an opaque getter), so the React
 * Compiler and Zustand both see the real dependencies and re-render on change.
 * A remote backend would feed the same store from realtime events.
 */
import { useEffect, useMemo, useState } from 'react';

import { dailyQuestionFor } from '@/data/questions';
import { redactLifeGame } from '@/lib/lifeGame';
import { computeStreak } from '@/lib/streak';
import { todayKey } from '@/lib/time';
import { ActivitySession, CheckupEntry, LifeGame, LiveInfo, redactSession, useData } from '@/services/backend';

export function useSession() {
  return useData((s) => s.session);
}
export function useHydrated() {
  return useData((s) => s.hydrated);
}
export function useMe() {
  const session = useData((s) => s.session);
  const profiles = useData((s) => s.profiles);
  return session ? profiles[session.userId] ?? null : null;
}
export function useCouple() {
  const session = useData((s) => s.session);
  const couples = useData((s) => s.couples);
  return useMemo(() => (session ? Object.values(couples).find((c) => c.memberIds.includes(session.userId)) ?? null : null), [session, couples]);
}
export function usePartner() {
  const session = useData((s) => s.session);
  const couple = useCouple();
  const profiles = useData((s) => s.profiles);
  if (!session || !couple) return null;
  const id = couple.memberIds.find((x) => x !== session.userId);
  return id ? profiles[id] ?? null : null;
}
export function useMoments() {
  const couple = useCouple();
  const moments = useData((s) => s.moments);
  return useMemo(() => (couple ? moments.filter((m) => m.coupleId === couple.id) : []), [couple, moments]);
}
export function useStreak() {
  const couple = useCouple();
  const moments = useMoments();
  return useMemo(() => (couple ? computeStreak(moments, couple.memberIds, todayKey(couple.coupleTimezone)) : null), [couple, moments]);
}
export function useSessions(): ActivitySession[] {
  const session = useData((s) => s.session);
  const couple = useCouple();
  const sessions = useData((s) => s.sessions);
  return useMemo(() => (session && couple ? sessions.filter((x) => x.coupleId === couple.id).map((x) => redactSession(x, session.userId)) : []), [session, couple, sessions]);
}
export function useActivitySession(id: string | undefined): ActivitySession | null {
  const session = useData((s) => s.session);
  const couple = useCouple();
  const sessions = useData((s) => s.sessions);
  return useMemo(() => {
    if (!id || !session || !couple) return null;
    const x = sessions.find((y) => y.id === id);
    return x && x.coupleId === couple.id ? redactSession(x, session.userId) : null;
  }, [id, session, couple, sessions]);
}
/** Today's daily session if it exists (creation happens in an effect/handler via backend.dailySession()). */
export function useDailySession(): ActivitySession | null {
  const couple = useCouple();
  const sessions = useSessions();
  if (!couple) return null;
  const day = todayKey(couple.coupleTimezone);
  const q = dailyQuestionFor(day);
  return sessions.find((x) => x.deckId === 'deck_daily' && x.questionId === q.id && x.createdAt.slice(0, 10) >= day) ?? null;
}
export function useMessages() {
  const couple = useCouple();
  const messages = useData((s) => s.messages);
  return useMemo(() => (couple ? messages.filter((m) => m.coupleId === couple.id) : []), [couple, messages]);
}
export function useMemories() {
  const couple = useCouple();
  const memories = useData((s) => s.memories);
  return useMemo(() => (couple ? memories.filter((m) => m.coupleId === couple.id) : []), [couple, memories]);
}
export function useEvents() {
  const couple = useCouple();
  const events = useData((s) => s.events);
  return useMemo(() => (couple ? events.filter((e) => e.coupleId === couple.id) : []), [couple, events]);
}
export function useSharing(userId: string | undefined) {
  const sharing = useData((s) => s.sharing);
  return userId ? sharing[userId] ?? null : null;
}
/** Live info filtered by that member's own sharing permission (mirrors backend.liveFor). */
export function useLive(userId: string | undefined): LiveInfo | null {
  const couple = useCouple();
  const live = useData((s) => s.live);
  const sharing = useData((s) => s.sharing);
  if (!userId || !couple || !couple.memberIds.includes(userId)) return null;
  const info = live[userId];
  const perm = sharing[userId];
  if (!info) return null;
  return {
    ...info,
    lat: perm?.location ? info.lat : null,
    lon: perm?.location ? info.lon : null,
    city: perm?.location ? info.city : null,
    country: perm?.location ? info.country : null,
    countryCode: perm?.location ? info.countryCode ?? null : null,
    accuracyMeters: perm?.location ? info.accuracyMeters : null,
    locationUpdatedAt: perm?.location ? info.locationUpdatedAt : null,
    batteryPercent: perm?.battery ? info.batteryPercent : null,
    batteryUpdatedAt: perm?.battery ? info.batteryUpdatedAt : null,
  };
}
export function useOnboarding() {
  return useData((s) => s.onboarding);
}
export function useEntitlements() {
  return useData((s) => s.entitlements);
}
export function useWidgetMessage() {
  const couple = useCouple();
  const widgetMessage = useData((s) => s.widgetMessage);
  return couple ? widgetMessage[couple.id] ?? null : null;
}
export function useFavorites() {
  return useData((s) => s.favorites);
}
export function useInvitations() {
  const session = useData((s) => s.session);
  const invitations = useData((s) => s.invitations);
  return useMemo(() => (session ? invitations.filter((i) => i.inviterId === session.userId) : []), [session, invitations]);
}

/** Ticking clock for countdowns and local times. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Connection answers are private to the signed-in user, never derived from a partner profile. */
export function useConnectionPreferences() {
  const session = useData(s => s.session);
  const values = useData(s => s.connectionPreferences);
  return session ? values[session.userId] ?? null : null;
}

/** The couple's life game, redacted for the viewer. Re-renders when the stored game changes. */
export function useLifeGame(): LifeGame | null {
  const session = useData((s) => s.session);
  const couple = useCouple();
  const games = useData((s) => s.lifeGames);
  return useMemo(() => {
    if (!session || !couple) return null;
    const g = games.find((x) => x.coupleId === couple.id);
    return g ? redactLifeGame(g, session.userId) : null;
  }, [session, couple, games]);
}

/** This couple's Marriage Check-up answers, all months. */
export function useCheckups(): CheckupEntry[] {
  const couple = useCouple();
  const all = useData((s) => s.checkups);
  return useMemo(() => (couple ? (all ?? []).filter((e) => e.coupleId === couple.id) : []), [couple, all]);
}
