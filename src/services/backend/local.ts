import { ConnectionPreferences, connectionFlow, validateConnectionAnswers } from '@/lib/connectionPreferences';
/**
 * LocalBackend — on-device implementation of the backend contract.
 *
 * It powers demo mode and offline browsing. Business rules that a real server
 * must enforce (two members per couple, expiring invitations, hidden answers
 * until both submit, idempotent moments, authorization per couple) are
 * implemented here in one place so they can be unit-tested and mirrored
 * server-side (see docs/BACKEND.md).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { dailyQuestionFor, questionById, simulatedAnswers } from '@/data/questions';
import { inviteCode, token, uid } from '@/lib/ids';
import { computeStreak } from '@/lib/streak';
import { addDays, todayKey } from '@/lib/time';
import { actionDef, applyAction, applyDecision, castVote, currentVote, evaluate, fastForward, gameNow, life, newLifeGame, openVote, redactLifeGame, stageDef } from '@/lib/lifeGame';
import { syncCouple as runCoupleSync } from './coupleSync';
import { remote, remoteConfig, type RemoteCouple, type RemoteUser } from './remote';
import {
  ActivitySession,
  AffectionKind,
  AuthSession,
  BackendError,
  CalendarEvent,
  Couple,
  Entitlements,
  ID,
  Invitation,
  LifeGame,
  LiveInfo,
  MediaAsset,
  Memory,
  Message,
  Moment,
  Profile,
  SharingPermission,
  StreakState,
  Submission,
  WidgetMessage,
} from './types';

export interface OnboardingDraft {
  connectionDraft?: ConnectionPreferences;
  step: number;
  firstName: string;
  avatarUri: string | null;
  pronouns: string | null;
  timezone: string | null;
  relationshipStage: Couple['relationshipStage'];
  relationshipStart: string | null;
  distanceMode: Couple['distanceMode'];
  goals: Couple['goals'];
  nextMeetingDate: string | null;
  nextMeetingDestination: string | null;
  introSeen: boolean;
  completed: boolean;
}

export interface Account {
  id: ID;
  email: string;
  password: string; // demo only — never do this in production
  verified: boolean;
  verificationCode: string;
  resetCode: string | null;
}

export interface DataState {
  connectionPreferences: Record<ID, ConnectionPreferences>;
  session: AuthSession | null;
  pendingInviteCode: string | null;
  onboarding: OnboardingDraft;
  accounts: Account[];
  profiles: Record<ID, Profile>;
  couples: Record<ID, Couple>;
  invitations: Invitation[];
  sharing: Record<ID, SharingPermission>;
  live: Record<ID, LiveInfo>;
  moments: Moment[];
  sessions: ActivitySession[];
  favorites: ID[]; // question ids (per user in prod; demo keeps per device)
  messages: Message[];
  memories: Memory[];
  events: CalendarEvent[];
  widgetMessage: Record<ID, WidgetMessage>; // coupleId -> message
  lifeGames: LifeGame[];
  entitlements: Entitlements;
  hydrated: boolean;
}

export const emptyOnboarding: OnboardingDraft = {
  step: 0,
  firstName: '',
  avatarUri: null,
  pronouns: null,
  timezone: null,
  relationshipStage: null,
  relationshipStart: null,
  distanceMode: null,
  goals: [],
  nextMeetingDate: null,
  nextMeetingDestination: null,
  introSeen: false,
  completed: false,
};

const emptyState: Omit<DataState, 'hydrated'> = {
  connectionPreferences: {},
  session: null,
  pendingInviteCode: null,
  onboarding: emptyOnboarding,
  accounts: [],
  profiles: {},
  couples: {},
  invitations: [],
  sharing: {},
  live: {},
  moments: [],
  sessions: [],
  favorites: [],
  messages: [],
  memories: [],
  events: [],
  widgetMessage: {},
  lifeGames: [],
  entitlements: { premium: false, source: 'none' },
};

export const useData = create<DataState>()(
  persist((): DataState => ({ ...emptyState, hydrated: false }), {
    name: 'together.data.v1',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (s) => {
      const { hydrated: _h, ...rest } = s;
      return rest;
    },
    onRehydrateStorage: () => () => {
      // Older demo data stored the simulated partner's country without its ISO code (needed for the flag).
      const partnerLive = useData.getState().live[SIMULATED_PARTNER_ID];
      if (partnerLive && !partnerLive.countryCode && partnerLive.country === 'Canada') {
        useData.setState((st) => ({ live: { ...st.live, [SIMULATED_PARTNER_ID]: { ...partnerLive, countryCode: 'CA' } } }));
      }
      useData.setState({ hydrated: true });
    },
  }),
);

const now = () => new Date().toISOString();
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const SIMULATED_PARTNER_ID = 'user_demo_partner';
export const DEMO_USER_ID = 'user_demo_me';

function get() {
  return useData.getState();
}
function set(patch: Partial<DataState> | ((s: DataState) => Partial<DataState>)) {
  useData.setState(patch as never);
}

function requireSession(): AuthSession {
  const s = get().session;
  if (!s) throw new BackendError('unauthenticated', 'Please sign in to continue.');
  return s;
}

function coupleOf(userId: ID): Couple | null {
  return Object.values(get().couples).find((c) => c.memberIds.includes(userId)) ?? null;
}

function requireCouple(userId: ID): Couple {
  const c = coupleOf(userId);
  if (!c) throw new BackendError('not_paired', 'Connect with your partner first.');
  return c;
}

function assertMember(coupleId: ID, userId: ID) {
  const c = get().couples[coupleId];
  if (!c || !c.memberIds.includes(userId)) throw new BackendError('forbidden', 'You do not have access to this.');
}

/** Expire stale invitations lazily. */
function sweepInvitations() {
  const t = Date.now();
  set((s) => ({
    invitations: s.invitations.map((i) =>
      i.status === 'pending' && new Date(i.expiresAt).getTime() < t ? { ...i, status: 'expired' } : i,
    ),
  }));
}

/** Redact other members' submissions until the session is revealed. */
export function redactSession(session: ActivitySession, viewerId: ID): ActivitySession {
  if (session.status === 'revealed') return session;
  return {
    ...session,
    submissions: session.submissions.filter((x) => x.userId === viewerId),
    drafts: session.drafts ? { [viewerId]: session.drafts[viewerId] ?? '' } : undefined,
  };
}

function maybeReveal(session: ActivitySession, memberIds: ID[]): ActivitySession {
  const done = memberIds.every((id) => session.submissions.some((x) => x.userId === id));
  if (done && session.status !== 'revealed') return { ...session, status: 'revealed', revealedAt: now() };
  if (!done && session.submissions.length > 0) return { ...session, status: 'waiting' };
  return session;
}

/** Pushes the signed-in user's profile to InsForge, uploading a local photo first. */
async function syncRemoteProfile(userId: ID): Promise<void> {
  if (!remoteConfig.configured) return;
  const p = get().profiles[userId];
  if (!p) return;
  let avatar: { avatar_url?: string | null; avatar_key?: string | null } = {};
  if (p.avatarUri?.startsWith('avatar:')) {
    avatar = { avatar_url: p.avatarUri, avatar_key: null };
  } else if (p.avatarUri && !/^https?:/i.test(p.avatarUri)) {
    const up = await remote.uploadAvatar(userId, p.avatarUri);
    avatar = { avatar_url: up.url, avatar_key: up.key };
    set((st) => ({ profiles: { ...st.profiles, [userId]: { ...st.profiles[userId], avatarUri: up.url } } }));
  } else if (!p.avatarUri) {
    avatar = { avatar_url: null, avatar_key: null };
  }
  await remote.upsertProfile({ id: userId, first_name: p.firstName, pronouns: p.pronouns, timezone: p.timezone, ...avatar });
  const preferences = get().connectionPreferences[userId];
  if (preferences) await remote.saveConnectionPreferences(userId, preferences);
}

/** Creates or refreshes the local mirror of a remote account after sign-up / sign-in. */
/** After InsForge returns a user (password or OAuth): adopt it, then pull preferences + saved profile. */
async function finishRemoteSignIn(user: RemoteUser, useDraft = false): Promise<AuthSession> {
      adoptRemoteUser(user, true, useDraft);
      const preferences = await remote.fetchConnectionPreferences(user.id);
      set(st => { const values = { ...st.connectionPreferences }; if (preferences) values[user.id] = preferences; else if (!useDraft) delete values[user.id]; return { connectionPreferences: values, onboarding: { ...st.onboarding, connectionDraft: undefined } }; });
      const saved = await remote.fetchProfile(user.id);
      if (saved) {
        set((st) => ({ profiles: { ...st.profiles, [user.id]: { ...st.profiles[user.id], firstName: saved.first_name || st.profiles[user.id].firstName, pronouns: saved.pronouns, timezone: saved.timezone, avatarUri: saved.avatar_url ?? st.profiles[user.id].avatarUri } } }));
        if (!saved.avatar_url && get().profiles[user.id].avatarUri) syncInBackground(user.id);
      } else {
        syncInBackground(user.id);
      }
      try { const rc = await remote.myCouple(); if (rc) adoptRemoteCouple(rc); } catch (e) { console.warn('[couple sync]', (e as Error).message); }
      return get().session!;
}

/** Remote accounts (not demo) keep invitations and couples on InsForge. */
function isRemoteSession(): boolean {
  const s = get().session;
  return remoteConfig.configured && !!s && !s.demo;
}

/** Mirror the server's couple + partner profile into local state. */
function adoptRemoteCouple(rc: RemoteCouple): Couple {
  const s = requireSession();
  const existing = get().couples[rc.couple_id];
  const d = get().onboarding;
  const couple: Couple = existing ?? {
    id: rc.couple_id,
    memberIds: [s.userId, rc.partner.id],
    relationshipStage: d.relationshipStage,
    relationshipStart: d.relationshipStart,
    distanceMode: d.distanceMode,
    goals: d.goals,
    coupleTimezone: rc.timezone || 'UTC',
    createdAt: rc.created_at,
  };
  set((st) => ({
    couples: { ...st.couples, [couple.id]: couple },
    profiles: {
      ...st.profiles,
      [rc.partner.id]: { ...(st.profiles[rc.partner.id] ?? {}), id: rc.partner.id, firstName: rc.partner.first_name, timezone: rc.partner.timezone, avatarUri: rc.partner.avatar_url, pronouns: st.profiles[rc.partner.id]?.pronouns ?? null, email: st.profiles[rc.partner.id]?.email ?? '' } as Profile,
    },
    invitations: st.invitations.map((i) => (i.inviterId === s.userId && i.status === 'pending' ? { ...i, status: 'accepted', acceptedBy: rc.partner.id } : i)),
    sharing: {
      ...st.sharing,
      [s.userId]: st.sharing[s.userId] ?? { userId: s.userId, location: false, battery: false, updatedAt: now() },
      [rc.partner.id]: st.sharing[rc.partner.id] ?? { userId: rc.partner.id, location: false, battery: false, updatedAt: now() },
    },
    pendingInviteCode: null,
  }));
  return couple;
}

function adoptRemoteUser(user: { id: string; email: string }, verified: boolean, useDraft = false) {
  const d = get().onboarding;
  set((s) => ({
    profiles: {
      ...s.profiles,
      [user.id]: s.profiles[user.id] ?? { id: user.id, firstName: d.firstName || 'You', avatarUri: d.avatarUri, pronouns: d.pronouns, timezone: d.timezone ?? 'UTC', email: user.email },
    },
    ...(useDraft && d.connectionDraft ? { connectionPreferences: { ...s.connectionPreferences, [user.id]: d.connectionDraft } } : {}),
    session: { userId: user.id, email: user.email, verified, demo: false },
  }));
}

function syncInBackground(userId: ID) {
  syncRemoteProfile(userId).catch((e) => console.warn('[profile sync]', (e as Error).message));
}

export const backend = {
  // ---------- auth ----------
  /** `verificationCode` is only set for local-only accounts (no email service). */
  async signUp(email: string, password: string): Promise<{ verificationCode: string | null; needsVerification: boolean }> {
    const normalized = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw new BackendError('invalid_email', 'Enter a valid email address.');
    if (password.length < 8) throw new BackendError('weak_password', 'Use at least 8 characters.');
    if (remoteConfig.configured) {
      const d = get().onboarding;
      const res = await remote.signUp(normalized, password, d.firstName);
      const user = res.user ?? { id: '', email: normalized };
      if (res.needsVerification) {
        set({ session: { userId: user.id || `pending:${normalized}`, email: normalized, verified: false, demo: false } });
      } else {
        adoptRemoteUser(user, true, true);
        await syncRemoteProfile(user.id);
      }
      return { verificationCode: null, needsVerification: res.needsVerification };
    }
    if (get().accounts.some((a) => a.email === normalized)) throw new BackendError('exists', 'An account with this email already exists. Try signing in.');
    const id = uid('user');
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const account: Account = { id, email: normalized, password, verified: false, verificationCode, resetCode: null };
    const d = get().onboarding;
    const profile: Profile = {
      id,
      firstName: d.firstName || 'You',
      avatarUri: d.avatarUri,
      pronouns: d.pronouns,
      timezone: d.timezone ?? 'UTC',
      email: normalized,
    };
    set((s) => ({
      ...(d.connectionDraft ? { connectionPreferences: { ...s.connectionPreferences, [id]: d.connectionDraft } } : {}),
      accounts: [...s.accounts, account],
      profiles: { ...s.profiles, [id]: profile },
      session: { userId: id, email: normalized, verified: false, demo: false },
    }));
    return { verificationCode, needsVerification: true };
  },

  async verifyEmail(code: string): Promise<void> {
    const s = requireSession();
    if (remoteConfig.configured) {
      const user = await remote.verifyEmail(s.email, code.trim());
      adoptRemoteUser(user, true, true);
      await syncRemoteProfile(user.id);
      return;
    }
    const acc = get().accounts.find((a) => a.id === s.userId);
    if (!acc) throw new BackendError('not_found', 'Account not found.');
    if (acc.verificationCode !== code.trim()) throw new BackendError('bad_code', 'That code does not match. Check the code and try again.');
    set((st) => ({
      accounts: st.accounts.map((a) => (a.id === acc.id ? { ...a, verified: true } : a)),
      session: { ...s, verified: true },
    }));
  },

  async resendVerification(): Promise<{ verificationCode: string | null }> {
    const s = requireSession();
    if (remoteConfig.configured) {
      await remote.resendVerification(s.email);
      return { verificationCode: null };
    }
    const acc = get().accounts.find((a) => a.id === s.userId)!;
    return { verificationCode: acc.verificationCode };
  },

  /** Step 1 of email sign-in / sign-up. `demoCode` is only set when no email service is configured. */
  async sendEmailCode(email: string): Promise<{ demoCode: string | null }> {
    const normalized = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw new BackendError('invalid_email', 'Enter a valid email address.');
    if (remoteConfig.configured) { await remote.sendCode(normalized); return { demoCode: null }; }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const existing = get().accounts.find((a) => a.email === normalized);
    if (existing) {
      set((s) => ({ accounts: s.accounts.map((a) => (a.id === existing.id ? { ...a, verificationCode: code } : a)) }));
    } else {
      const id = uid('user');
      const d = get().onboarding;
      set((s) => ({
        accounts: [...s.accounts, { id, email: normalized, password: '', verified: false, verificationCode: code, resetCode: null }],
        profiles: { ...s.profiles, [id]: { id, firstName: d.firstName || 'You', avatarUri: d.avatarUri, pronouns: d.pronouns, timezone: d.timezone ?? 'UTC', email: normalized } },
      }));
    }
    return { demoCode: code };
  },

  /** Step 2: the code signs the person in, creating the account on first use. */
  async verifyEmailCode(email: string, code: string): Promise<AuthSession> {
    const normalized = email.trim().toLowerCase();
    const otp = code.trim();
    if (remoteConfig.configured) {
      const user = await remote.verifyCode(normalized, otp, get().onboarding.firstName || undefined);
      return finishRemoteSignIn(user, true);
    }
    const acc = get().accounts.find((a) => a.email === normalized);
    if (!acc || acc.verificationCode !== otp) throw new BackendError('bad_code', 'That code does not match. Check the code and try again.');
    const session: AuthSession = { userId: acc.id, email: acc.email, verified: true, demo: false };
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === acc.id ? { ...a, verified: true } : a)), session }));
    return session;
  },

  /** Returns null when the person closes the sign-in sheet. */
  async signInWithOAuth(provider: 'google' | 'apple', returnUrl: string): Promise<AuthSession | null> {
    if (!remoteConfig.configured) throw new BackendError('not_configured', 'Social sign-in needs the online backend.');
    const enabled = await remote.oauthProviders();
    const label = provider[0].toUpperCase() + provider.slice(1);
    if (!enabled.includes(provider)) throw new BackendError('provider_off', `${label} sign-in isn't switched on yet. Use Google or your email for now.`);
    const user = await remote.signInWithOAuth(provider, returnUrl);
    return user ? finishRemoteSignIn(user) : null;
  },

  async signIn(email: string, password: string): Promise<AuthSession> {
    const normalized = email.trim().toLowerCase();
    if (remoteConfig.configured) {
      const user = await remote.signIn(normalized, password);
      return finishRemoteSignIn(user);
    }
    const acc = get().accounts.find((a) => a.email === normalized);
    if (!acc || acc.password !== password) throw new BackendError('bad_credentials', 'Email or password is incorrect.');
    const session: AuthSession = { userId: acc.id, email: acc.email, verified: acc.verified, demo: false };
    set({ session });
    return session;
  },

  async requestPasswordReset(email: string): Promise<{ resetCode: string | null }> {
    const normalized = email.trim().toLowerCase();
    const acc = get().accounts.find((a) => a.email === normalized);
    if (!acc) return { resetCode: null }; // do not reveal whether an account exists
    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === acc.id ? { ...a, resetCode } : a)) }));
    return { resetCode };
  },

  async resetPassword(email: string, code: string, password: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const acc = get().accounts.find((a) => a.email === normalized);
    if (!acc || !acc.resetCode || acc.resetCode !== code.trim()) throw new BackendError('bad_code', 'That reset code is not valid.');
    if (password.length < 8) throw new BackendError('weak_password', 'Use at least 8 characters.');
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === acc.id ? { ...a, password, resetCode: null } : a)) }));
  },

  async signOut(): Promise<void> {
    const s = get().session;
    if (remoteConfig.configured && s && !s.demo) await remote.signOut();
    set(st => ({ session: null, onboarding: { ...st.onboarding, connectionDraft: undefined } }));
  },

  /** Demo mode: a local account with a clearly simulated partner. */
  async startDemo(): Promise<AuthSession> {
    const d = get().onboarding;
    const me: Profile = {
      id: DEMO_USER_ID,
      firstName: d.firstName || 'Sam',
      avatarUri: d.avatarUri,
      pronouns: d.pronouns,
      timezone: d.timezone ?? 'Europe/Paris',
      email: 'demo@together.local',
    };
    const partner: Profile = {
      id: SIMULATED_PARTNER_ID,
      firstName: 'Alex',
      avatarUri: null,
      pronouns: 'they/them',
      timezone: 'America/Montreal',
      email: null,
      isSimulated: true,
    };
    const existing = get().couples['couple_demo'];
    const couple: Couple = existing ?? {
      id: 'couple_demo',
      memberIds: [me.id, partner.id],
      relationshipStage: d.relationshipStage ?? 'committed',
      relationshipStart: d.relationshipStart ?? '2024-02-14',
      distanceMode: d.distanceMode ?? 'long_distance',
      goals: d.goals.length ? d.goals : ['daily_connection', 'planning_visits'],
      coupleTimezone: me.timezone,
      createdAt: now(),
    };
    const session: AuthSession = { userId: me.id, email: me.email!, verified: true, demo: true };
    set((s) => ({
      session,
      ...(d.connectionDraft ? { connectionPreferences: { ...s.connectionPreferences, [me.id]: d.connectionDraft } } : {}),
      profiles: { ...s.profiles, [me.id]: me, [partner.id]: s.profiles[partner.id] ?? partner },
      couples: { ...s.couples, [couple.id]: couple },
      sharing: {
        ...s.sharing,
        [me.id]: s.sharing[me.id] ?? { userId: me.id, location: false, battery: false, updatedAt: now() },
        [partner.id]: s.sharing[partner.id] ?? { userId: partner.id, location: true, battery: true, updatedAt: now() },
      },
      live: {
        ...s.live,
        [partner.id]: s.live[partner.id] ?? {
          userId: partner.id,
          lat: 45.5017,
          lon: -73.5673,
          city: 'Montréal',
          country: 'Canada',
          countryCode: 'CA',
          accuracyMeters: 35,
          locationUpdatedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
          batteryPercent: 64,
          batteryUpdatedAt: new Date(Date.now() - 9 * 60_000).toISOString(),
        },
      },
    }));
    if (!existing) seedDemoContent(couple, me, partner);
    return session;
  },

  // ---------- profiles & couple ----------
  me(): Profile | null {
    const s = get().session;
    return s ? get().profiles[s.userId] ?? null : null;
  },
  couple(): Couple | null {
    const s = get().session;
    return s ? coupleOf(s.userId) : null;
  },
  partner(): Profile | null {
    const s = get().session;
    if (!s) return null;
    const c = coupleOf(s.userId);
    const pid = c?.memberIds.find((id) => id !== s.userId);
    return pid ? get().profiles[pid] ?? null : null;
  },

  async updateProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<void> {
    const s = requireSession();
    set((st) => ({ profiles: { ...st.profiles, [s.userId]: { ...st.profiles[s.userId], ...patch } } }));
    if (!s.demo) await syncRemoteProfile(s.userId);
  },

  async updateCouple(patch: Partial<Omit<Couple, 'id' | 'memberIds'>>): Promise<void> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    set((st) => ({ couples: { ...st.couples, [c.id]: { ...c, ...patch } } }));
  },

  // ---------- invitations ----------
  async createInvitation(): Promise<Invitation> {
    const s = requireSession();
    if (coupleOf(s.userId)) throw new BackendError('already_paired', 'You are already connected with a partner.');
    if (isRemoteSession()) {
      const r = await remote.createInvitation();
      const inv: Invitation = { id: r.code, code: r.code, token: r.code, inviterId: s.userId, inviterName: get().profiles[s.userId]?.firstName ?? 'Your partner', status: 'pending', createdAt: now(), expiresAt: r.expires_at, acceptedBy: null };
      set((st) => ({ invitations: [...st.invitations.map((i) => (i.inviterId === s.userId && i.status === 'pending' ? { ...i, status: 'revoked' as const } : i)), inv] }));
      return inv;
    }
    sweepInvitations();
    const me = get().profiles[s.userId];
    // Revoke previous pending invitations by this user.
    set((st) => ({
      invitations: st.invitations.map((i) => (i.inviterId === s.userId && i.status === 'pending' ? { ...i, status: 'revoked' } : i)),
    }));
    const inv: Invitation = {
      id: uid('inv'),
      code: inviteCode(),
      token: token(),
      inviterId: s.userId,
      inviterName: me?.firstName ?? 'Your partner',
      status: 'pending',
      createdAt: now(),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      acceptedBy: null,
    };
    set((st) => ({ invitations: [...st.invitations, inv] }));
    return inv;
  },

  myInvitation(): Invitation | null {
    const s = get().session;
    if (!s) return null;
    sweepInvitations();
    return [...get().invitations].reverse().find((i) => i.inviterId === s.userId) ?? null;
  },

  async revokeInvitation(id: ID): Promise<void> {
    const s = requireSession();
    set((st) => ({
      invitations: st.invitations.map((i) => (i.id === id && i.inviterId === s.userId && i.status === 'pending' ? { ...i, status: 'revoked' } : i)),
    }));
  },

  /** Look up an invitation to show the inviter before confirming. */
  async previewInvitation(code: string): Promise<{ invitation: Invitation | null; reason: 'ok' | 'invalid' | 'expired' | 'revoked' | 'used' | 'self' }> {
    if (isRemoteSession()) {
      // The server checks the code when it is accepted; codes from other phones can't be read before that.
      const c = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (c.length !== 8) return { invitation: null, reason: 'invalid' };
      return { invitation: { id: c, code: c, token: c, inviterId: '', inviterName: 'your partner', status: 'pending', createdAt: now(), expiresAt: now(), acceptedBy: null }, reason: 'ok' };
    }
    sweepInvitations();
    const c = code.trim().toUpperCase();
    const inv = get().invitations.find((i) => i.code === c || i.token === code.trim());
    if (!inv) return { invitation: null, reason: 'invalid' };
    if (inv.status === 'expired') return { invitation: inv, reason: 'expired' };
    if (inv.status === 'revoked') return { invitation: inv, reason: 'revoked' };
    if (inv.status === 'accepted') return { invitation: inv, reason: 'used' };
    const s = get().session;
    if (s && inv.inviterId === s.userId) return { invitation: inv, reason: 'self' };
    return { invitation: inv, reason: 'ok' };
  },

  async acceptInvitation(code: string): Promise<Couple> {
    const s = requireSession();
    if (coupleOf(s.userId)) throw new BackendError('already_paired', 'You are already connected with a partner.');
    if (isRemoteSession()) return adoptRemoteCouple(await remote.acceptInvitation(code));
    const { invitation, reason } = await backend.previewInvitation(code);
    if (!invitation || reason !== 'ok') {
      const msg: Record<string, string> = {
        invalid: 'That code is not valid. Check it and try again.',
        expired: 'This invitation has expired. Ask your partner for a new one.',
        revoked: 'This invitation was cancelled by your partner.',
        used: 'This invitation has already been used.',
        self: 'You cannot accept your own invitation.',
      };
      throw new BackendError(reason, msg[reason] ?? 'Invitation not available.');
    }
    if (coupleOf(invitation.inviterId)) throw new BackendError('inviter_paired', 'Your partner is already connected with someone.');
    const d = get().onboarding;
    const couple: Couple = {
      id: uid('couple'),
      memberIds: [invitation.inviterId, s.userId],
      relationshipStage: d.relationshipStage,
      relationshipStart: d.relationshipStart,
      distanceMode: d.distanceMode,
      goals: d.goals,
      coupleTimezone: get().profiles[invitation.inviterId]?.timezone ?? get().profiles[s.userId]?.timezone ?? 'UTC',
      createdAt: now(),
    };
    set((st) => ({
      couples: { ...st.couples, [couple.id]: couple },
      invitations: st.invitations.map((i) => (i.id === invitation.id ? { ...i, status: 'accepted', acceptedBy: s.userId } : i)),
      sharing: {
        ...st.sharing,
        [s.userId]: st.sharing[s.userId] ?? { userId: s.userId, location: false, battery: false, updatedAt: now() },
        [invitation.inviterId]: st.sharing[invitation.inviterId] ?? { userId: invitation.inviterId, location: false, battery: false, updatedAt: now() },
      },
      pendingInviteCode: null,
    }));
    return couple;
  },

  // ---------- shared content across phones (docs/SYNC.md) ----------
  async syncShared(): Promise<void> {
    if (!isRemoteSession()) return;
    await runCoupleSync({ get: () => get(), set: (fn) => set((st) => fn(st) as Partial<DataState>) });
  },

  // ---------- live status across phones ----------
  /** Uploads my shared values (only what my switches allow) and pulls my partner's. */
  async syncLive(mine: { lat?: number | null; lon?: number | null; country?: string | null; countryCode?: string | null; battery?: number | null }): Promise<void> {
    if (!isRemoteSession()) return;
    const s = requireSession();
    const c = coupleOf(s.userId);
    if (!c) return;
    const perm = get().sharing[s.userId];
    await remote.updateLive({ shareLocation: !!perm?.location, shareBattery: !!perm?.battery, ...(perm?.location ? mine : {}), battery: perm?.battery ? mine.battery : null });
    const theirs = await remote.partnerLive();
    const partnerId = c.memberIds.find((m) => m !== s.userId);
    if (!theirs || theirs.user_id !== partnerId) return;
    set((st) => ({
      sharing: { ...st.sharing, [partnerId]: { userId: partnerId, location: theirs.share_location, battery: theirs.share_battery, updatedAt: now() } },
      live: {
        ...st.live,
        [partnerId]: {
          ...({ city: null, accuracyMeters: null } as Partial<LiveInfo>),
          ...st.live[partnerId],
          userId: partnerId,
          lat: theirs.lat, lon: theirs.lon, country: theirs.country, countryCode: theirs.country_code, locationUpdatedAt: theirs.location_at,
          batteryPercent: theirs.battery, batteryUpdatedAt: theirs.battery_at,
        } as LiveInfo,
      },
    }));
  },

  // ---------- affection ----------
  /** Saves the emoji and pushes it to the partner. The simulated partner sends one back. */
  async sendAffection(emoji: string): Promise<{ simulatedReply: boolean }> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    if (!isRemoteSession()) {
      const partner = get().profiles[c.memberIds.find((m) => m !== s.userId) ?? ''];
      return { simulatedReply: !!partner?.isSimulated };
    }
    const id = await remote.sendAffection(emoji);
    remote.pushAffection(id);
    return { simulatedReply: false };
  },
  async receivedAffections(since: string) {
    return isRemoteSession() ? remote.receivedAffections(since) : [];
  },
  isRemoteSession,

  /** Pull the partner connection from the server (e.g. after the partner entered our code). */
  async syncCouple(): Promise<Couple | null> {
    if (!isRemoteSession()) return coupleOf(requireSession().userId);
    const rc = await remote.myCouple();
    return rc ? adoptRemoteCouple(rc) : null;
  },

  async unlink(): Promise<void> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    if (isRemoteSession()) await remote.unlinkCouple();
    // Access is revoked immediately: couple resources are removed from this device
    // and the couple record is deleted. Shared content retention is described in
    // docs/BACKEND.md (30-day export window server-side).
    set((st) => {
      const couples = { ...st.couples };
      delete couples[c.id];
      const widgetMessage = { ...st.widgetMessage };
      delete widgetMessage[c.id];
      return {
        couples,
        widgetMessage,
        moments: st.moments.filter((m) => m.coupleId !== c.id),
        sessions: st.sessions.filter((x) => x.coupleId !== c.id),
        messages: st.messages.filter((m) => m.coupleId !== c.id),
        memories: st.memories.filter((m) => m.coupleId !== c.id),
        events: st.events.filter((e) => e.coupleId !== c.id),
        lifeGames: st.lifeGames.filter((g) => g.coupleId !== c.id),
        live: Object.fromEntries(Object.entries(st.live).filter(([id]) => c.memberIds.indexOf(id) === -1 || id === s.userId)),
      };
    });
  },

  async deleteAccount(): Promise<void> {
    const s = requireSession();
    const c = coupleOf(s.userId);
    if (c) await backend.unlink();
    set((st) => {
      const profiles = { ...st.profiles };
      delete profiles[s.userId];
      const connectionPreferences = { ...st.connectionPreferences }; delete connectionPreferences[s.userId];
      return { profiles, connectionPreferences, accounts: st.accounts.filter((a) => a.id !== s.userId), session: null, onboarding: emptyOnboarding };
    });
  },

  // ---------- sharing & live ----------
  async setSharing(patch: Partial<Pick<SharingPermission, 'location' | 'battery'>>): Promise<void> {
    const s = requireSession();
    set((st) => {
      const prev = st.sharing[s.userId] ?? { userId: s.userId, location: false, battery: false, updatedAt: now() };
      const next = { ...prev, ...patch, updatedAt: now() };
      const live = { ...st.live };
      // Turning sharing off revokes access to the live values immediately.
      if (live[s.userId]) {
        if (patch.location === false) live[s.userId] = { ...live[s.userId], lat: null, lon: null, city: null, country: null, countryCode: null, accuracyMeters: null, locationUpdatedAt: null };
        if (patch.battery === false) live[s.userId] = { ...live[s.userId], batteryPercent: null, batteryUpdatedAt: null };
      }
      return { sharing: { ...st.sharing, [s.userId]: next }, live };
    });
  },

  async pushLive(patch: Partial<Omit<LiveInfo, 'userId'>>): Promise<void> {
    const s = requireSession();
    const perm = get().sharing[s.userId];
    const allowed: Partial<LiveInfo> = {};
    if (perm?.location && ('lat' in patch || 'city' in patch)) Object.assign(allowed, { lat: patch.lat ?? null, lon: patch.lon ?? null, city: patch.city ?? null, country: patch.country ?? null, countryCode: patch.countryCode ?? null, accuracyMeters: patch.accuracyMeters ?? null, locationUpdatedAt: now() });
    if (perm?.battery && 'batteryPercent' in patch) Object.assign(allowed, { batteryPercent: patch.batteryPercent ?? null, batteryUpdatedAt: now() });
    if (Object.keys(allowed).length === 0) return;
    set((st) => ({
      live: {
        ...st.live,
        [s.userId]: { ...({ userId: s.userId, lat: null, lon: null, city: null, country: null, accuracyMeters: null, locationUpdatedAt: null, batteryPercent: null, batteryUpdatedAt: null } as LiveInfo), ...st.live[s.userId], ...allowed },
      },
    }));
  },

  /** Live info of a member, filtered by that member's sharing permission. */
  liveFor(userId: ID): LiveInfo | null {
    const s = get().session;
    if (!s) return null;
    const c = coupleOf(s.userId);
    if (!c || !c.memberIds.includes(userId)) return null;
    const perm = get().sharing[userId];
    const info = get().live[userId];
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
  },

  // ---------- moments & streak ----------
  async addMoment(media: MediaAsset, caption: string | null, clientRequestId: string): Promise<Moment> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    const existing = get().moments.find((m) => m.clientRequestId === clientRequestId);
    if (existing) return existing; // idempotent retry
    const moment: Moment = {
      id: uid('moment'),
      coupleId: c.id,
      authorId: s.userId,
      dayKey: todayKey(c.coupleTimezone),
      media,
      caption,
      createdAt: now(),
      clientRequestId,
    };
    const memory: Memory = {
      id: uid('mem'),
      coupleId: c.id,
      ownerId: s.userId,
      kind: 'moment',
      media,
      title: null,
      body: null,
      caption,
      takenOn: moment.dayKey,
      createdAt: moment.createdAt,
      favoritedBy: [],
      momentId: moment.id,
    };
    set((st) => ({ moments: [...st.moments, moment], memories: [memory, ...st.memories] }));
    if (s.demo) scheduleSimulatedMoment(c, s.userId);
    return moment;
  },

  async updateMomentMedia(momentId: ID, patch: Partial<MediaAsset>): Promise<void> {
    set((st) => ({
      moments: st.moments.map((m) => (m.id === momentId ? { ...m, media: { ...m.media, ...patch } } : m)),
      memories: st.memories.map((m) => (m.momentId === momentId && m.media ? { ...m, media: { ...m.media, ...patch } } : m)),
    }));
  },

  momentsFor(coupleId: ID): Moment[] {
    const s = get().session;
    if (!s) return [];
    assertMember(coupleId, s.userId);
    return get().moments.filter((m) => m.coupleId === coupleId);
  },

  streak(): StreakState | null {
    const s = get().session;
    if (!s) return null;
    const c = coupleOf(s.userId);
    if (!c) return null;
    return computeStreak(backend.momentsFor(c.id), c.memberIds, todayKey(c.coupleTimezone));
  },

  // ---------- activities ----------
  /** Read-only lookup of today's daily session. */
  findDailySession(): ActivitySession | null {
    const s = get().session;
    const c = s ? coupleOf(s.userId) : null;
    if (!s || !c) return null;
    const day = todayKey(c.coupleTimezone);
    const q = dailyQuestionFor(day);
    const existing = get().sessions.find((x) => x.coupleId === c.id && x.deckId === 'deck_daily' && x.questionId === q.id && x.createdAt.slice(0, 10) >= day.slice(0, 10));
    return existing ? redactSession(existing, s.userId) : null;
  },

  /** Returns today's daily session, creating it if needed (call from effects/handlers). */
  dailySession(): ActivitySession {
    const s = requireSession();
    const c = requireCouple(s.userId);
    const day = todayKey(c.coupleTimezone);
    const q = dailyQuestionFor(day);
    const existing = backend.findDailySession();
    if (existing) return existing;
    const session: ActivitySession = { id: uid('sess'), coupleId: c.id, deckId: 'deck_daily', questionId: q.id, status: 'in_progress', createdAt: now(), revealedAt: null, submissions: [], reactions: {} };
    set((st) => ({ sessions: [session, ...st.sessions] }));
    return session;
  },

  async startSession(deckId: ID, questionId: ID): Promise<ActivitySession> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    const open = get().sessions.find((x) => x.coupleId === c.id && x.questionId === questionId && x.status !== 'revealed' && x.status !== 'abandoned');
    if (open) return redactSession(open, s.userId); // resume
    const session: ActivitySession = { id: uid('sess'), coupleId: c.id, deckId, questionId, status: 'in_progress', createdAt: now(), revealedAt: null, submissions: [], reactions: {} };
    set((st) => ({ sessions: [session, ...st.sessions] }));
    return session;
  },

  session(id: ID): ActivitySession | null {
    const s = get().session;
    if (!s) return null;
    const x = get().sessions.find((y) => y.id === id);
    if (!x) return null;
    assertMember(x.coupleId, s.userId);
    return redactSession(x, s.userId);
  },

  sessions(): ActivitySession[] {
    const s = get().session;
    if (!s) return [];
    const c = coupleOf(s.userId);
    if (!c) return [];
    return get().sessions.filter((x) => x.coupleId === c.id).map((x) => redactSession(x, s.userId));
  },

  async saveDraft(sessionId: ID, text: string): Promise<void> {
    const s = requireSession();
    set((st) => ({ sessions: st.sessions.map((x) => (x.id === sessionId ? { ...x, drafts: { ...(x.drafts ?? {}), [s.userId]: text } } : x)) }));
  },

  /** Protected submission endpoint: answers are locked once submitted. */
  async submit(sessionId: ID, answer: string, comment: string | null, skipped = false): Promise<ActivitySession> {
    const s = requireSession();
    const x = get().sessions.find((y) => y.id === sessionId);
    if (!x) throw new BackendError('not_found', 'This activity no longer exists.');
    assertMember(x.coupleId, s.userId);
    if (x.status === 'revealed') throw new BackendError('locked', 'Answers cannot change after they are revealed.');
    if (x.status === 'abandoned') throw new BackendError('abandoned', 'This session was closed.');
    if (x.submissions.some((sub) => sub.userId === s.userId)) throw new BackendError('duplicate', 'You already answered this one.');
    if (!skipped && !answer.trim()) throw new BackendError('empty', 'Write an answer or skip the question.');
    const sub: Submission = { userId: s.userId, answer: skipped ? '' : answer.trim(), comment, skipped, submittedAt: now() };
    const c = get().couples[x.coupleId];
    let next: ActivitySession = { ...x, submissions: [...x.submissions, sub], drafts: undefined };
    next = maybeReveal(next, c.memberIds);
    set((st) => ({ sessions: st.sessions.map((y) => (y.id === sessionId ? next : y)) }));
    if (s.demo) scheduleSimulatedAnswer(next, c);
    return redactSession(next, s.userId);
  },

  async abandonSession(sessionId: ID): Promise<void> {
    const s = requireSession();
    set((st) => ({ sessions: st.sessions.map((x) => (x.id === sessionId && x.coupleId === coupleOf(s.userId)?.id && x.status !== 'revealed' ? { ...x, status: 'abandoned' } : x)) }));
  },

  async react(sessionId: ID, emoji: string): Promise<void> {
    const s = requireSession();
    set((st) => ({ sessions: st.sessions.map((x) => (x.id === sessionId ? { ...x, reactions: { ...x.reactions, [s.userId]: emoji } } : x)) }));
  },

  async toggleFavorite(questionId: ID): Promise<void> {
    set((st) => ({ favorites: st.favorites.includes(questionId) ? st.favorites.filter((x) => x !== questionId) : [...st.favorites, questionId] }));
  },

  // ---------- messages ----------
  async sendMessage(input: { kind: Message['kind']; affection?: AffectionKind; text?: string | null; media?: MediaAsset | null; context?: string | null; clientRequestId: string }): Promise<Message> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    const existing = get().messages.find((m) => m.clientRequestId === input.clientRequestId);
    if (existing) return existing;
    const msg: Message = {
      id: uid('msg'),
      coupleId: c.id,
      senderId: s.userId,
      kind: input.kind,
      affection: input.affection,
      text: input.text ?? null,
      media: input.media ?? null,
      context: input.context ?? null,
      createdAt: now(),
      delivery: 'sent',
      readAt: null,
      reactions: {},
      clientRequestId: input.clientRequestId,
    };
    set((st) => ({ messages: [...st.messages, msg] }));
    if (s.demo) scheduleSimulatedReply(c, msg);
    return msg;
  },

  async markDelivery(id: ID, delivery: Message['delivery']): Promise<void> {
    set((st) => ({ messages: st.messages.map((m) => (m.id === id ? { ...m, delivery } : m)) }));
  },

  messages(): Message[] {
    const s = get().session;
    if (!s) return [];
    const c = coupleOf(s.userId);
    if (!c) return [];
    return get().messages.filter((m) => m.coupleId === c.id);
  },

  async markRead(): Promise<void> {
    const s = requireSession();
    const t = now();
    set((st) => ({ messages: st.messages.map((m) => (m.senderId !== s.userId && !m.readAt ? { ...m, readAt: t } : m)) }));
  },

  async reactToMessage(id: ID, emoji: string): Promise<void> {
    const s = requireSession();
    set((st) => ({ messages: st.messages.map((m) => (m.id === id ? { ...m, reactions: { ...m.reactions, [s.userId]: emoji } } : m)) }));
  },

  // ---------- memories ----------
  memories(): Memory[] {
    const s = get().session;
    if (!s) return [];
    const c = coupleOf(s.userId);
    if (!c) return [];
    return get().memories.filter((m) => m.coupleId === c.id);
  },

  async addMemory(input: Omit<Memory, 'id' | 'coupleId' | 'ownerId' | 'createdAt' | 'favoritedBy'>): Promise<Memory> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    const mem: Memory = { ...input, id: uid('mem'), coupleId: c.id, ownerId: s.userId, createdAt: now(), favoritedBy: [] };
    set((st) => ({ memories: [mem, ...st.memories] }));
    return mem;
  },

  async updateMemory(id: ID, patch: Partial<Pick<Memory, 'title' | 'body' | 'caption' | 'takenOn' | 'media'>>): Promise<void> {
    const s = requireSession();
    set((st) => ({ memories: st.memories.map((m) => (m.id === id && m.ownerId === s.userId ? { ...m, ...patch } : m)) }));
  },

  async toggleMemoryFavorite(id: ID): Promise<void> {
    const s = requireSession();
    set((st) => ({
      memories: st.memories.map((m) =>
        m.id === id ? { ...m, favoritedBy: m.favoritedBy.includes(s.userId) ? m.favoritedBy.filter((x) => x !== s.userId) : [...m.favoritedBy, s.userId] } : m,
      ),
    }));
  },

  /** Only the owner can delete. Deleting a moment's memory also removes the moment (and may affect the streak). */
  async deleteMemory(id: ID): Promise<void> {
    const s = requireSession();
    const m = get().memories.find((x) => x.id === id);
    if (!m) return;
    if (m.ownerId !== s.userId) throw new BackendError('forbidden', 'Only the person who added this can delete it.');
    set((st) => ({ memories: st.memories.filter((x) => x.id !== id), moments: m.momentId ? st.moments.filter((x) => x.id !== m.momentId) : st.moments }));
  },

  // ---------- calendar ----------
  events(): CalendarEvent[] {
    const s = get().session;
    if (!s) return [];
    const c = coupleOf(s.userId);
    if (!c) return [];
    return get().events.filter((e) => e.coupleId === c.id);
  },

  async upsertEvent(input: Omit<CalendarEvent, 'id' | 'coupleId' | 'createdBy'> & { id?: ID }): Promise<CalendarEvent> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    if (input.id) {
      const existing = get().events.find((e) => e.id === input.id);
      if (!existing) throw new BackendError('not_found', 'Event not found.');
      assertMember(existing.coupleId, s.userId);
      const next = { ...existing, ...input, id: existing.id };
      set((st) => ({ events: st.events.map((e) => (e.id === existing.id ? next : e)) }));
      return next;
    }
    const ev: CalendarEvent = { ...input, id: uid('evt'), coupleId: c.id, createdBy: s.userId };
    set((st) => ({ events: [...st.events, ev] }));
    return ev;
  },

  async deleteEvent(id: ID): Promise<void> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    set((st) => ({ events: st.events.filter((e) => !(e.id === id && e.coupleId === c.id)) }));
  },

  // ---------- widgets ----------
  async setWidgetMessage(text: string): Promise<void> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    set((st) => ({ widgetMessage: { ...st.widgetMessage, [c.id]: { text: text.trim().slice(0, 80), authorId: s.userId, updatedAt: now() } } }));
  },
  widgetMessage(): WidgetMessage | null {
    const c = backend.couple();
    return c ? get().widgetMessage[c.id] ?? null : null;
  },

  // ---------- entitlements (demo billing) ----------
  async setDemoPremium(premium: boolean): Promise<void> {
    set({ entitlements: { premium, source: premium ? 'demo' : 'none' } });
  },

  connectionPreferences(): ConnectionPreferences | null {
    const session = get().session;
    return session ? get().connectionPreferences[session.userId] ?? null : null;
  },
  saveConnectionDraft(answers: Record<string, string>, completed = false) {
    const draft = { version: connectionFlow.version, answers: validateConnectionAnswers(answers), completed, updatedAt: now() };
    set(st => ({ onboarding: { ...st.onboarding, connectionDraft: draft } }));
  },
  async saveConnectionPreferences(answers: Record<string, string>): Promise<void> {
    const session = requireSession();
    if (!session.verified && !session.demo) throw new BackendError('unverified', 'Verify your account before saving preferences.');
    const value = { version: connectionFlow.version, answers: validateConnectionAnswers(answers), completed: true, updatedAt: now() };
    // Write remotely before reporting success. A failed save leaves the prior settings intact.
    if (remoteConfig.configured && !session.demo) await remote.saveConnectionPreferences(session.userId, value);
    set(st => ({ connectionPreferences: { ...st.connectionPreferences, [session.userId]: value } }));
  },
  // ---------- onboarding ----------
  /** `step` is the furthest step reached and never moves backwards. */
  saveOnboarding(patch: Partial<OnboardingDraft>) {
    set((st) => ({ onboarding: { ...st.onboarding, ...patch, step: Math.max(st.onboarding.step, patch.step ?? 0) } }));
  },
  setPendingInvite(code: string | null) {
    set({ pendingInviteCode: code });
  },

  // ---------- Our Little One ----------
  /** The couple's current (or most recent) life game, brought up to date and redacted for the viewer. */
  lifeGame(): LifeGame | null {
    const s = get().session;
    if (!s) return null;
    const c = coupleOf(s.userId);
    if (!c) return null;
    const g = latestLifeGame(c.id);
    return g ? redactLifeGame(g, s.userId) : null;
  },

  /** Decay needs, grow, open stage votes and end at the one-year limit. Called whenever the game is opened. */
  async refreshLifeGame(): Promise<LifeGame | null> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    const g = latestLifeGame(c.id);
    if (!g) return null;
    const next = evaluate(g, gameNow(g), uid);
    saveLifeGame(next);
    if (s.demo) scheduleSimulatedLifeCare(next, c, s.userId);
    return redactLifeGame(next, s.userId);
  },

  /** One parent proposes; the baby only arrives once the other parent accepts. */
  async proposeBaby(): Promise<LifeGame> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    if (c.memberIds.length < 2) throw new BackendError('not_paired', 'You need your partner connected to have a baby together.');
    const cur = latestLifeGame(c.id);
    if (cur && cur.status !== 'ended') return redactLifeGame(cur, s.userId);
    const g = newLifeGame(uid('life'), c.id, s.userId, now(), uid);
    set((st) => ({ lifeGames: [g, ...st.lifeGames] }));
    if (s.demo) scheduleSimulatedLifeAccept(g, c);
    return g;
  },

  async respondToBaby(accept: boolean): Promise<LifeGame | null> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    const g = latestLifeGame(c.id);
    if (!g || g.status !== 'proposed') throw new BackendError('not_found', 'There is no baby proposal waiting.');
    if (g.proposedBy === s.userId) throw new BackendError('forbidden', 'Your partner has to answer this one.');
    return acceptOrDecline(g, c, s.userId, accept);
  },

  async lifeAction(actionId: string): Promise<LifeGame> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    const g = latestLifeGame(c.id);
    if (!g) throw new BackendError('not_found', 'You don’t have a little one yet.');
    const t = gameNow(g);
    let next: LifeGame;
    try {
      next = applyAction(evaluate(g, t, uid), actionId, s.userId, t, uid);
    } catch (e) {
      throw new BackendError('invalid', (e as Error).message);
    }
    next = evaluate(next, t, uid);
    saveLifeGame(next);
    if (s.demo) scheduleSimulatedLifeCare(next, c, s.userId);
    return redactLifeGame(next, s.userId);
  },

  async castLifeVote(voteId: ID, optionId: string): Promise<LifeGame> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    const g = latestLifeGame(c.id);
    const v = g?.votes.find((x) => x.id === voteId);
    if (!g || !v) throw new BackendError('not_found', 'This choice no longer exists.');
    if (v.picks[s.userId]) throw new BackendError('duplicate', 'You already picked. Waiting for your partner.');
    const next = resolveVote(g, c, voteId, s.userId, optionId);
    if (s.demo) scheduleSimulatedLifeVote(next, c, s.userId);
    return redactLifeGame(next, s.userId);
  },

  /** Demo builds only: pretend both parents cared well for `days`, so every stage can be tried quickly. */
  async fastForwardLife(days: number): Promise<LifeGame> {
    const s = requireSession();
    if (!s.demo) throw new BackendError('forbidden', 'Fast-forward is only available in the demo.');
    const c = requireCouple(s.userId);
    const g = latestLifeGame(c.id);
    if (!g || g.status !== 'alive') throw new BackendError('not_found', 'There is no little one to fast-forward.');
    const next = fastForward(g, days, Date.now(), uid);
    saveLifeGame(next);
    if (s.demo) {
      scheduleSimulatedLifeVote(next, c, s.userId);
      scheduleSimulatedLifeCare(next, c, s.userId);
    }
    return redactLifeGame(next, s.userId);
  },

  /** Save the life story to Memories as a letter, once. */
  async saveLifeKeepsake(): Promise<Memory> {
    const s = requireSession();
    const c = requireCouple(s.userId);
    const g = latestLifeGame(c.id);
    if (!g || g.status !== 'ended') throw new BackendError('not_ready', 'The story isn’t finished yet.');
    if (g.keepsakeSaved) throw new BackendError('duplicate', 'This story is already in your Memories.');
    const story = [...g.milestones].reverse().map((m) => `• ${m.text}`).join('\n');
    const mem = await backend.addMemory({ kind: 'letter', media: null, title: `The life of ${g.name}`, body: `${g.ending}\n\n${story}`, caption: null, takenOn: todayKey(c.coupleTimezone) });
    saveLifeGame({ ...g, keepsakeSaved: true });
    return mem;
  },

  /** Export everything the current user can see (demo-grade JSON export). */
  exportData(): string {
    const s = requireSession();
    const c = coupleOf(s.userId);
    const st = get();
    return JSON.stringify(
      {
        exportedAt: now(),
        profile: st.profiles[s.userId],
        connectionPreferences: st.connectionPreferences[s.userId] ?? null,
        couple: c,
        moments: c ? st.moments.filter((m) => m.coupleId === c.id) : [],
        sessions: c ? st.sessions.filter((x) => x.coupleId === c.id).map((x) => redactSession(x, s.userId)) : [],
        messages: c ? st.messages.filter((m) => m.coupleId === c.id) : [],
        memories: c ? st.memories.filter((m) => m.coupleId === c.id) : [],
        events: c ? st.events.filter((e) => e.coupleId === c.id) : [],
        lifeGames: c ? st.lifeGames.filter((g) => g.coupleId === c.id).map((g) => redactLifeGame(g, s.userId)) : [],
      },
      null,
      2,
    );
  },

  /** Wipe all local data (used by "Reset demo" and tests). */
  async resetAll(): Promise<void> {
    useData.setState({ ...emptyState, hydrated: true });
  },
};

// ---------- demo simulation ----------
const SIM_DELAY = 2500;
const timers: ReturnType<typeof setTimeout>[] = [];
function later(fn: () => void, ms = SIM_DELAY) {
  timers.push(setTimeout(fn, ms));
}
export function cancelSimulations() {
  timers.forEach(clearTimeout);
  timers.length = 0;
}

function scheduleSimulatedAnswer(session: ActivitySession, couple: Couple) {
  if (session.status === 'revealed') return;
  const partnerId = couple.memberIds.find((id) => id !== session.submissions[0]?.userId);
  if (partnerId !== SIMULATED_PARTNER_ID) return;
  later(() => {
    const cur = get().sessions.find((x) => x.id === session.id);
    if (!cur || cur.status === 'revealed' || cur.status === 'abandoned' || cur.submissions.some((x) => x.userId === partnerId)) return;
    const q = questionById(cur.questionId);
    const answer = q?.options ? q.options[Math.floor(Math.random() * q.options.length)] : simulatedAnswers[cur.questionId] ?? simulatedAnswers.default;
    const chosen = q?.options && simulatedAnswers[cur.questionId] && q.options.includes(simulatedAnswers[cur.questionId]) ? simulatedAnswers[cur.questionId] : answer;
    const next = maybeReveal({ ...cur, submissions: [...cur.submissions, { userId: partnerId, answer: chosen, comment: null, skipped: false, submittedAt: now() }] }, couple.memberIds);
    set((st) => ({ sessions: st.sessions.map((x) => (x.id === cur.id ? next : x)) }));
  }, SIM_DELAY + Math.random() * 2000);
}

function scheduleSimulatedMoment(couple: Couple, userId: ID) {
  const partnerId = couple.memberIds.find((id) => id !== userId);
  if (partnerId !== SIMULATED_PARTNER_ID) return;
  const day = todayKey(couple.coupleTimezone);
  if (get().moments.some((m) => m.coupleId === couple.id && m.authorId === partnerId && m.dayKey === day)) return;
  later(() => {
    if (get().moments.some((m) => m.coupleId === couple.id && m.authorId === partnerId && m.dayKey === day)) return;
    const media: MediaAsset = { id: uid('media'), kind: 'photo', uri: demoImage(day.length + 3), uploadState: 'uploaded', createdAt: now() };
    const moment: Moment = { id: uid('moment'), coupleId: couple.id, authorId: partnerId, dayKey: day, media, caption: 'Simulated partner moment: evening light on the balcony.', createdAt: now(), clientRequestId: uid('sim') };
    const memory: Memory = { id: uid('mem'), coupleId: couple.id, ownerId: partnerId, kind: 'moment', media, title: null, body: null, caption: moment.caption, takenOn: day, createdAt: moment.createdAt, favoritedBy: [], momentId: moment.id };
    set((st) => ({ moments: [...st.moments, moment], memories: [memory, ...st.memories] }));
  }, 6000);
}

function scheduleSimulatedReply(couple: Couple, msg: Message) {
  const partnerId = couple.memberIds.find((id) => id !== msg.senderId);
  if (partnerId !== SIMULATED_PARTNER_ID) return;
  later(() => {
    const replies: Record<string, string> = {
      kiss: 'Sending one right back 😘 (simulated)',
      hug: 'Big hug received. Needed that. (simulated)',
      thinking: 'Me too. All day. (simulated)',
      need_you: "I'm here. Call whenever you can. (simulated)",
    };
    const text = msg.kind === 'affection' && msg.affection ? replies[msg.affection] : msg.kind === 'voice' ? 'Loved hearing your voice. (simulated reply)' : 'Reading this with a smile. (simulated reply)';
    const reply: Message = { id: uid('msg'), coupleId: couple.id, senderId: partnerId, kind: 'text', text, media: null, createdAt: now(), delivery: 'sent', readAt: null, reactions: {}, clientRequestId: uid('sim') };
    set((st) => ({ messages: [...st.messages.map((m) => (m.id === msg.id ? { ...m, readAt: now() } : m)), reply] }));
  }, SIM_DELAY + 1500);
}

/** Picsum placeholder images keep demo media clearly synthetic. */
// ---------- Our Little One helpers ----------
function latestLifeGame(coupleId: ID): LifeGame | null {
  return get().lifeGames.find((g) => g.coupleId === coupleId) ?? null;
}
function saveLifeGame(g: LifeGame) {
  set((st) => ({ lifeGames: st.lifeGames.map((x) => (x.id === g.id ? g : x)) }));
}
function acceptOrDecline(g: LifeGame, c: Couple, userId: ID, accept: boolean): LifeGame | null {
  if (!accept) {
    set((st) => ({ lifeGames: st.lifeGames.filter((x) => x.id !== g.id) }));
    return null;
  }
  const iso = now();
  const accepted: LifeGame = { ...g, status: 'naming', acceptedBy: [...new Set([...g.acceptedBy, userId])] };
  const next: LifeGame = { ...accepted, votes: [openVote(accepted, 'name', uid('vote'), iso)] };
  saveLifeGame(next);
  return redactLifeGame(next, userId);
}
function resolveVote(g: LifeGame, c: Couple, voteId: ID, userId: ID, optionId: string): LifeGame {
  let vote = g.votes.find((x) => x.id === voteId)!;
  try {
    vote = castVote(vote, userId, optionId, c.memberIds);
  } catch (e) {
    throw new BackendError('invalid', (e as Error).message);
  }
  let next: LifeGame = { ...g, votes: g.votes.map((x) => (x.id === voteId ? vote : x)) };
  if (vote.status === 'decided') {
    const t = gameNow(next);
    next = evaluate(applyDecision(next, vote, t, uid), t, uid);
  }
  saveLifeGame(next);
  return next;
}

const LIFE_SIM_GAP_MS = 90 * 1000;
function scheduleSimulatedLifeAccept(g: LifeGame, c: Couple) {
  const partnerId = c.memberIds.find((id) => id !== g.proposedBy);
  if (partnerId !== SIMULATED_PARTNER_ID) return;
  later(() => {
    const cur = latestLifeGame(c.id);
    if (!cur || cur.id !== g.id || cur.status !== 'proposed') return;
    const next = acceptOrDecline(cur, c, partnerId, true);
    if (next) scheduleSimulatedLifeVote(latestLifeGame(c.id)!, c, g.proposedBy);
  });
}
/** The simulated partner votes after a short delay. It agrees with your pick most of the time. */
function scheduleSimulatedLifeVote(g: LifeGame, c: Couple, userId: ID) {
  const partnerId = c.memberIds.find((id) => id !== userId);
  if (partnerId !== SIMULATED_PARTNER_ID) return;
  const open = currentVote(g);
  if (!open || open.picks[partnerId]) return;
  later(() => {
    const cur = latestLifeGame(c.id);
    const v = cur?.votes.find((x) => x.id === open.id);
    if (!cur || !v || v.status !== 'open' || v.picks[partnerId]) return;
    // Lean towards agreeing: copy your pick (or your last-round pick) most of the time.
    const mine = v.picks[userId] ?? v.previousPicks?.[userId];
    const pick = mine && Math.random() < 0.75 ? mine : v.options[Math.floor(Math.random() * v.options.length)];
    resolveVote(cur, c, v.id, partnerId, pick);
    const after = latestLifeGame(c.id);
    if (after) scheduleSimulatedLifeVote(after, c, userId);
  }, SIM_DELAY + Math.random() * 2000);
}
/** The simulated partner looks after the child now and then, so co-parenting shows up in the care log. */
function scheduleSimulatedLifeCare(g: LifeGame, c: Couple, userId: ID) {
  const partnerId = c.memberIds.find((id) => id !== userId);
  if (partnerId !== SIMULATED_PARTNER_ID || g.status !== 'alive') return;
  const last = g.log.find((e) => e.userId === partnerId);
  if (last && gameNow(g) - Date.parse(last.at) < LIFE_SIM_GAP_MS) return;
  later(() => {
    const cur = latestLifeGame(c.id);
    if (!cur || cur.status !== 'alive') return;
    const t = gameNow(cur);
    const fresh = evaluate(cur, t, uid);
    const options = stageDef(fresh.stage).actions;
    const neediest = [...life.needs].sort((a, b) => fresh.needs[a.id] - fresh.needs[b.id])[0].id;
    const action = options.find((id) => (actionDef(id)?.effects[neediest] ?? 0) > 0) ?? options[0];
    saveLifeGame(evaluate(applyAction(fresh, action, partnerId, t, uid), t, uid));
  }, SIM_DELAY * 2 + Math.random() * 3000);
}

export function demoImage(seed: number, w = 480, h = 640) {
  return `https://picsum.photos/seed/together${seed}/${w}/${h}`;
}

function seedDemoContent(couple: Couple, me: Profile, partner: Profile) {
  const tz = couple.coupleTimezone;
  const today = todayKey(tz);
  const moments: Moment[] = [];
  const memories: Memory[] = [];
  // 9-day history: a streak of 5 ending yesterday, with a gap before it.
  const pattern: [number, boolean, boolean][] = [
    [-9, true, true], [-8, true, true], [-7, true, false], [-6, false, false],
    [-5, true, true], [-4, true, true], [-3, true, true], [-2, true, true], [-1, true, true],
  ];
  pattern.forEach(([offset, mine, theirs], i) => {
    const day = addDays(today, offset);
    const push = (author: Profile, seed: number, caption: string) => {
      const media: MediaAsset = { id: uid('media'), kind: 'photo', uri: demoImage(seed), uploadState: 'uploaded', createdAt: `${day}T18:${String(10 + seed % 40).padStart(2, '0')}:00.000Z` };
      const moment: Moment = { id: uid('moment'), coupleId: couple.id, authorId: author.id, dayKey: day, media, caption, createdAt: media.createdAt, clientRequestId: uid('seed') };
      moments.push(moment);
      memories.push({ id: uid('mem'), coupleId: couple.id, ownerId: author.id, kind: 'moment', media, title: null, body: null, caption, takenOn: day, createdAt: media.createdAt, favoritedBy: i % 3 === 0 ? [me.id] : [], momentId: moment.id });
    };
    if (mine) push(me, i * 2 + 1, ['Morning coffee, finally sunny.', 'Walk by the river.', 'Desk chaos, send help.', 'Dinner experiment: success.', 'Rainy window.', 'New plant!', 'Train home.', 'Sunday pancakes.', 'Late study night.'][i]);
    if (theirs) push(partner, i * 2 + 2, ['Simulated: snow on the way to work.', 'Simulated: bagels.', 'Simulated: library view.', '', 'Simulated: skating rink.', 'Simulated: the cat again.', 'Simulated: sunset from the bus.', 'Simulated: soup night.', 'Simulated: first light.'][i]);
  });
  // A letter and a voice note.
  memories.push({ id: uid('mem'), coupleId: couple.id, ownerId: partner.id, kind: 'letter', media: null, title: 'Before you land', body: 'I keep thinking about the first hour at the airport. No plans, just coffee and the long way home. Travel safe. — (Simulated partner letter)', caption: null, takenOn: addDays(today, -20), createdAt: `${addDays(today, -20)}T09:00:00.000Z`, favoritedBy: [me.id] });
  // "On this day" last year.
  const [y, m, d] = today.split('-');
  const lastYear = `${Number(y) - 1}-${m}-${d}`;
  memories.push({ id: uid('mem'), coupleId: couple.id, ownerId: me.id, kind: 'photo', media: { id: uid('media'), kind: 'photo', uri: demoImage(77), uploadState: 'uploaded', createdAt: `${lastYear}T12:00:00.000Z` }, title: null, body: null, caption: 'One year ago: the picnic that got rained out.', takenOn: lastYear, createdAt: `${lastYear}T12:00:00.000Z`, favoritedBy: [] });

  const messages: Message[] = [
    { id: uid('msg'), coupleId: couple.id, senderId: partner.id, kind: 'text', text: 'Good morning from the cold side of the ocean ❄️ (simulated)', media: null, createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(), delivery: 'sent', readAt: new Date(Date.now() - 4 * 3600_000).toISOString(), reactions: { [me.id]: '🥰' }, clientRequestId: uid('seed') },
    { id: uid('msg'), coupleId: couple.id, senderId: me.id, kind: 'affection', affection: 'kiss', text: null, media: null, createdAt: new Date(Date.now() - 4 * 3600_000).toISOString(), delivery: 'sent', readAt: new Date(Date.now() - 3.5 * 3600_000).toISOString(), reactions: {}, clientRequestId: uid('seed') },
    { id: uid('msg'), coupleId: couple.id, senderId: partner.id, kind: 'text', text: 'Call tonight after your class? I have a story about the neighbor. (simulated)', media: null, createdAt: new Date(Date.now() - 40 * 60_000).toISOString(), delivery: 'sent', readAt: null, reactions: {}, clientRequestId: uid('seed') },
  ];

  const events: CalendarEvent[] = [
    { id: uid('evt'), coupleId: couple.id, kind: 'meeting', title: 'Next visit', date: addDays(today, 23), allDay: true, time: null, timezone: tz, destination: 'Montréal', notes: 'Arrive 14:10, terminal 2.', recurringAnnual: false, reminders: [7, 1, 0], cancelled: false, createdBy: me.id },
    { id: uid('evt'), coupleId: couple.id, kind: 'anniversary', title: 'Our anniversary', date: couple.relationshipStart ?? '2024-02-14', allDay: true, time: null, timezone: tz, destination: null, notes: null, recurringAnnual: true, reminders: [7, 1], cancelled: false, createdBy: me.id },
    { id: uid('evt'), coupleId: couple.id, kind: 'birthday', title: "Alex's birthday", date: `${y}-09-03`, allDay: true, time: null, timezone: tz, destination: null, notes: null, recurringAnnual: true, reminders: [7, 1], cancelled: false, createdBy: me.id },
    { id: uid('evt'), coupleId: couple.id, kind: 'visit', title: 'Spring trip', date: addDays(today, -60), allDay: true, time: null, timezone: tz, destination: 'Paris', notes: 'Five days, mostly walking.', recurringAnnual: false, reminders: [], cancelled: false, createdBy: partner.id },
  ];

  set((st) => ({
    moments: [...st.moments, ...moments],
    memories: [...memories, ...st.memories],
    messages: [...st.messages, ...messages],
    events: [...st.events, ...events],
    widgetMessage: { ...st.widgetMessage, [couple.id]: { text: 'Counting the days. (simulated)', authorId: partner.id, updatedAt: now() } },
  }));
}
