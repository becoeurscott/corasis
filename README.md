# Together — an app for long-distance couples

Expo (SDK 58) · React Native · TypeScript · Expo Router · Zustand

Daily photo/video moments that build a shared "flame", private questions and games revealed only when both have answered, quick affection and voice notes, a private album, a countdown to the next visit, optional location/battery sharing, widgets and a wallpaper editor. Four themes (Pink, Purple, Red, Blue), light and dark.

> The project lives in `~/Projects/together`; `Desktop/corassis/together` is a symlink. It was moved out of the iCloud-synced Desktop because iCloud evicted `node_modules` files and stalled every build.

## Run it

```bash
cd ~/Projects/together
npm install
npx expo start --web      # browser preview at http://localhost:8081
npx expo start            # scan with Expo Go (camera, mic, location, battery, biometrics work)
npx expo run:ios          # development build: adds video playback, widgets scaffold, push
```

Checks:

```bash
npx tsc --noEmit
npx jest
npx eslint src
```

## Demo access

Fresh install → splash → **Choose your theme** → intro → profile → relationship → five optional questions → **Explore a demo**. The demo creates a local account paired with **Alex, a simulated partner**. Simulated replies, moments and answers are generated on this device after a short delay and are labeled "simulated" everywhere. Nothing you send reaches a real person.

To exercise real pairing on one device: create account A (the verification code is shown on-screen since no email service is configured), create an invitation, sign out, create account B, enter the code. Both accounts live in local storage. `Profile → Your data → Reset the demo` wipes the device.

## Environment variables (names only)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend base URL. Unset = local demo mode (this build). |
| `EXPO_PUBLIC_API_ANON_KEY` | Public key for the backend. |
| `EXPO_PUBLIC_MAPS_KEY` | Native map tiles (optional). |
| `EXPO_PUBLIC_BILLING_KEY` | RevenueCat public key (optional). |

No secrets are stored in the repo or the client bundle.

## Where things are

```
src/app/              routes (Expo Router)
  index.tsx           splash + start routing
  onboarding/         theme → intro → profile → relationship → connection → auth → partner → couple → privacy → welcome
  auth/               sign-up, sign-in, verify, reset
  (tabs)/             Home, Map, Together, Memories, Profile
  flame/              overview, capture, history, [day]
  activity/           deck detail, session (answer/waiting/reveal), history, favorites, daily
  messages/           conversation + composer, message detail
  memories/           detail, new, calendar
  meetings/           countdown + calendar, edit, event detail
  widgets/            widget previews, partner-message composer, wallpaper editor
  settings/           profile, couple, partner, theme, language, timezone, notifications, sharing, lock, help, privacy, data, premium
  invite/[code]       deep-link landing (together://invite/CODE)
  lock.tsx, viewer.tsx
src/services/backend/ domain types, LocalBackend (all business rules), remote boundary
src/lib/              time/couple-day, streak, events, geo, media, notifications, routing, i18n
src/store/            persisted preferences, hooks binding screens to the backend
src/theme/            tokens for 4 themes × light/dark, ThemeProvider
src/data/questions.ts 86 original prompts across 8 categories + decks
src/__tests__/        business-rule and authorization tests
docs/BACKEND.md       server contract (tables, RLS, protected endpoints)
docs/NATIVE.md        what works in browser / Expo Go / dev build; widget scaffold
docs/CHECKLIST.md     feature → screen → status map
```

## Honest limitations

- **Accounts, profiles and private onboarding preferences use InsForge.** Pairing, couple activities and demo content still run locally. `docs/BACKEND.md` specifies what the server must enforce; the client already calls one contract so the swap is contained in `src/services/backend/`.
- Push notifications, widgets, biometrics, camera and battery need the mobile app (see `docs/NATIVE.md`). The browser preview labels each of these.
- Video playback on native needs `expo-video` wired into `VideoPlayer.tsx` (web uses `<video>`).
- The map is a schematic projection, not tiles. `MapCanvas` is the swap point for `react-native-maps`.
- French localization is structured (`src/lib/i18n.ts`) but only navigation and key labels are translated.
- Apple/Google sign-in and billing are not configured; the Plus screen is a labeled demo flag.
- The app-lock PIN is kept in preferences in this preview; production should move it to `expo-secure-store`.

## Native SwiftUI iOS app

A standalone native version lives in [`native-ios/`](native-ios/README.md). Open `native-ios/TogetherNative.xcodeproj` in Xcode or run `npm run ios:swift` to build and launch it in the iPhone simulator. The existing React Native app is preserved.

Both apps now use `shared/product.json` for theme palettes and the complete question/deck library. Future interface and behavior changes must be implemented in both apps; `npm run check:changes` helps catch one-sided edits. See [`docs/CROSS_PLATFORM.md`](docs/CROSS_PLATFORM.md) for the shared-source workflow and data-sync limits.

Short, optional onboarding questions now personalize the starting suggestions in both apps. They use fixed, non-scrolling screens. Account answers are private in the database and can be edited or cleared in Profile. See [`docs/ONBOARDING.md`](docs/ONBOARDING.md).
