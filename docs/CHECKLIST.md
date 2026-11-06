# Feature checklist

Status: ✅ implemented and exercised · 🟡 implemented, needs native build or backend to be real · ⬜ not built

| # | Requirement | Screen / module | Status |
|---|---|---|---|
| 1 | Provisional name "Together", easy to rebrand | `app.json`, `AppMark.tsx` | ✅ |
| 2 | Expo + TypeScript, clear navigation, reusable components | `src/app`, `src/components/ui` | ✅ |
| 2 | Persistent local demo mode with clearly simulated partner | `backend.startDemo`, banners | ✅ |
| 2 | Integration boundary for native/credentials | `docs/NATIVE.md`, `remote.ts` | 🟡 |
| 3 | 4 themes, semantic tokens, light/dark, status colors not color-only | `theme/tokens.ts`, `Banner` | ✅ |
| 3 | Theme per user, persisted, changeable in Settings | `store/prefs`, `settings/theme` | ✅ |
| 3 | Text scaling, reduced motion, safe areas, keyboard avoidance, 44pt targets | `Txt`, `Screen`, prefs.reduceMotion | ✅ |
| 4.1 | Splash with animation and state-based routing | `app/index.tsx`, `lib/routing.ts` | ✅ |
| 4.2 | Theme selection as first question, 4 swatches, live preview, Continue gated | `onboarding/theme.tsx`, `ThemePicker` | ✅ |
| 4.3 | Skippable intro | `onboarding/intro.tsx` | ✅ |
| 4.4 | Profile: name, photo, pronouns, timezone | `onboarding/profile.tsx` | ✅ |
| 4.5 | Relationship setup, all optional | `onboarding/relationship.tsx` | ✅ |
| 4.6 | Email sign-up, verification, sign-in, reset, session recovery, demo option | `auth/*`, `onboarding/auth.tsx` | ✅ (local) |
| 4.7 | Invitation link + code, share sheet, all states, inviter confirmation, pending invite context | `InvitePanel`, `invite/[code]`, `DeepLinkHandler` | ✅ |
| 4.8 | Couple details, relationship date, next meeting | `onboarding/couple.tsx` | ✅ |
| 4.9 | Privacy explanation, reminder time, quiet hours, deferred permissions | `onboarding/privacy.tsx` | ✅ |
| 4.10 | Personalized welcome | `onboarding/welcome.tsx` | ✅ |
| 4 | Progress, back, resume interrupted onboarding | `OnboardingFrame`, `onboarding.step` | ✅ |
| 5 | Five tabs, nested routes, modals, deep links | `(tabs)/_layout`, stacks, `DeepLinkHandler` | ✅ |
| 6 | Home: names/avatars, local times, distance, battery, flame, send moment, countdown, question, affection, partner message, suggestions, unpaired/offline states | `(tabs)/index.tsx`, `components/home/*` | ✅ |
| 7 | Flame overview, capture, picker, preview/caption, upload progress/retry, today's detail, history calendar, fullscreen viewer | `flame/*`, `viewer.tsx` | ✅ |
| 7 | Streak rules: both contribute, once per day, idempotent, couple timezone, supportive copy | `lib/streak.ts`, `backend.addMoment`, tests | ✅ |
| 7 | Video trim | native editor only | 🟡 |
| 8 | Map with markers, line, cities, distance km/mi, times, accuracy/freshness, battery, per-person controls, permission education, stale/paused/denied states | `(tabs)/map.tsx`, `MapCanvas`, `lib/live.ts` | ✅ (schematic map; tiles 🟡) |
| 9 | Activity hub, 6 activity types, 8 deck categories, 60+ original questions | `(tabs)/together.tsx`, `data/questions.ts` | ✅ (92 prompts) |
| 9 | Library/search/filters, deck detail, session answer/draft/waiting/reveal/comparison/reactions, history, favorites | `activity/*` | ✅ |
| 9 | Answers hidden until both submit, enforced in backend layer, locked after reveal, skips, resume, abandon | `backend.submit/redact`, tests | ✅ (server mirror in docs) |
| 10 | Kiss/Hug/Thinking/I need you (with optional context), text, voice notes, photo attachment, reactions, quick replies, unread, delivery states | `messages/*`, `AffectionRow`, `VoiceRecorder` | ✅ |
| 11 | Timeline/grid, filters, uploads, letters, detail, viewer, voice playback, favorites, search, date filter, calendar, On this day, reshare, export, delete with ownership | `(tabs)/memories.tsx`, `memories/*` | ✅ |
| 12 | Countdown, meetings CRUD, shared calendar, event detail, reminders, past visits, recurring, no negative countdown, day-of and post-meeting prompts | `meetings/*`, `lib/events.ts` | ✅ |
| 13 | Wallpaper editor with previews and export; widget previews; partner-message composer | `widgets/*` | ✅ (native widgets 🟡) |
| 14 | Profile & all settings incl. app lock, data export, delete, unlink, sign out | `(tabs)/profile.tsx`, `settings/*` | ✅ |
| 15 | Optional premium behind flag, labeled demo, no fabricated prices | `settings/premium.tsx` | ✅ |
| 16 | Data model, 2-member limit, expiring tokens, authorization, revocation, idempotency | `backend/types.ts`, `local.ts`, `docs/BACKEND.md` | ✅ local / 🟡 server |
| 17 | Loading/empty/error/offline/permission/waiting/stale/retry/confirm states | across screens (`Banner`, `EmptyState`, `Confirm`) | ✅ |
| 18 | Automated tests for rules and authorization | `src/__tests__` | ✅ |

## Verification log

| Check | Result |
|---|---|
| 1 Fresh install → splash → theme first | ✅ browser |
| 2 Four themes apply immediately and persist | ✅ browser (reload) |
| 3 Onboarding resumes after interruption | ✅ unit (`resolveStartRoute`); browser reload after onboarding kept session |
| 4 Registration, sign-in, reset, sign-out | ✅ unit + browser |
| 5 Two accounts pair | ✅ unit |
| 6 Invalid/expired/reused/revoked invitations | ✅ unit |
| 7 Unpaired user explores features | ✅ unit (routing) · screens show unpaired states; not walked in browser |
| 8 Both contributions validate streak once | ✅ unit |
| 9 Partner cannot read unrevealed answers | ✅ unit (redaction + cross-couple forbidden) |
| 10 Sessions resume and reveal | ✅ unit + browser (demo partner) |
| 11 Messages, reactions, media persist | ✅ browser reload |
| 12 Countdown dates & timezones | ✅ unit |
| 13 Turning off sharing revokes live info | ✅ unit |
| 14 Unlinking revokes couple resources | ✅ unit |
| 15 Permission denial / offline recovery | 🟡 states implemented; native prompts need device |
| 16 Navigation, keyboard, large text, all themes | ✅ browser; device pass recommended |
