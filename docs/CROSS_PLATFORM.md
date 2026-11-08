# Keeping SwiftUI and React Native aligned

Together has two independent interfaces in one repository:

| Area | React Native | SwiftUI |
| --- | --- | --- |
| Application | `src/app/` and `src/components/` | `native-ios/Together/` |
| Local state and business rules | `src/services/backend/local.ts` | `native-ios/Together/Store.swift` |
| Shared palette and activity content | `shared/product.json` | Same file, bundled directly into the Xcode app |
| Screen correspondence | `shared/screen-map.json` maps every Expo screen to its native view | Same mapping |
| Local persistence | Expo AsyncStorage | App container JSON and media; Keychain app PIN |

## What propagates automatically

Edit motion timing/press feedback, theme palette colors/taglines, category metadata, questions, choices, deck definitions or simulated answers in `shared/product.json`. Both apps consume that single file. Rebuild/reload both apps after changing it; an installed app does not download repository changes. Do not duplicate these definitions in Swift or TypeScript.

## What requires two implementations

Screens, layouts, navigation, business rules and device integrations use different languages and frameworks. A direct SwiftUI edit cannot reliably generate the corresponding React Native edit. For every feature request, the working default is to implement the requested behavior in **both apps in the same change**. The repository's AGENTS.md records this requirement for future coding sessions.

1. Find the matching screen in `shared/screen-map.json`.
2. Put shareable content/design changes in `shared/product.json`.
3. Implement platform-specific UI and logic in SwiftUI and React Native. Use native controls where appropriate while preserving the requested feature and behavior.
4. Update the screen map when adding/removing routes and document platform-only constraints explicitly.
5. Run `npm run check:parity`, `npm run check:changes`, `npm run check:react-native`, and the Xcode tests. Open both versions for visual/behavioral changes.

`check:parity` validates the shared catalog, question references, native resource wiring and screen mapping. `check:changes` also catches a change set that touches platform-specific source in only one app. It compares the worktree with HEAD by default; use `node scripts/check-platform-parity.cjs --changes --base=REVISION` to review a different baseline. These checks are reminders and structural validation, **not proof of behavioral equivalence**. A reviewer must still verify the matching behavior. The initial SwiftUI conversion has its own native implementation of existing behaviors, with React Native changed to consume the shared catalog.

## Data synchronization

The two apps keep separate local demo storage. Verified InsForge accounts restore the same profile and private connection preferences on sign-in. A theme/content source edit reaches both builds, but choosing a theme or sending a message at runtime in one app does not change the other app. Both should eventually use the backend contract in `docs/BACKEND.md` for real cross-device synchronization. The project now uses InsForge for accounts, profile photos and private connection preferences; couple activities and demo content remain local.

## Native differences and current limits

The native interface uses SwiftUI navigation, PhotosPicker, AVFoundation, MapKit and local notifications. The React Native interface retains Expo integrations. Native onboarding combines the original optional privacy/couple/welcome steps into its onboarding and settings screens; the screen map expresses correspondence, not identical page counts. Both still provide widget previews, demo billing and local simulated partners; couple activities and partner delivery remain local. See `native-ios/README.md` for current device/platform limits.

The five private onboarding questions, options and short responses are shared under `connectionOnboarding` in `shared/product.json`. See `docs/ONBOARDING.md` for storage, privacy and fixed-screen layout details.

Tap feedback is shared through `product.json` → `motion`. Native controls use `SmoothButtonStyle`; React Native controls use `MotionPressable`. Keep actions immediate, touch layouts unchanged, and honor Reduce Motion. See `docs/MOTION.md`.
