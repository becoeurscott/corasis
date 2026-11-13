/**
 * partner-alert-push — pushes a place alert (arrived / left a saved place), a
 * proximity alert ("you're close") or a Mend the Heart invitation after send_partner_alert.
 *
 * Called by the detecting phone with { alert_id }. Uses the caller's own token,
 * so the database function only answers for alerts they sent.
 *
 * Secrets (npx @insforge/cli secrets add …):
 *   APNS_KEY_P8   contents of the AuthKey_XXXX.p8 file
 *   APNS_KEY_ID   the 10-character Key ID
 *   APNS_TEAM_ID  LGHS3SPMJ7
 *   APNS_TOPIC    com.ebenezer.corasis
 */
import { createClient } from 'npm:@insforge/sdk';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes as ArrayBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let cachedJwt: { token: string; at: number } | null = null;
/** APNs provider token (ES256), reused for 50 minutes as Apple recommends. */
async function apnsJwt(p8: string, keyId: string, teamId: string): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedJwt && nowSec - cachedJwt.at < 3000) return cachedJwt.token;
  const pem = p8.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ alg: 'ES256', kid: keyId })));
  const body = b64url(enc.encode(JSON.stringify({ iss: teamId, iat: nowSec })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`));
  cachedJwt = { token: `${head}.${body}.${b64url(sig)}`, at: nowSec };
  return cachedJwt.token;
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const auth = req.headers.get('Authorization')?.replace('Bearer ', '') ?? null;
  if (!auth) return json({ error: 'Unauthorized' }, 401);
  const { alert_id } = (await req.json().catch(() => ({}))) as { alert_id?: string };
  if (!alert_id) return json({ error: 'alert_id is required' }, 400);

  const client = createClient({ baseUrl: Deno.env.get('INSFORGE_BASE_URL')!, accessToken: auth } as never);
  const { data, error } = await client.database.rpc('partner_alert_push_targets', { p_alert: alert_id });
  if (error) return json({ error: error.message }, 400);
  const t = data as { kind: string; place: string | null; sender_name: string; partner_name: string; tokens: { token: string; platform: string; environment: string; self: boolean }[] } | null;
  if (!t) return json({ sent: 0, reason: 'not found' });

  const p8 = Deno.env.get('APNS_KEY_P8'); const keyId = Deno.env.get('APNS_KEY_ID'); const teamId = Deno.env.get('APNS_TEAM_ID'); const topic = Deno.env.get('APNS_TOPIC');
  if (!p8 || !keyId || !teamId || !topic) return json({ sent: 0, reason: 'push not configured' });
  const jwt = await apnsJwt(p8, keyId, teamId);

  const place = t.place ?? 'a saved place';
  const message = (self: boolean) =>
    t.kind === 'near'
      ? { title: '💞 You\'re close!', body: `You and ${self ? t.partner_name : t.sender_name} are near each other right now.` }
      : t.kind === 'arrive'
        ? { title: `📍 ${t.sender_name} arrived`, body: `${t.sender_name} just arrived at ${place}.` }
        : { title: `👋 ${t.sender_name} left`, body: `${t.sender_name} just left ${place}.` };

  // Repair invitations are localized on the phone (Localizable.xcstrings keys), English as fallback.
  const alertFor = (self: boolean) =>
    t.kind === 'repair'
      ? {
          title: `❤️ ${t.sender_name} would like to mend something with you`,
          body: 'Not looking for a fight, just to understand each other. Open Mend the Heart to answer.',
          'title-loc-key': 'PUSH_REPAIR_TITLE', 'title-loc-args': [t.sender_name],
          'loc-key': 'PUSH_REPAIR_BODY',
        }
      : t.kind === 'turn'
        ? {
            title: `🎲 Your move in ${t.place ?? 'your game'}`,
            body: `${t.sender_name} just played. It's your turn!`,
            'title-loc-key': 'PUSH_TURN_TITLE', 'title-loc-args': [t.place ?? ''],
            'loc-key': 'PUSH_TURN_BODY', 'loc-args': [t.sender_name],
          }
        : message(self);

  let sent = 0;
  const failures: string[] = [];
  for (const d of t.tokens.filter((x) => x.platform === 'ios')) {
    const host = d.environment === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
    const res = await fetch(`https://${host}/3/device/${d.token}`, {
      method: 'POST',
      headers: { authorization: `bearer ${jwt}`, 'apns-topic': topic, 'apns-push-type': 'alert', 'apns-priority': '10', 'content-type': 'application/json' },
      body: JSON.stringify({ aps: { alert: alertFor(d.self), sound: 'default', 'thread-id': 'partner-alert' }, partnerAlert: { id: alert_id, kind: t.kind } }),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }) as Response);
    if (res.ok) sent++;
    else failures.push(`${res.status} ${await res.text()}`);
  }
  return json({ sent, failures });
}
