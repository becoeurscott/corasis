# Native capabilities and what each build can do

| Feature | Browser preview | Expo Go | Development build (`npx expo run:ios` / `eas build --profile development`) |
|---|---|---|---|
| Theme, onboarding, demo mode, activities, messages, memories, calendar | ✅ | ✅ | ✅ |
| Camera capture | ❌ (file picker only) | ✅ | ✅ |
| Photo/video library | ✅ (file picker) | ✅ | ✅ |
| Voice note recording/playback (expo-audio) | partial (browser dependent) | ✅ | ✅ |
| Video playback | ✅ (`<video>`) | needs `expo-video` (add to `VideoPlayer.tsx`) | ✅ |
| Location (foreground) | ✅ (browser geolocation, no city name) | ✅ | ✅ |
| Battery level | ❌ | ✅ | ✅ |
| Local notifications / daily reminder | ❌ | ✅ (limited) | ✅ |
| Remote push (partner moments, reveals) | ❌ | ❌ | ✅ with backend + FCM/APNs |
| Biometric app lock | ❌ (PIN works) | ✅ | ✅ |
| Wallpaper export to Photos | download PNG | ✅ | ✅ |
| Home/lock-screen widgets | preview only | ❌ | requires native extension (below) |
| Map tiles | schematic map | schematic map | `react-native-maps` behind `MapCanvas` props |
| Apple / Google sign-in | ❌ | ❌ | needs `expo-apple-authentication` / Google OAuth client IDs |
| Billing | demo flag | demo flag | RevenueCat / StoreKit / Play Billing |

## Widgets (scaffold)

`widgets/` is the integration boundary:

- iOS: a WidgetKit extension reading an App Group `UserDefaults` suite (`group.app.together`) with keys `partnerMessage`, `countdownDays`, `countdownLabel`, `flameCount`, `flameStatus`. The app writes these via a tiny Expo module (`expo-modules-core`) whenever the widget store changes.
- Android: a Glance `AppWidget` reading `SharedPreferences` with the same keys.
- Refresh: the OS schedules refreshes (iOS budget ≈ 40–70/day). On a push notification, call `WidgetCenter.shared.reloadAllTimelines()` / `updateAll()`. We never promise instant updates.

Config plugin: add `"plugins": [["./widgets/plugin", { "appGroup": "group.app.together" }]]` in `app.json` once the extension targets exist. Not included in Expo Go.

## Wallpaper

iOS cannot set the wallpaper programmatically; the app saves the PNG to Photos and guides the user. Android can set it through `WallpaperManager` in a native module (not included).
