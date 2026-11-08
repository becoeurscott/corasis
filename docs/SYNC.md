# Couple sync

Everything a couple shares is stored on InsForge in `public.couple_items`
(migration `20261108070000_couple-sync.sql`) so both phones see the same data,
whichever app they run (SwiftUI on iOS, React Native on Android/iOS).

## How a sync works

Each app calls `sync_couple_items(p_items, p_since)` every ~10 seconds while
it is open (and once after sign-in):

1. **Push**: the app turns every shared local record into the shared JSON
   below, compares it with what it last sent (a hash per `kind:id`), and
   sends only the ones that changed. A record that was sent before and no
   longer exists locally is sent with `deleted: true`.
2. **Pull**: the server returns everything changed since `p_since` by the
   partner (or everything, when `p_since` is null on a new phone). The app
   merges each item into local storage and remembers its hash so it isn't
   sent back.
3. `p_since` = newest `updated_at` received minus 5 seconds (merges are
   idempotent, so re-reading a few items is harmless).

Media (photos, videos, voice notes) is uploaded once to the private
`couple-media` bucket at `<couple_id>/<uuid>.<ext>` and referenced by
`media.key`. The receiving phone downloads it into its own media folder.

## Merge rules

- `session`: submissions are merged per `userId` (newest `submittedAt` wins),
  reactions merged per user. Everything else: last write wins.
- `message`: reactions merged per user.
- All other kinds: last write wins.

## Shared formats (`data`)

Dates are ISO 8601 strings, days are `YYYY-MM-DD`, user ids are the InsForge
user ids. `media` is `{ "key": string, "kind": "photo" | "video" | "voice" }` or null.

| kind | id | data |
|------|----|------|
| `moment` | moment id | `authorId, day, caption, createdAt, media` |
| `message` | message id | `senderId, kind ('text'\|'voice'\|'affection'), text, affection, media, createdAt, reactions {userId: emoji}` |
| `session` | session id | `deckId, questionId, day, createdAt, abandoned, submissions [{userId, answer, comment, skipped, submittedAt}], reactions {userId: emoji}` (drafts stay on the phone) |
| `memory` | memory id | `ownerId, kind ('moment'\|'photo'\|'video'\|'voice'\|'letter'), title, body, caption, day, createdAt, media, favoritedBy [userId], momentId` |
| `event` | event id | `kind, title, date, allDay, time, timezone, destination, notes, annual, reminders [days], cancelled, createdBy` |
| `life` | game id | `status, proposedBy, acceptedBy, name, bornAt, stage, stageStartedAt, needs, needsAt, care, skills, decisions, votes [{id, choice, options, round, picks, previousPicks, decided, result, coin, openedAt}], log [{id, userId, actionId, at}], milestones [{id, kind, text, at}], endedAt, ending, clockOffsetMs, keepsakeSaved` |
| `couple` | `settings` | `start (YYYY-MM-DD\|null), stage, distance, goals [string], timezone` |
| `widget` | `note` | `text, by, at` |

The flame streak is not stored: each phone works it out from the synced moments.
