# Interaction motion

Buttons, cards, avatar picks, question choices, and game controls use the shared `motion` settings in `shared/product.json`:

- Press to 98% scale over 80 ms, with a small opacity change.
- Release back to normal over 180 ms.
- Fade onboarding question content over 160 ms; the action footer stays fixed.

SwiftUI uses `SmoothButtonStyle`, including the existing explicit plain-style controls. Native screen navigation retains its system transitions. React Native uses `MotionPressable` and native-driven scale/opacity on phones. Web uses the same timing through Animated's web implementation. Original focus styling, labels, disabled state, long-press actions, caller transforms, and caller opacity are preserved.

Press animations are interruptible and never postpone the action. Canceling a press restores its visual state. Unmounting stops outstanding animation work. No looping press animations or added tap delays are used. Text, controls and screen dimensions do not shrink in layout; scaling is visual only.

Reduce Motion disables press scaling and the new question transitions. React Native shares one device-preference listener across the app and also respects its saved reduce-motion preference. Native controls read the SwiftUI accessibility environment. The decorative Home dots stop moving under Reduce Motion; on iOS they also pause outside the active scene and update at most 30 times per second.

Validation includes type checking, lint, platform parity checks, existing business-rule tests, and UI checks of disabled/selected buttons and onboarding navigation. These checks do not constitute a device frame-rate benchmark.
