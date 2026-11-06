/**
 * RemoteBackend — integration boundary for a real server.
 *
 * This build ships no configured backend. When `EXPO_PUBLIC_API_URL` (and the
 * matching provider keys) are set, this module is where the HTTP/Realtime
 * client goes. The contract to implement is the `backend` object in
 * ./local.ts; docs/BACKEND.md lists the tables, RLS rules and the protected
 * submission endpoint required so the partner's answer cannot be read before
 * reveal.
 */
export const remoteConfig = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? null,
  configured: Boolean(process.env.EXPO_PUBLIC_API_URL),
};

export function assertRemoteConfigured(): never {
  throw new Error(
    'Remote backend is not configured. Set EXPO_PUBLIC_API_URL and implement src/services/backend/remote.ts (see docs/BACKEND.md). Use "Explore a demo" meanwhile.',
  );
}
