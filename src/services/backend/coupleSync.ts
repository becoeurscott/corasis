/**
 * Couple sync — keeps everything the couple shares in step with the partner's
 * phone (formats in docs/SYNC.md, server in migrations/*couple-sync*.sql).
 * Same rules as native-ios/Together/CoupleSync.swift so iOS and Android partners match.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { insforge } from './remote';
import type { ActivitySession, CalendarEvent, Couple, LifeGame, MediaAsset, Memory, Message, Moment } from './types';

type Json = Record<string, unknown>;
type Item = { kind: string; id: string; data: Json; hash: string };
type State = { coupleId: string | null; since: string | null; hashes: Record<string, string>; mediaKeys: Record<string, string> };

/** The slice of the app's data store this module reads and writes. */
export type SyncStore = {
  get: () => {
    session: { userId: string } | null;
    couples: Record<string, Couple>;
    moments: Moment[]; messages: Message[]; sessions: ActivitySession[]; memories: Memory[]; events: CalendarEvent[];
    lifeGames: LifeGame[]; widgetMessage: Record<string, { text: string; authorId: string; updatedAt: string }>;
  };
  set: (fn: (s: ReturnType<SyncStore['get']>) => Partial<ReturnType<SyncStore['get']>>) => void;
};

const stateKey = (userId: string) => `couple-sync-${userId}`;
async function loadState(userId: string): Promise<State> {
  try { const raw = await AsyncStorage.getItem(stateKey(userId)); if (raw) return JSON.parse(raw) as State; } catch { /* fresh */ }
  return { coupleId: null, since: null, hashes: {}, mediaKeys: {} };
}
const saveState = (userId: string, s: State) => AsyncStorage.setItem(stateKey(userId), JSON.stringify(s)).catch(() => undefined);

/** Stable JSON (sorted keys) so both phones hash the same record the same way. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as Json).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Json)[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
function hashOf(v: unknown): string {
  const s = stable(v);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 + c, 2246822519); }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}${s.length}`;
}
const item = (kind: string, id: string, data: Json): Item => ({ kind, id, data, hash: hashOf(data) });
const orNull = (s: string | null | undefined) => (s ? s : null);

let running = false;
let applied: string[] = [];

// ---------- media ----------
async function uploadMedia(m: MediaAsset | null, coupleId: string, st: State): Promise<Json | null> {
  if (!m) return null;
  const known = st.mediaKeys[m.uri];
  if (known) return { key: known, kind: m.kind };
  if (!m.uri.startsWith('file:')) return null; // demo/remote images are not uploaded
  try {
    const blob = await (await fetch(m.uri)).blob();
    const ext = (m.uri.split('.').pop() ?? 'bin').toLowerCase().slice(0, 5);
    const key = `${coupleId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { data, error } = await insforge!.storage.from('couple-media').upload(key, blob);
    if (error || !data) return null;
    st.mediaKeys[m.uri] = data.key;
    return { key: data.key, kind: m.kind };
  } catch { return null; }
}

async function downloadMedia(v: unknown, st: State): Promise<{ media: MediaAsset | null; ok: boolean }> {
  const m = v as { key?: string; kind?: string } | null;
  if (!m?.key) return { media: null, ok: true };
  const kind = (m.kind ?? 'photo') as MediaAsset['kind'];
  const existing = Object.entries(st.mediaKeys).find(([, k]) => k === m.key)?.[0];
  if (existing) {
    const info = await FileSystem.getInfoAsync(existing).catch(() => ({ exists: false }));
    if (info.exists) return { media: { id: m.key, kind, uri: existing, uploadState: 'uploaded', createdAt: new Date().toISOString() }, ok: true };
  }
  try {
    const { data, error } = await insforge!.storage.from('couple-media').download(m.key);
    if (error || !data) return { media: null, ok: false };
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(data as Blob);
    });
    const dir = `${FileSystem.documentDirectory}couple-media/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    const uri = `${dir}${m.key.split('/').pop()}`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    st.mediaKeys[uri] = m.key;
    return { media: { id: m.key, kind, uri, uploadState: 'uploaded', createdAt: new Date().toISOString() }, ok: true };
  } catch { return { media: null, ok: false }; }
}

// ---------- local → shared ----------
async function sharedItems(store: SyncStore, couple: Couple, st: State): Promise<Record<string, Item>> {
  const s = store.get();
  const out: Record<string, Item> = {};
  const add = (i: Item) => { out[`${i.kind}:${i.id}`] = i; };
  for (const m of s.moments.filter((x) => x.coupleId === couple.id)) {
    add(item('moment', m.id, { authorId: m.authorId, day: m.dayKey, caption: orNull(m.caption), createdAt: m.createdAt, media: await uploadMedia(m.media, couple.id, st) }));
  }
  for (const m of s.messages.filter((x) => x.coupleId === couple.id)) {
    add(item('message', m.id, { senderId: m.senderId, kind: m.kind, text: orNull(m.text), affection: m.affection ?? null, media: await uploadMedia(m.media, couple.id, st), createdAt: m.createdAt, reactions: m.reactions ?? {} }));
  }
  for (const x of s.sessions.filter((y) => y.coupleId === couple.id)) {
    add(item('session', x.id, {
      deckId: x.deckId, questionId: x.questionId, day: null, createdAt: x.createdAt, abandoned: x.status === 'abandoned',
      submissions: x.submissions.map((u) => ({ userId: u.userId, answer: u.answer, comment: u.comment ?? null, skipped: u.skipped, submittedAt: u.submittedAt })),
      reactions: x.reactions ?? {},
    }));
  }
  for (const m of s.memories.filter((x) => x.coupleId === couple.id)) {
    add(item('memory', m.id, { ownerId: m.ownerId, kind: m.kind, title: orNull(m.title), body: orNull(m.body), caption: orNull(m.caption), day: m.takenOn, createdAt: m.createdAt, media: await uploadMedia(m.media, couple.id, st), favoritedBy: m.favoritedBy ?? [], momentId: m.momentId ?? null }));
  }
  for (const e of s.events.filter((x) => x.coupleId === couple.id)) {
    add(item('event', e.id, { kind: e.kind, title: e.title, date: e.date, allDay: e.allDay, time: e.time, timezone: e.timezone, destination: e.destination, notes: e.notes, annual: e.recurringAnnual, reminders: e.reminders, cancelled: e.cancelled, createdBy: '' }));
  }
  for (const g of s.lifeGames.filter((x) => x.coupleId === couple.id)) {
    const { id, coupleId: _c, ...rest } = g;
    add(item('life', id, { ...rest, votes: g.votes.map(({ status, decidedBy, ...v }) => ({ ...v, decided: status === 'decided', coin: decidedBy === 'coin' })), keepsakeSaved: g.keepsakeSaved ?? false } as Json));
  }
  add(item('couple', 'settings', { start: couple.relationshipStart, stage: couple.relationshipStage, distance: couple.distanceMode, goals: couple.goals ?? [], timezone: couple.coupleTimezone }));
  const w = s.widgetMessage[couple.id];
  if (w?.text) add(item('widget', 'note', { text: w.text, by: '', at: null }));
  return out;
}

// ---------- shared → local ----------
const upsert = <T extends { id: string }>(list: T[], v: T) => (list.some((x) => x.id === v.id) ? list.map((x) => (x.id === v.id ? v : x)) : [...list, v]);

async function apply(store: SyncStore, couple: Couple, me: string, kind: string, id: string, d: Json, deleted: boolean, st: State): Promise<boolean> {
  const key = `${kind}:${id}`;
  if (deleted) {
    const drop = <T extends { id: string }>(l: T[]) => l.filter((x) => x.id !== id);
    store.set((s) => ({ moments: kind === 'moment' ? drop(s.moments) : s.moments, messages: kind === 'message' ? drop(s.messages) : s.messages, sessions: kind === 'session' ? drop(s.sessions) : s.sessions, memories: kind === 'memory' ? drop(s.memories) : s.memories, events: kind === 'event' ? drop(s.events) : s.events, lifeGames: kind === 'life' ? drop(s.lifeGames) : s.lifeGames }));
    delete st.hashes[key];
    return true;
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  switch (kind) {
    case 'moment': {
      const { media, ok } = await downloadMedia(d.media, st); if (!ok) return false; if (!media) return true;
      const v: Moment = { id, coupleId: couple.id, authorId: str(d.authorId) ?? '', dayKey: str(d.day) ?? '', media, caption: str(d.caption), createdAt: str(d.createdAt) ?? new Date().toISOString(), clientRequestId: id };
      store.set((s) => ({ moments: upsert(s.moments, v) })); break;
    }
    case 'message': {
      const { media, ok } = await downloadMedia(d.media, st); if (!ok) return false;
      const prev = store.get().messages.find((x) => x.id === id);
      const v: Message = { id, coupleId: couple.id, senderId: str(d.senderId) ?? '', kind: (str(d.kind) ?? 'text') as Message['kind'], affection: (d.affection as Message['affection']) ?? undefined, text: str(d.text), media, createdAt: str(d.createdAt) ?? new Date().toISOString(), delivery: 'sent', readAt: prev?.readAt ?? null, reactions: (d.reactions as Record<string, string>) ?? {}, clientRequestId: id };
      store.set((s) => ({ messages: upsert(s.messages, v) })); break;
    }
    case 'session': {
      const prev = store.get().sessions.find((x) => x.id === id);
      const remote = ((d.submissions as Json[]) ?? []).map((u) => ({ userId: str(u.userId) ?? '', answer: str(u.answer) ?? '', comment: str(u.comment), skipped: !!u.skipped, submittedAt: str(u.submittedAt) ?? new Date().toISOString() }));
      const mine = prev?.submissions.filter((u) => u.userId === me) ?? [];
      const submissions = [...mine, ...remote.filter((u) => u.userId !== me || mine.length === 0)];
      const both = couple.memberIds.every((m) => submissions.some((u) => u.userId === m));
      const status: ActivitySession['status'] = d.abandoned ? 'abandoned' : both ? 'revealed' : submissions.length ? 'waiting' : 'in_progress';
      const v: ActivitySession = { id, coupleId: couple.id, deckId: str(d.deckId) ?? '', questionId: str(d.questionId) ?? '', status, createdAt: str(d.createdAt) ?? new Date().toISOString(), revealedAt: both ? (prev?.revealedAt ?? new Date().toISOString()) : null, submissions, reactions: (d.reactions as Record<string, string>) ?? {}, drafts: prev?.drafts };
      store.set((s) => ({ sessions: upsert(s.sessions, v) })); break;
    }
    case 'memory': {
      const { media, ok } = await downloadMedia(d.media, st); if (!ok) return false;
      const v: Memory = { id, coupleId: couple.id, ownerId: str(d.ownerId) ?? '', kind: (str(d.kind) ?? 'letter') as Memory['kind'], media, title: str(d.title), body: str(d.body), caption: str(d.caption), takenOn: str(d.day) ?? '', createdAt: str(d.createdAt) ?? new Date().toISOString(), favoritedBy: (d.favoritedBy as string[]) ?? [], momentId: str(d.momentId) ?? undefined };
      store.set((s) => ({ memories: upsert(s.memories, v) })); break;
    }
    case 'event': {
      const prev = store.get().events.find((x) => x.id === id);
      const v = { ...(prev ?? {}), id, coupleId: couple.id, kind: (str(d.kind) ?? 'meeting') as CalendarEvent['kind'], title: str(d.title) ?? '', date: str(d.date) ?? '', allDay: d.allDay !== false, time: str(d.time), timezone: str(d.timezone) ?? couple.coupleTimezone, destination: str(d.destination), notes: str(d.notes), recurringAnnual: !!d.annual, reminders: (d.reminders as number[]) ?? [1], cancelled: !!d.cancelled, createdBy: prev?.createdBy ?? '' } as CalendarEvent;
      store.set((s) => ({ events: upsert(s.events, v) })); break;
    }
    case 'life': {
      if (!str(d.proposedBy)) return true;
      const votes = ((d.votes as Json[]) ?? []).map(({ decided, coin, ...v }) => ({ ...v, previousPicks: v.previousPicks ?? null, result: v.result ?? null, status: decided ? 'decided' : 'open', decidedBy: decided ? (coin ? 'coin' : 'match') : null }));
      const v = { ...(d as unknown as LifeGame), votes, id, coupleId: couple.id } as LifeGame;
      store.set((s) => ({ lifeGames: upsert(s.lifeGames, v) })); break;
    }
    case 'couple': {
      store.set((s) => {
        const c = s.couples[couple.id]; if (!c) return {};
        return { couples: { ...s.couples, [couple.id]: { ...c, relationshipStart: str(d.start), relationshipStage: (str(d.stage) ?? c.relationshipStage) as Couple['relationshipStage'], distanceMode: (str(d.distance) ?? c.distanceMode) as Couple['distanceMode'], goals: (d.goals as Couple['goals']) ?? c.goals, coupleTimezone: str(d.timezone) ?? c.coupleTimezone } } };
      });
      break;
    }
    case 'widget':
      store.set((s) => ({ widgetMessage: { ...s.widgetMessage, [couple.id]: { text: str(d.text) ?? '', authorId: '', updatedAt: new Date().toISOString() } } })); break;
    default: return true;
  }
  applied.push(key);
  return true;
}

/** One sync round: push local changes, merge the partner's. Safe to call often. */
export async function syncCouple(store: SyncStore): Promise<void> {
  if (running || !insforge) return;
  const s = store.get();
  const me = s.session?.userId;
  const couple = me ? Object.values(s.couples).find((c) => c.memberIds.includes(me)) : undefined;
  if (!me || !couple) return;
  running = true;
  try {
    let st = await loadState(me);
    if (st.coupleId !== couple.id) st = { coupleId: couple.id, since: null, hashes: {}, mediaKeys: st.mediaKeys };
    const local = await sharedItems(store, couple, st);
    const changes: Json[] = Object.entries(local).filter(([k, v]) => st.hashes[k] !== v.hash).map(([, v]) => ({ kind: v.kind, id: v.id, data: v.data, deleted: false }));
    for (const k of Object.keys(st.hashes)) {
      if (local[k]) continue;
      const [kind, ...rest] = k.split(':');
      if (kind !== 'widget' && kind !== 'couple') changes.push({ kind, id: rest.join(':'), data: {}, deleted: true });
    }
    const batches: Json[][] = [];
    for (let i = 0; i < changes.length; i += 150) batches.push(changes.slice(i, i + 150));
    if (!batches.length) batches.push([]);
    for (const batch of batches) {
      const { data, error } = await insforge.database.rpc('sync_couple_items', { p_items: batch, p_since: st.since });
      if (error || !data) return;
      for (const c of batch) { const k = `${c.kind}:${c.id}`; if (c.deleted) delete st.hashes[k]; else st.hashes[k] = local[k]?.hash; }
      const items = ((data as Json).items as Json[]) ?? [];
      let newest: string | null = null;
      for (const raw of items) {
        const ok = await apply(store, couple, me, String(raw.kind), String(raw.id), (raw.data as Json) ?? {}, !!raw.deleted, st);
        if (!ok) break;
        newest = String(raw.updated_at);
      }
      if (applied.length) {
        const now = await sharedItems(store, store.get().couples[couple.id] ?? couple, st);
        for (const k of applied) { if (now[k]) st.hashes[k] = now[k].hash; }
        applied = [];
      }
      const base = newest ? new Date(newest) : st.since ? null : new Date();
      if (base) st.since = new Date(base.getTime() - 5000).toISOString();
    }
    await saveState(me, st);
  } finally {
    running = false;
    applied = [];
  }
}
