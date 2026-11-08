# Connection onboarding

Both apps use the five optional questions in `shared/product.json` → `connectionOnboarding`. The screen copy is deliberately short:

1. **What would feel good?** Everyday closeness, deeper conversations, fun, or appreciation.
2. **What gets in the way?** Busy days, schedules, repetitive conversations, or finding words.
3. **What feels like care?** Kind words, photos, time to talk, or laughing together.
4. **What fits your day?** 2 minutes, 5 minutes, 10+ minutes, or flexible.
5. **Where should we start?** Gentle, playful, or thoughtful.

No answer is preselected. Every question has Skip. Each choice gets one brief acknowledgment. The summary and Home offer a free starter deck and a suggested amount of time. Choosing a time does not create a goal, enable reminders, or measure relationship quality.

## Layout

Onboarding uses fixed, non-scrolling screens. Continue and Skip stay at the bottom. Question screens have at most four options. Smaller screens use tighter spacing and omit the secondary sentence; controls retain at least 44-point touch targets. Optional pronouns, full notification settings and longer explanations are available in Profile instead of filling onboarding.

Native onboarding uses a geometry-based fixed layout. React Native onboarding uses `Screen scroll={false}`. Account sign-in forms, system photo/date pickers, and Profile settings are separate flows and retain their normal system behavior.

## Persistence and privacy

Before account creation, answers persist as a local draft. Signup attaches them to that user; verified remote accounts save to **public.connection_preferences** on InsForge. Sign-in restores their server answers. Simulated demo answers stay local.

The table has `user_id` (primary key and cascading FK to `auth.users`), `schema_version`, `answers`, `completed`, and server-maintained `updated_at`. JSON payloads contain at most five predefined choice IDs, not free-form disclosures. Version 1 also permits the original legacy option IDs for compatibility with earlier clients.

This is a separate table from profiles and couple data. Anonymous users have no table privileges. SELECT/INSERT/UPDATE/DELETE policies enforce `user_id = auth.uid()`; updates also have WITH CHECK. Partners cannot read one another's answers. The database rejects unknown keys and invalid choice IDs.

Profile → Your connection preferences lets users edit or clear their choices. Clear replaces answers with an empty object, so no personalized starter is shown. A failed remote save is shown as an error and does not report success. Exports contain only the current user's answers.

## Verification

- Swift tests cover legacy-data decoding, local persistence, account isolation, exports, validation and recommendations.
- React Native tests cover routing, draft adoption, isolation, skip/clear, invalid values and recommendations.
- `node scripts/verify-connection-db.cjs` performs read-only schema, privilege, owner-policy and answer-constraint checks against the currently linked backend.
- Migration `20261107214706_connection-preferences.sql` was applied and verified on a temporary schema-only backend branch, reviewed, then merged into the parent. The temporary branch was removed.
- React Native onboarding steps were checked at 320 × 568 for clipped controls. Native onboarding was checked in the iPhone 17 Pro simulator.

After the relationship step, both apps show a brief introduction to the five personalization questions. Copy and duration live in `shared/product.json` under `onboardingTransition`. The transition blocks duplicate taps, cancels on unmount, and uses static paired hearts with Reduce Motion.

The preparation animation brings two hearts together, sends out two rings, and reveals four small sparkles before fading into the questions. Both implementations use the same 2.4-second duration and fixed 224-point illustration.

Continue on “Your pace. Your space.” opens account creation directly. Both apps use a centered rounded card with email first, followed by password confirmation, login, and privacy links. Social providers are not presented until connected. Account creation copy is shared under `accountCreation`.
