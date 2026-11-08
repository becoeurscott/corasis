/**
 * affection-push — sends an Apple push to the partner's phones after an
 * emoji is sent (so it arrives even when Corasis is closed).
 *
 * Called by the sender's app with { affection_id }. It uses the caller's own
 * token, so the database function only answers for affections they sent.
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

  const { affection_id } = (await req.json().catch(() => ({}))) as { affection_id?: string };
  if (!affection_id) return json({ error: 'affection_id is required' }, 400);

  const client = createClient({ baseUrl: Deno.env.get('INSFORGE_BASE_URL')!, accessToken: auth } as never);
  const { data, error } = await client.database.rpc('affection_push_targets', { p_affection: affection_id });
  if (error) return json({ error: error.message }, 400);
  const target = data as { emoji: string; sender_name: string; tokens: { token: string; platform: string; environment: string }[] } | null;
  if (!target) return json({ sent: 0, reason: 'not found' });

  const p8 = Deno.env.get('APNS_KEY_P8');
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const topic = Deno.env.get('APNS_TOPIC');
  if (!p8 || !keyId || !teamId || !topic) return json({ sent: 0, reason: 'push not configured' });

  const jwt = await apnsJwt(p8, keyId, teamId);
  const payload = {
    aps: { alert: { title: `${target.sender_name} ${target.emoji}`, body: `${target.sender_name} sent you ${target.emoji}` }, sound: 'default', 'thread-id': 'affection' },
    affection: { id: affection_id, emoji: target.emoji },
  };
  let sent = 0;
  const failures: string[] = [];
  for (const t of target.tokens.filter((x) => x.platform === 'ios')) {
    const host = t.environment === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
    const res = await fetch(`https://${host}/3/device/${t.token}`, {
      method: 'POST',
      headers: { authorization: `bearer ${jwt}`, 'apns-topic': topic, 'apns-push-type': 'alert', 'apns-priority': '10', 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }) as Response);
    if (res.ok) sent++;
    else failures.push(`${res.status} ${await res.text()}`);
  }
  return json({ sent, failures });
}
