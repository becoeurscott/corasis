# Backend contract

This build runs entirely on-device (`src/services/backend/local.ts`). To sync two real devices, implement the same contract server-side and wire `src/services/backend/remote.ts`.

## Tables

| Table | Key fields | Notes |
|---|---|---|
| `profiles` | id, first_name, avatar_path, pronouns, timezone, theme (per user) | Theme never shared with partner |
| `couples` | id, relationship_stage, relationship_start, distance_mode, goals[], couple_timezone | `couple_timezone` is the single day boundary |
| `couple_members` | couple_id, user_id | **Unique (user_id)** + check `count(*) per couple <= 2` (trigger) |
| `invitations` | id, code (6 chars), token (random 32), inviter_id, status, expires_at (24 h), accepted_by | Single use; sweep expired on read |
| `sharing_permissions` | user_id, location bool, battery bool, updated_at | Off by default |
| `live_info` | user_id, lat, lon, city, country, accuracy_m, location_updated_at, battery_pct, battery_updated_at | RLS: readable by partner **only when the matching permission is on**; writes ignored when off; no history table |
| `moments` | id, couple_id, author_id, day_key, media_id, caption, client_request_id | **Unique (author_id, client_request_id)** → idempotent |
| `media_assets` | id, owner_id, couple_id, kind, storage_path, duration_ms, size_bytes | Private bucket; validate type/size (≤ 60 MB, video ≤ 30 s); serve via signed URLs (≤ 1 h) |
| `activity_sessions` | id, couple_id, deck_id, question_id, status, revealed_at | |
| `submissions` | session_id, user_id, answer, comment, skipped, submitted_at | **RLS: a row is readable by the other member only when the session is `revealed`.** Writes go through the RPC below, never direct inserts |
| `session_reactions` | session_id, user_id, emoji | |
| `favorites` | user_id, question_id | |
| `messages` | id, couple_id, sender_id, kind, affection, text, media_id, context, client_request_id, read_at | Unique (sender_id, client_request_id) |
| `message_reactions` | message_id, user_id, emoji | |
| `memories` | id, couple_id, owner_id, kind, media_id, title, body, caption, taken_on, moment_id | Delete allowed for owner only; cascade removes moment |
| `memory_favorites` | memory_id, user_id | |
| `calendar_events` | id, couple_id, kind, title, date, all_day, time, timezone, destination, notes, recurring_annual, reminders[], cancelled, created_by | |
| `notification_prefs` / `device_tokens` | user_id, …, quiet_start, quiet_end | Server respects quiet hours in the **recipient's** local time |
| `widget_messages` | couple_id, text (≤ 80), author_id, updated_at | |
| `entitlements` | user_id, premium, source | From the billing provider's webhook only |

Row-level security: every couple-scoped table is readable/writable only by the two `couple_members` of that `couple_id`. All timestamps are set by the server (`now()`), not the client.

## Protected endpoints (RPC / edge functions)

- `submit_answer(session_id, answer, comment, skipped)` — verifies membership, rejects if already submitted or session revealed, inserts the submission, and sets `status = revealed` when both members have rows. Because `submissions` RLS hides unrevealed partner rows, a direct `select` cannot leak the answer.
- `accept_invitation(code_or_token)` — single transaction: validate pending + not expired + inviter unpaired + acceptor unpaired, create couple + 2 memberships, mark invitation accepted.
- `unlink_couple()` — removes both memberships immediately (revoking RLS access), schedules deletion of shared media/rows after a 30-day export window.
- `add_moment(media_id, caption, client_request_id)` — computes `day_key` from `couple_timezone` server-side; upsert on the idempotency key. Streaks are derived, never stored by the client.
- `delete_account()` — deletes only the caller's data; triggers `unlink_couple` if paired. A member can never delete the partner's account.

## Realtime

Subscribe to `moments`, `activity_sessions`, `messages`, `live_info`, `widget_messages`, `calendar_events` filtered by `couple_id`. On reconnect, refetch everything newer than the last seen `updated_at`.

## Media

Uploads go directly to a private bucket with a signed upload URL; the server records the asset after validating MIME type and size. Deleting a memory deletes its asset unless another row references it.

## Notifications

Push via FCM/APNs. Server-side rules: quiet hours per recipient, one notification per "I need you" (no repeats), daily reminder at the recipient's chosen local time, meeting reminders per event `reminders[]`.

## Environment variables (client)

- `EXPO_PUBLIC_API_URL` — base URL of the backend. Unset → demo/local mode.
- `EXPO_PUBLIC_API_ANON_KEY` — public anon key (never a service key).
- `EXPO_PUBLIC_MAPS_KEY` — optional, for native map tiles.
- `EXPO_PUBLIC_BILLING_KEY` — optional, RevenueCat public key.
