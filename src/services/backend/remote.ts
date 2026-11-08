import type { ConnectionPreferences } from '@/lib/connectionPreferences';
/**
 * RemoteBackend — InsForge (https://insforge.dev).
 *
 * Accounts, the `profiles` table and profile photos (the public `avatars`
 * bucket, one folder per user, owner-only writes) live on InsForge. The rest
 * of the contract still runs on-device in ./local.ts (see docs/BACKEND.md).
 *
 * Configure with EXPO_PUBLIC_INSFORGE_URL and EXPO_PUBLIC_INSFORGE_ANON_KEY.
 */
import { createClient } from '@insforge/sdk';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { BackendError } from './types';

const url = process.env.EXPO_PUBLIC_INSFORGE_URL ?? null;
const anonKey = process.env.EXPO_PUBLIC_INSFORGE_ANON_KEY ?? null;

export const remoteConfig = {
  apiUrl: url,
  configured: Boolean(url && anonKey),
};

// Mobile mode: tokens come back in the response body instead of browser cookies.
export const insforge = remoteConfig.configured
  ? createClient({ baseUrl: url!, anonKey: anonKey!, isServerMode: true })
  : null;

const REFRESH_KEY = 'insforge_refresh_token';

async function storeRefreshToken(token: string | null | undefined) {
  if (Platform.OS === 'web') return;
  try {
    if (token) await SecureStore.setItemAsync(REFRESH_KEY, token);
    else await SecureStore.deleteItemAsync(REFRESH_KEY);
  } catch {
    // Keychain unavailable: the session just won't survive an app restart.
  }
}

function client() {
  if (!insforge) throw new BackendError('not_configured', 'The server is not configured.');
  return insforge;
}

function fail(error: { message?: string; statusCode?: number } | null, fallback: string): never {
  throw new BackendError('remote', error?.message || fallback);
}

export type RemoteCouple = { couple_id: string; timezone: string; created_at: string; partner: { id: string; first_name: string; timezone: string; avatar_url: string | null } };

export type RemoteLive = { user_id: string; share_location: boolean; share_battery: boolean; lat: number | null; lon: number | null; country: string | null; country_code: string | null; location_at: string | null; battery: number | null; battery_at: string | null };

export type RemoteUser = { id: string; email: string; emailVerified: boolean };

function toUser(u: { id: string; email: string; emailVerified?: boolean }): RemoteUser {
  return { id: u.id, email: u.email, emailVerified: u.emailVerified ?? true };
}

/** Restores the access token from the stored refresh token after an app restart. */
async function ensureSession(): Promise<void> {
  const http = (client() as unknown as { http?: { getHeaders(): Record<string, string>; setRefreshToken(t: string | null): void; refreshAccessToken(): Promise<{ accessToken?: string; refreshToken?: string }>; setAuthToken(t: string | null): void } }).http;
  if (!http || http.getHeaders().Authorization?.includes('.')) return;
  if (Platform.OS === 'web') return;
  const saved = await SecureStore.getItemAsync(REFRESH_KEY).catch(() => null);
  if (!saved) throw new BackendError('signed_out', 'Your session expired. Sign in again to sync your profile.');
  http.setRefreshToken(saved);
  const res = await http.refreshAccessToken();
  if (!res?.accessToken) throw new BackendError('signed_out', 'Your session expired. Sign in again to sync your profile.');
  http.setAuthToken(res.accessToken);
  await storeRefreshToken(res.refreshToken ?? saved);
}

export const remote = {
  async saveConnectionPreferences(userId: string, value: ConnectionPreferences): Promise<void> {
    await ensureSession();
    const row = { user_id: userId, schema_version: value.version, answers: value.answers, completed: value.completed };
    const { data: existing, error: readError } = await client().database.from('connection_preferences').select('user_id').eq('user_id', userId).maybeSingle();
    if (readError) fail(readError, 'Could not load your connection preferences.');
    const { error } = existing
      ? await client().database.from('connection_preferences').update(row).eq('user_id', userId)
      : await client().database.from('connection_preferences').insert([row]);
    if (error) fail(error, 'Could not save your connection preferences.');
  },
  async fetchConnectionPreferences(userId: string): Promise<ConnectionPreferences | null> {
    await ensureSession();
    const { data, error } = await client().database.from('connection_preferences').select('schema_version,answers,completed,updated_at').eq('user_id', userId).maybeSingle();
    if (error) fail(error, 'Could not load your connection preferences.');
    if (!data) return null;
    const row = data as { schema_version: number; answers: Record<string,string>; completed: boolean; updated_at: string };
    return { version: row.schema_version, answers: row.answers, completed: row.completed, updatedAt: row.updated_at };
  },
  async signUp(email: string, password: string, name: string): Promise<{ user: RemoteUser | null; needsVerification: boolean }> {
    const { data, error } = await client().auth.signUp({ email, password, name });
    if (error || !data) fail(error, 'Could not create the account.');
    const d = data as { user?: RemoteUser; accessToken?: string | null; refreshToken?: string; requireEmailVerification?: boolean };
    await storeRefreshToken(d.refreshToken);
    return { user: d.user ? toUser(d.user) : null, needsVerification: Boolean(d.requireEmailVerification && !d.accessToken) };
  },

  async verifyEmail(email: string, otp: string): Promise<RemoteUser> {
    const { data, error } = await client().auth.verifyEmail({ email, otp });
    if (error || !data) fail(error, 'That code does not match.');
    await storeRefreshToken((data as { refreshToken?: string }).refreshToken);
    return toUser((data as { user: RemoteUser }).user);
  },

  async resendVerification(email: string): Promise<void> {
    const { error } = await client().auth.resendVerificationEmail({ email });
    if (error) fail(error, 'Could not resend the code.');
  },

  async signIn(email: string, password: string): Promise<RemoteUser> {
    const { data, error } = await client().auth.signInWithPassword({ email, password });
    if (error || !data) fail(error, 'Email or password is incorrect.');
    await storeRefreshToken((data as { refreshToken?: string }).refreshToken);
    return toUser((data as { user: RemoteUser }).user);
  },

  /** Emails a 6-digit sign-in code. Works for new and existing emails. */
  async sendCode(email: string): Promise<void> {
    const { error } = await client().auth.signInWithOtp({ email });
    if (error) fail(error, 'Could not send the code.');
  },

  /** Checks the code; a new email becomes a verified account and is signed in. */
  async verifyCode(email: string, otp: string, name?: string): Promise<RemoteUser> {
    const { data, error } = await client().auth.verifyOtp({ email, otp, ...(name ? { name } : {}) });
    if (error || !data) fail(error, 'That code does not match.');
    await storeRefreshToken((data as { refreshToken?: string }).refreshToken);
    return toUser((data as { user: RemoteUser }).user);
  },

  // ---------- live status (migrations/*live-status.sql) ----------
  async updateLive(v: { shareLocation: boolean; shareBattery: boolean; lat?: number | null; lon?: number | null; country?: string | null; countryCode?: string | null; battery?: number | null }): Promise<void> {
    await ensureSession();
    const { error } = await client().database.rpc('update_live_status', {
      p_share_location: v.shareLocation, p_share_battery: v.shareBattery,
      p_lat: v.lat ?? null, p_lon: v.lon ?? null, p_country: v.country ?? null, p_country_code: v.countryCode ?? null, p_battery: v.battery ?? null,
    });
    if (error) fail(error, 'Could not share your status.');
  },
  async partnerLive(): Promise<RemoteLive | null> {
    await ensureSession();
    const { data, error } = await client().database.rpc('partner_live_status');
    if (error) fail(error, "Could not load your partner's status.");
    return (data as RemoteLive | null) ?? null;
  },

  // ---------- affection (migrations/*affection.sql + functions/affection-push.ts) ----------
  async sendAffection(emoji: string): Promise<string> {
    await ensureSession();
    const { data, error } = await client().database.rpc('send_affection', { p_emoji: emoji });
    if (error || !data) fail(error, 'Could not send.');
    return (data as { id: string }).id;
  },
  async receivedAffections(since: string): Promise<{ id: string; emoji: string; created_at: string }[]> {
    await ensureSession();
    const { data, error } = await client().database.rpc('received_affections', { p_since: since });
    if (error) fail(error, 'Could not check for affection.');
    return (data as { id: string; emoji: string; created_at: string }[]) ?? [];
  },
  /** Best effort: the partner's phones get a push even if Corasis is closed. */
  async pushAffection(id: string): Promise<void> {
    await client().functions.invoke('affection-push', { body: { affection_id: id } }).catch(() => undefined);
  },
  async savePushToken(token: string, environment: 'sandbox' | 'production'): Promise<void> {
    await ensureSession();
    await client().database.rpc('save_push_token', { p_token: token, p_platform: Platform.OS === 'android' ? 'android' : 'ios', p_environment: environment });
  },
  async removePushToken(token: string): Promise<void> {
    try { await client().database.rpc('remove_push_token', { p_token: token }); } catch { /* best effort */ }
  },

  // ---------- partner connection (server functions in migrations/*partner-invitations.sql) ----------
  async createInvitation(): Promise<{ code: string; expires_at: string }> {
    await ensureSession();
    const { data, error } = await client().database.rpc('create_invitation');
    if (error || !data) fail(error, 'Could not create an invitation.');
    return data as { code: string; expires_at: string };
  },
  async acceptInvitation(code: string): Promise<RemoteCouple> {
    await ensureSession();
    const { data, error } = await client().database.rpc('accept_invitation', { p_code: code });
    if (error || !data) fail(error, 'Could not connect with that code.');
    return data as RemoteCouple;
  },
  async myCouple(): Promise<RemoteCouple | null> {
    await ensureSession();
    const { data, error } = await client().database.rpc('my_couple');
    if (error) fail(error, 'Could not check your partner connection.');
    return (data as RemoteCouple | null) ?? null;
  },
  async unlinkCouple(): Promise<void> {
    await ensureSession();
    const { error } = await client().database.rpc('unlink_couple');
    if (error) fail(error, 'Could not unlink.');
  },

  /** Providers switched on in the InsForge dashboard (e.g. ['google']). */
  async oauthProviders(): Promise<string[]> {
    const res = await fetch(`${url}/api/auth/public-config`).catch(() => null);
    const cfg = (await res?.json().catch(() => null)) as { oAuthProviders?: string[] } | null;
    return cfg?.oAuthProviders ?? [];
  },

  /** Google / Apple sign-in: secure browser sheet → app link back → PKCE code exchange. */
  async signInWithOAuth(provider: 'google' | 'apple', returnUrl: string): Promise<RemoteUser | null> {
    const { data, error } = await client().auth.signInWithOAuth(provider, { redirectTo: returnUrl, skipBrowserRedirect: true });
    const start = data as { url?: string; codeVerifier?: string };
    if (error || !start?.url || !start.codeVerifier) fail(error, 'Could not start sign-in.');
    const result = await WebBrowser.openAuthSessionAsync(start.url, returnUrl);
    if (result.type !== 'success') return null; // cancelled
    const code = new URL(result.url).searchParams.get('insforge_code');
    if (!code) throw new BackendError('remote', new URL(result.url).searchParams.get('error_description') || 'Sign-in was not completed.');
    const ex = await client().auth.exchangeOAuthCode(code, start.codeVerifier);
    if (ex.error || !ex.data) fail(ex.error, 'Could not finish sign-in.');
    await storeRefreshToken((ex.data as { refreshToken?: string }).refreshToken);
    return toUser((ex.data as { user: RemoteUser }).user);
  },

  async signOut(): Promise<void> {
    await storeRefreshToken(null);
    await client().auth.signOut().catch(() => undefined);
  },

  /** Uploads a local image (file:// or blob: URI) to avatars/<userId>/ and returns its public URL. */
  async uploadAvatar(userId: string, localUri: string): Promise<{ url: string; key: string }> {
    await ensureSession();
    const blob = await (await fetch(localUri)).blob();
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { data, error } = await client().storage.from('avatars').upload(path, blob);
    if (error || !data) fail(error, 'Could not upload your photo.');
    return { url: data.url, key: data.key };
  },

  async upsertProfile(row: { id: string; first_name: string; pronouns: string | null; timezone: string; avatar_url?: string | null; avatar_key?: string | null }): Promise<void> {
    await ensureSession();
    const db = client().database.from('profiles');
    const { data: existing, error: readErr } = await db.select('id, avatar_key').eq('id', row.id).maybeSingle();
    if (readErr) fail(readErr, 'Could not load your profile.');
    const patch = { ...row, updated_at: new Date().toISOString() };
    const { error } = existing
      ? await client().database.from('profiles').update(patch).eq('id', row.id)
      : await client().database.from('profiles').insert([patch]);
    if (error) fail(error, 'Could not save your profile.');
    const oldKey = (existing as { avatar_key?: string | null } | null)?.avatar_key;
    if (oldKey && oldKey !== row.avatar_key && row.avatar_key !== undefined) {
      await client().storage.from('avatars').remove(oldKey).catch(() => undefined);
    }
  },

  async fetchProfile(id: string): Promise<{ first_name: string; pronouns: string | null; timezone: string; avatar_url: string | null } | null> {
    await ensureSession();
    const { data, error } = await client().database.from('profiles').select('first_name, pronouns, timezone, avatar_url').eq('id', id).maybeSingle();
    if (error) return null;
    return data as never;
  },
};

export function assertRemoteConfigured(): never {
  throw new Error('Remote backend is not configured. Set EXPO_PUBLIC_INSFORGE_URL and EXPO_PUBLIC_INSFORGE_ANON_KEY.');
}
