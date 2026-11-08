# Together for iOS — SwiftUI

Open `TogetherNative.xcodeproj` in Xcode, select **TogetherNative**, choose an iPhone simulator, and Run. This is a standalone SwiftUI application; it does not embed React Native or a website. Minimum iOS version: 17.

From the repository root:

```sh
npm run ios:swift
# Or pass another simulator UUID:
npm run ios:swift -- SIMULATOR_UUID
```

The checked-in Xcode project works without a project generator. If you change the source layout or target settings, regenerate it with `xcodegen generate --spec native-ios/project.yml`. `project.yml` is the source of the project settings. Simulator builds do not need signing. For a physical device, select your Apple development team in Xcode.

## Included flows

- Theme selection, intro, profile and relationship onboarding; account sign-up, verification and sign-in, plus local-preview password reset.
- Five native tabs: Home, Map, Together, Memories and Profile.
- Photo/video daily moments, couple-day streaks, history and moment details.
- All 86 original questions and 13 decks, daily rotation, multiple-choice and photo answers, drafts, skip, hidden-answer waiting/reveal, reactions, history and favorites.
- Messages, affection, microphone voice recording and native media playback.
- Photo/video/voice/letter memories, date filtering, search, favorites, editing, deletion and sharing.
- Event calendar, countdowns, visits/anniversaries/birthdays, editing, annual occurrences and local reminders.
- Profile/couple settings, invitation pairing between local accounts, unlinking, themes/dark mode, time zones, location and battery opt-in, notification preferences, Keychain PIN and biometric re-entry, demo Plus, help, privacy, scoped JSON export and account deletion/reset.
- In-app widget previews, widget-message editor and wallpaper rendering/export to Photos/share sheet.

## Deliberate limits inherited from the original preview

InsForge handles accounts, profile photos and private onboarding preferences. Partner delivery, push, StoreKit billing and an installed WidgetKit extension are not configured. The map uses Apple Maps; Alex's Montréal pin is explicitly simulated. Camera and battery need a physical device. French covers main navigation, not all copy. Widget previews do not install on the Home or Lock Screen. Simulated photo replies reuse the selected photo and are labeled simulated.

SwiftUI data is stored separately from Expo/React Native data; existing Expo demo data is not migrated. App data is saved atomically in Application Support with file protection. Imported media is stored in the app container; the PIN is kept in Keychain. Local demo passwords are salted hashes, not production authentication. JSON exports contain accessible text and media references, not a media archive. A shared backend is required for cross-phone or cross-app account synchronization.

## Validation

```sh
npm run check:parity
npm run check:react-native
xcodebuild -project native-ios/TogetherNative.xcodeproj \
  -scheme TogetherNative -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO test
```

Read `docs/CROSS_PLATFORM.md` before changing either app. Shared catalog changes reach both apps on rebuild. Arbitrary SwiftUI edits do not translate automatically into TypeScript.

Onboarding now includes five short optional questions on fixed, non-scrolling screens. Answers personalize a free starter suggestion and are editable in Profile. Verified account preferences are stored privately in InsForge; demo answers remain local. See `docs/ONBOARDING.md`.
