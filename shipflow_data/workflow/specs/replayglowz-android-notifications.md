---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-06-11"
created_at: "2026-06-11 11:02:13 UTC"
updated: "2026-06-11"
updated_at: "2026-06-11 11:17:25 UTC"
status: ready
source_skill: 100-sf-spec
source_model: "GPT-5 Codex"
scope: "android-notifications"
owner: "Diane"
confidence: "high"
user_story: "En tant qu'utilisatrice ReplayGlowz sur Android, je veux choisir exactement quelles notifications je recois, a quelle cadence, et pour quels feeds ou chaines, afin de rester informee sans subir de bruit inutile et revenir vite dans l'app quand quelque chose d'utile arrive."
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "replayglowz_app"
  - "replayglowz_backend"
  - "Firebase Cloud Messaging"
  - "Android notification system"
  - "Convex crons and internal actions"
depends_on:
  - artifact: "AGENTS.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipflow_data/business/apps/replayglowz_app/product.md"
    artifact_version: "1.2.0"
    required_status: "reviewed"
  - artifact: "shipflow_data/business/apps/replayglowz_app/branding.md"
    artifact_version: "1.0.0"
    required_status: "reviewed"
  - artifact: "shipflow_data/technical/apps/replayglowz_app/architecture.md"
    artifact_version: "1.1.1"
    required_status: "reviewed"
supersedes: []
evidence:
  - "replayglowz_app/lib/screens/preferences/preferences_screen.dart already exposes notification preferences."
  - "replayglowz_app/lib/screens/notifications/notifications_screen.dart already displays in-app notifications and mark-as-read actions."
  - "replayglowz_app/lib/models/notification.dart supports `new_video`, `transcript_ready`, and `system` notification types."
  - "replayglowz_backend/packages/backend/convex/notifications.ts already stores and serves notification records."
  - "replayglowz_backend/packages/backend/convex/feedChecker.ts already creates `new_video` notifications from backend checks."
  - "Android notification permission docs: https://developer.android.com/develop/ui/compose/notifications/notification-permission"
  - "Android notification navigation docs: https://developer.android.com/develop/ui/views/notifications/navigation"
  - "FCM Android setup docs: https://firebase.google.com/docs/cloud-messaging/android/get-started"
  - "FCM Android receive docs: https://firebase.google.com/docs/cloud-messaging/android/receive-messages"
  - "Convex actions docs: https://docs.convex.dev/api/modules/server"
next_step: "/102-sf-start replayglowz-android-notifications"
---

# Spec: ReplayGlowz Android Notifications

## Title

ReplayGlowz Android notifications

## Status

ready

This spec launches the notifications chantier with the current product decision: Firebase Cloud Messaging is the Android push transport, but ReplayGlowz backend logic remains the source of truth for user preferences, cadence, targeting, and delivery eligibility.

## User Story

En tant qu'utilisatrice ReplayGlowz sur Android, je veux choisir exactement quelles notifications je recois, a quelle cadence, et pour quels feeds ou chaines, afin de rester informee sans subir de bruit inutile et revenir vite dans l'app quand quelque chose d'utile arrive.

## Minimal Behavior Contract

ReplayGlowz must support Android push notifications that reflect the user's own preferences, not a generic global alert stream. The app must let the user opt into Android push notifications, select a delivery cadence from a bounded product list (`hourly`, `every_6_hours`, `daily`, `every_3_days`), and define notification targeting for ReplayGlowz feeds and eligible YouTube-channel-backed content. The backend must remain the decision engine: it stores device tokens, user preference state, cadence windows, and targeting rules; computes which pending in-app notifications are push-eligible; and sends push delivery through Firebase Cloud Messaging. The Android app must request notification permission at an intentional user moment, register/update its FCM token, receive push notifications, deep-link into the correct ReplayGlowz route, and keep the in-app notifications center consistent with push-delivered items. The easy edge case to miss is duplicate or stale delivery across multiple Android installs: the system must deduplicate by notification record and only send to active device registrations that still belong to the signed-in ReplayGlowz user.

## Success Behavior

- Android users can enable or disable push notifications independently of email notifications.
- Android users can choose a push cadence from exactly:
  - every hour
  - every 6 hours
  - every day
  - every 3 days
- Android users can choose the content sources they want push notifications for:
  - all eligible new videos
  - selected ReplayGlowz feeds
  - selected ReplayGlowz channel sources already known to the current user context
- Android users can keep `transcript_ready` notifications enabled even if some new-video notifications are filtered out, and `transcript_ready` bypasses the new-video cadence buckets.
- ReplayGlowz requests Android notification permission only when the user enables push or enters the notification setup flow, not blindly on first launch.
- The Android app registers an FCM token after permission is granted and syncs token changes to ReplayGlowz backend.
- ReplayGlowz backend stores Android device registrations per user and can deactivate stale tokens.
- ReplayGlowz backend sends FCM notifications only for notifications that match the user's cadence, source targeting, and enabled types.
- Push notifications open the correct ReplayGlowz destination with a valid back stack:
  - `new_video` opens Play with the target `videoId`
  - `transcript_ready` opens Play on the target `videoId` and lands in transcript-capable context
  - `system` opens Notifications unless a more precise route is defined
- Opening a push-delivered notification marks the underlying ReplayGlowz notification as read through the existing mutation path.
- The in-app Notifications screen remains the durable history; push is a delivery surface, not a separate notification store.
- Users who deny Android notification permission can continue using ReplayGlowz normally and still see the in-app notification center.

## Error Behavior

- If Android notification permission is denied, the app must not keep prompting aggressively. It should show a clear in-app state explaining that push is disabled and how to re-enable it in system settings.
- If FCM token registration fails, the app must not pretend push is active. It should keep the push toggle in a recoverable error state and allow retry.
- If backend delivery to a device token fails with an invalid or unregistered token, ReplayGlowz must deactivate that token registration rather than retry forever.
- If a notification references a video that no longer resolves in the current user context, the app should fall back to Notifications screen with a non-blocking explanation instead of opening a broken Play state.
- If a user signs out, the app must unregister or invalidate the device binding for the signed-in ReplayGlowz user before another user can inherit those pushes.
- If multiple Android devices are registered for the same user, delivery may fan out to all active devices, but each device should receive at most one push per notification record.
- Push delivery must not bypass product access checks. Notification generation and delivery are only for users with active ReplayGlowz access.
- If a `transcript_ready` event is eligible, it may be delivered immediately even when `new_video` pushes are currently deferred by cadence.

## Problem

ReplayGlowz already has in-app notifications, unread counts, notification settings primitives, and backend generation for at least `new_video` events. But today the product does not provide Android-native push delivery, does not model per-device push registration, and does not give the user precise control over cadence or source targeting. If notifications are important to ReplayGlowz, the current setup is incomplete: it surfaces records only after the user opens the app, and the preference model is too coarse for a high-value productivity workflow.

## Solution

Implement Android notifications as a two-layer system:

1. ReplayGlowz backend is the source of truth for notification records, push preferences, cadence windows, source targeting, and delivery attempts.
2. Firebase Cloud Messaging is the transport for Android push delivery.

The architecture decision is explicit:

- do not make Flutter the system that decides who should receive a push
- do not make Firebase the place where ReplayGlowz product rules live
- keep product logic in `replayglowz_backend`
- use Android-native/Firebase-native surfaces only for token registration, permission, local handling, and deep-link routing

This chantier should extend the existing notification model instead of creating a second notification system. The in-app notifications table remains canonical; push delivery references those records.

## Scope In

- Android notification permission flow and UX
- Android FCM token registration/update/removal
- Backend storage for Android device registrations
- Backend push preference model for:
  - push enabled/disabled
  - cadence
  - source targeting
  - notification type targeting
- Backend delivery logic that selects eligible notifications and sends them through Firebase Cloud Messaging
- Actionable Android notifications and deep links into ReplayGlowz routes
- Notification channel design for Android with separate OS-level channels by type
- Keeping in-app notifications and push-delivered notifications coherent
- Focused tests and manual Android-device QA
- Docs/config updates for Android notification setup and secrets

## Scope Out

- iOS push notifications
- web push notifications
- email notification redesign
- marketing/lifecycle campaigns, remote config campaigns, or growth messaging
- arbitrary user-defined cadence values beyond the bounded list in this spec
- full cross-platform push unification
- replacing the existing in-app notifications center
- general-purpose notification composer/admin UI

## Constraints

- Firebase/FCM is the Android push transport because the app already uses Firebase runtime configuration and auth-adjacent mobile setup.
- ReplayGlowz backend remains the source of truth for product logic and eligibility.
- Prefer existing Convex backend patterns: generate durable notification rows first, then deliver push through a server-side action.
- Delivery code must run server-side with Firebase Admin credentials; client-side send paths are forbidden.
- The implementation must not leak FCM device tokens in logs, browser diagnostics, analytics, or client-visible error strings.
- Android 13+ runtime permission behavior must be respected.
- Notification routing must use explicit deep links/back stack handling, not fragile ad hoc route strings with missing parent navigation context.
- The bounded cadence list is product-defined for the MVP; do not add custom cron builders in v1.
- Source targeting must be conservative: only ReplayGlowz-owned source ids already associated with the current user should be selectable in the MVP. The MVP must not rely on free-form raw YouTube channel ids as the preference contract.
- Android OS-level notification channels must be split at least into `Transcript ready`, `New videos`, and `System`, so urgent/personal workflow notifications can stay enabled even if lower-priority content noise is muted.

## Test Contract

- `surface`: Android Flutter app, Convex backend, FCM transport, GoRouter deep links, notification settings UI
- `proof_profile`: backend type/static checks, Flutter analyze, targeted unit/widget tests, and manual Android device QA with real Firebase project credentials
- `proof_order`: backend model and delivery tests -> Flutter static/tests -> Android permission and token registration QA -> end-to-end push delivery QA
- `automated_commands`:
  - `(cd replayglowz_backend/packages/backend && npm run typecheck)`
  - `(cd replayglowz_app && flutter analyze)`
  - `(cd replayglowz_app && flutter test <targeted notification tests>)`
  - `/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENTS.md shipflow_data`
- `required_scenario_ids`:
  - `RGN-001`: User enables push from Android settings flow, grants permission, and ReplayGlowz stores a device token registration.
  - `RGN-002`: User denies Android notification permission and ReplayGlowz shows a recoverable disabled state without crashing.
  - `RGN-003`: User chooses each bounded cadence value and the backend stores it exactly.
  - `RGN-004`: User selects feed/channel targeting and ReplayGlowz persists only valid ReplayGlowz feed ids or channel-source ids for that user.
  - `RGN-005`: Backend generates a `new_video` notification that matches the user's preferences and sends exactly one push per active Android device token.
  - `RGN-006`: Backend generates a notification that does not match cadence or targeting and sends no push while preserving the in-app notification row.
  - `RGN-007`: Tapping a `new_video` push opens ReplayGlowz Play for the correct `videoId`.
  - `RGN-008`: Tapping a `transcript_ready` push opens ReplayGlowz in a transcript-capable Play context for the correct `videoId`.
  - `RGN-009`: Opening a push-linked notification marks the underlying notification as read.
  - `RGN-010`: Invalid/unregistered FCM token responses deactivate the backend device registration.
  - `RGN-011`: Signing out prevents the old user from continuing to receive pushes on that device registration.
  - `RGN-012`: Android notification channels are created consistently and user-disabled channels remain respected.
  - `RGN-013`: Existing in-app Notifications screen remains usable even when push is disabled or unavailable.
- `required_results`: all scenarios above must pass or be explicitly blocked with real environment notes before `/sf-verify` can pass.
- `exception_with_proof`: end-to-end FCM delivery requires a real Android build/device and valid Firebase project credentials, so final delivery proof cannot be satisfied by local static checks alone.
- `exception_without_proof`: none.

## Dependencies

- `replayglowz_app/lib/screens/preferences/preferences_screen.dart`
- `replayglowz_app/lib/screens/notifications/notifications_screen.dart`
- `replayglowz_app/lib/models/notification.dart`
- `replayglowz_app/lib/models/settings.dart`
- `replayglowz_app/lib/providers/providers.dart`
- `replayglowz_app/lib/providers/mutations.dart`
- `replayglowz_app/lib/app/router.dart`
- `replayglowz_backend/packages/backend/convex/notifications.ts`
- `replayglowz_backend/packages/backend/convex/settings.ts`
- `replayglowz_backend/packages/backend/convex/schema.ts`
- `replayglowz_backend/packages/backend/convex/feedChecker.ts`
- Android notification permission docs: `fresh-docs checked`
- Android notification navigation docs: `fresh-docs checked`
- Firebase Cloud Messaging Android setup docs: `fresh-docs checked`
- Convex actions docs for external side effects: `fresh-docs checked`

## Invariants

- Notification rows in ReplayGlowz backend remain canonical even when push delivery is unavailable.
- Push delivery never creates a second source of truth for read/unread state.
- Only authenticated ReplayGlowz users with active product access can register push devices or receive pushes.
- Delivery eligibility must always be computed from current server-side preferences, not cached client assumptions.
- Device registrations belong to one ReplayGlowz user at a time.
- Delivery attempts must be idempotent at the notification-record x device-registration level.

## Links & Consequences

- `replayglowz_backend` gains a new device-registration model and push-delivery action layer.
- The settings schema must expand beyond the current coarse notification fields.
- Android app gains a new native dependency surface for messaging and likely local notification presentation/interaction handling.
- Environment/secrets management expands to include Firebase server credentials for push delivery.
- Android QA becomes a real release gate for this feature; Flutter analyze alone is not meaningful proof.
- Public claims should remain narrow: "configurable Android notifications" is safe only after end-to-end delivery is proven.
- Android OS settings will expose multiple ReplayGlowz notification channels, which becomes part of the product contract and support surface.

## Documentation Coherence

- Update `replayglowz_app/README.md` with Android notification setup and any required Firebase plugin/config steps.
- Update app/architecture docs if new Android messaging services or device-registration flows are introduced.
- Document required Firebase server credentials and where they live.
- Add release-note/changelog copy when this ships because it changes a core re-engagement surface.
- Keep user-facing copy practical and low-hype, consistent with ReplayGlowz brand voice.

## Edge Cases

- User enables push but has no eligible feeds/channels selected.
- User selects feeds that are later deleted or revoked.
- User reinstalls the app and receives a new FCM token.
- User has two Android devices with different local permission states.
- User disables an Android notification channel at OS level while ReplayGlowz still has push enabled.
- `transcript_ready` arrives after the video has already been opened and read in-app.
- Backend creates `new_video` notifications in bursts while cadence is `every_3_days`.
- User changes cadence from `hourly` to `daily` after pending notifications already exist.
- A push arrives when the app is foregrounded and the in-app notifications stream updates simultaneously.
- Token rotation happens while the app is authenticated but backgrounded.
- User disables only the Android `New videos` channel but keeps `Transcript ready` enabled at OS level.

## Implementation Tasks

- [x] Task 1: Define the notification product contract in backend settings and schema.
  - Files:
    - `replayglowz_backend/packages/backend/convex/schema.ts`
    - `replayglowz_backend/packages/backend/convex/settings.ts`
  - Action: Extend the settings model for Android push with bounded cadence, type toggles, and source targeting fields that can be validated server-side.
  - Depends on: None.
  - Validate with: backend typecheck and focused settings tests.

- [x] Task 2: Add Android device registration storage and ownership rules.
  - Files:
    - `replayglowz_backend/packages/backend/convex/schema.ts`
    - new backend module for device registration
  - Action: Create a canonical store for Android device tokens with user binding, platform, active state, last-seen timestamps, and token invalidation support.
  - Depends on: Task 1.
  - Validate with: backend tests for register/update/deactivate flows.

- [x] Task 3: Add server-side push delivery adapter using Firebase Admin via Convex actions.
  - Files:
    - new backend delivery module(s)
    - `replayglowz_backend/packages/backend/package.json` if dependencies are added
  - Action: Implement internal action(s) that send Android pushes through FCM using server credentials, with idempotent delivery bookkeeping and invalid-token cleanup.
  - Depends on: Tasks 1-2.
  - Validate with: backend typecheck plus mocked delivery tests.
  - Notes: Delivery must not run from Flutter client code.

- [x] Task 4: Add delivery selection logic for cadence and source targeting.
  - Files:
    - `replayglowz_backend/packages/backend/convex/notifications.ts`
    - `replayglowz_backend/packages/backend/convex/feedChecker.ts`
    - new notification delivery planner module(s)
  - Action: Reuse canonical notification rows, then decide which records are push-eligible for which devices based on the current settings, cadence windows, and selected sources. `transcript_ready` must use its own immediate-priority rule instead of the deferred `new_video` cadence buckets.
  - Depends on: Tasks 1-3.
  - Validate with: backend tests for cadence gating, targeting filters, and dedupe.

- [x] Task 5: Add Android app messaging integration and permission flow.
  - Files:
    - `replayglowz_app/pubspec.yaml`
    - Android platform files under `replayglowz_app/android/`
    - new messaging/bootstrap files under `replayglowz_app/lib/`
  - Action: Add the Flutter/Firebase messaging integration, request Android notification permission at the right time, and sync token registration to backend.
  - Depends on: Tasks 1-3.
  - Validate with: `flutter analyze`, targeted tests, Android manual QA.

- [x] Task 6: Extend Preferences UI for precise Android notification controls.
  - Files:
    - `replayglowz_app/lib/screens/preferences/preferences_screen.dart`
    - `replayglowz_app/lib/models/settings.dart`
    - related providers/mutations
  - Action: Add the bounded cadence controls, type toggles, and source-targeting selectors with safe empty/loading/error states. Source targeting must operate on ReplayGlowz feeds and ReplayGlowz channel-source entries already known to the user.
  - Depends on: Tasks 1 and 5.
  - Validate with: targeted widget tests and manual Android QA.

- [x] Task 7: Implement push tap routing and read-state coherence.
  - Files:
    - messaging/deep-link handling in app layer
    - `replayglowz_app/lib/app/router.dart`
    - `replayglowz_app/lib/screens/notifications/notifications_screen.dart`
  - Action: Route push taps to the right screen, preserve back navigation, and mark notifications as read through the canonical mutation flow.
  - Depends on: Tasks 5-6.
  - Validate with: routing tests and manual device QA.

- [x] Task 8: Add Android notification channels and foreground handling.
  - Files:
    - Android platform setup
    - app messaging service/presentation layer
  - Action: Define stable Android channels for ReplayGlowz notifications, handle foreground message presentation, and keep OS-level channel behavior explicit. The MVP must create distinct channels for `Transcript ready`, `New videos`, and `System`.
  - Depends on: Task 5.
  - Validate with: manual Android QA and channel-state checks.

- [x] Task 9: Document setup, secrets, and QA procedure.
  - Files:
    - `replayglowz_app/README.md`
    - relevant architecture/docs artifacts
    - optional checklist file under `shipflow_data/workflow/test-checklists/`
  - Action: Document Firebase/FCM setup, secret ownership, Android QA expectations, and operational failure modes.
  - Depends on: Tasks 3-8.
  - Validate with: metadata lint and doc review.

## Acceptance Criteria

- [ ] CA 1: Android users can enable or disable push notifications independently of other notification surfaces.
- [ ] CA 2: Android users can choose exactly one cadence value from `hourly`, `every_6_hours`, `daily`, or `every_3_days`.
- [ ] CA 3: Android users can target notifications to all eligible sources or selected ReplayGlowz feeds/channel-source entries that belong to them.
- [ ] CA 4: `new_video`, `transcript_ready`, and `system` notifications can be independently gated where the product allows it, with conservative defaults, and `transcript_ready` is treated as the higher-priority workflow class.
- [ ] CA 5: Android 13+ runtime notification permission is requested from a deliberate user action or setup step, not at arbitrary startup.
- [ ] CA 6: ReplayGlowz stores and updates Android FCM device registrations per user securely.
- [ ] CA 7: Backend push delivery uses server-side Firebase credentials and never sends from client code.
- [ ] CA 8: A push for `new_video` opens ReplayGlowz Play for the correct video.
- [ ] CA 9: A push for `transcript_ready` opens ReplayGlowz in a usable transcript-capable context for the correct video.
- [ ] CA 10: Invalid/unregistered device tokens are deactivated automatically after delivery failures.
- [ ] CA 11: The in-app Notifications screen remains the canonical history even when push is disabled, denied, or unavailable.
- [ ] CA 12: Sign-out and user switching do not leak one user's notifications to another user's device session.

## Test Strategy

- Add backend unit coverage for settings validation, device registration lifecycle, cadence gating, targeting filters, and push dedupe.
- Add Flutter widget/provider tests for new notification settings controls and disabled/error states.
- Add targeted routing tests for push tap -> route resolution.
- Run Android manual QA on a real device with a real Firebase project and valid product access account.
- Verify both foreground and background push behavior.
- Verify denial, recovery, reinstall, and sign-out cases explicitly.

## Risks

- Push can become noisy and erode trust if cadence or targeting is implemented loosely.
- Device-token lifecycle bugs can leak notifications across installs or users.
- Firebase Admin credentials add real secret-management risk.
- Convex action/runtime constraints may require careful package/runtime selection for Firebase Admin integration.
- Source targeting can become brittle if feed/channel identity mapping is under-modeled.
- Android-only implementation can create product expectation pressure for iOS/web parity before those surfaces are ready.

## Execution Notes

- Prefer ReplayGlowz backend as the decision engine because it already owns settings, notification rows, and scheduled feed-check work.
- Use Firebase Cloud Messaging as transport only.
- Use Convex internal actions for delivery because official Convex docs allow third-party integrations and side effects in actions.
- Keep client code focused on permission, token sync, foreground handling, and deep-link routing.
- Product decisions fixed in this spec:
  - `transcript_ready` is a higher-priority class than `new_video` and bypasses the deferred new-video cadence buckets.
  - MVP targeting is modeled with ReplayGlowz feed ids and ReplayGlowz channel-source ids, not arbitrary raw YouTube channel ids.
  - Android OS channels are distinct by type: `Transcript ready`, `New videos`, `System`.
- Read first:
  - `replayglowz_backend/packages/backend/convex/notifications.ts`
  - `replayglowz_backend/packages/backend/convex/settings.ts`
  - `replayglowz_backend/packages/backend/convex/schema.ts`
  - `replayglowz_backend/packages/backend/convex/feedChecker.ts`
  - `replayglowz_app/lib/screens/preferences/preferences_screen.dart`
  - `replayglowz_app/lib/screens/notifications/notifications_screen.dart`
  - `replayglowz_app/lib/providers/providers.dart`
  - `replayglowz_app/lib/providers/mutations.dart`
  - `replayglowz_app/lib/app/router.dart`
- Validation commands:
  - `(cd replayglowz_backend/packages/backend && npm run typecheck)`
  - `(cd replayglowz_app && flutter analyze)`
  - `(cd replayglowz_app && flutter test <targeted notification tests>)`
  - `/home/claude/shipflow/tools/shipflow_metadata_lint.py AGENTS.md shipflow_data`
- Do not attempt to encode cadence or targeting rules into Firebase topics as the primary source of truth; ReplayGlowz needs per-user product logic that should remain backend-owned.
- Do not ship broad default push-on behavior without a deliberate permission/setup UX.
- Stop and reroute if implementation requires:
  - client-side push send logic
  - cross-user token reuse
  - Firebase topics as the canonical targeting system
  - silent broad opt-in without explicit Android permission/setup UX
  - shipping without real Android-device push proof

## Open Questions

None.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-06-11 11:02:13 UTC | sf-spec | GPT-5 Codex | Created Android notifications chantier spec from product direction, current backend/app notification surfaces, and official Android/FCM/Convex docs. | draft spec created | `/101-sf-ready replayglowz-android-notifications` |
| 2026-06-11 11:17:25 UTC | sf-ready | GPT-5 Codex | Reviewed structure, metadata, freshness, adversarial and security posture; kept the spec out of ready because three product decisions still change delivery behavior and Android OS contract. | not ready | `/100-sf-spec replayglowz-android-notifications` |
| 2026-06-11 11:17:25 UTC | sf-build | GPT-5 Codex | Applied the operator decision that `transcript_ready` is higher priority, fixed the MVP targeting model to ReplayGlowz feed/source ids, fixed Android OS channels by type, and prepared the spec for a final readiness pass. | draft updated | `/101-sf-ready replayglowz-android-notifications` |
| 2026-06-11 11:17:25 UTC | sf-ready | GPT-5 Codex | Re-ran readiness after the product decisions were fixed in the spec; structure, security posture, delivery contract, and proof path are now coherent enough for implementation. | ready | `/102-sf-start replayglowz-android-notifications` |
| 2026-06-11 15:55:00 UTC | sf-start | GPT-5 Codex | Implemented backend Android push settings/device/delivery/cadence logic, Flutter Android FCM permission/token/foreground/tap handling, precise Preferences controls, Android channels, and setup docs. | implemented | `/103-sf-verify replayglowz-android-notifications` |
| 2026-06-11 14:54:05 UTC | sf-verify | GPT-5 Codex | Re-ran Flutter/backend checks after verification pass; local quality holds but Android-hosted proof remains missing and a verified route/read gap for system pushes persists. | partial | `005-sf-ship replayglowz-android-notifications` |
| 2026-06-11 15:07:21 UTC | 103-sf-verify | GPT-5 Codex | Re-verified Android push routing/read path: local Flutter analyze + tests + backend typecheck pass. Android-hosted end-to-end proof still missing. | partial | `005-sf-ship replayglowz-android-notifications` |

## Current Chantier Flow

| Stage | Status | Notes |
|-------|--------|-------|
| sf-spec | complete | Draft created with architecture decision: ReplayGlowz backend owns rules, Firebase/FCM owns Android push transport. |
| sf-ready | complete | Product decisions fixed: `transcript_ready` is higher priority, MVP targeting uses ReplayGlowz feed/source ids, and Android OS channels are split by type. |
| sf-start | complete | Implementation complete locally; `flutter analyze`, backend `npm run typecheck`, and metadata lint pass. |
| sf-verify | partial | Local checks pass; Android device + Firebase credential proof required. |
| sf-end | pending | Close bookkeeping after implementation and QA. |
| sf-ship | pending | Ship only after backend, Flutter, and real-device push proof pass. |
