---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglows"
created: "2026-06-09"
created_at: "2026-06-09 14:54:22 UTC"
updated: "2026-06-09"
updated_at: "2026-06-09 16:51:46 UTC"
status: ready
source_skill: sf-spec
source_model: "GPT-5 Codex"
scope: "feature"
owner: "Diane"
user_story: "En tant qu'utilisatrice ReplayGlows en train de regarder, trier, lire ou prendre des notes, je veux passer dans un mode focus qui masque le chrome classique et expose les actions utiles par swipe selon la page, afin de garder une interface plus directe, tactile et moins dispersée."
confidence: medium
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems:
  - "app"
  - "Flutter"
  - "Riverpod"
  - "GoRouter"
  - "YouTube playback UI"
depends_on:
  - artifact: "AGENTS.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipglows_data/product/app/product.md"
    artifact_version: "1.2.0"
    required_status: "reviewed"
  - artifact: "shipglows_data/branding/branding.md"
    artifact_version: "1.0.0"
    required_status: "reviewed"
  - artifact: "shipglows_data/workflow/specs/replayglows-youtube-core-parity-priority-3.md"
    artifact_version: "1.0.0"
    required_status: "ready"
supersedes: []
evidence:
  - "User feedback 2026-06-09: current playback swipe menu works globally but should later become page-aware."
  - "User proposal 2026-06-09: merge fullscreen/focus mode with swipe menus so page swipe menus are accessible only in fullscreen/focus mode."
  - "Current code has Play-local focus mode in app/lib/screens/play/play_screen.dart."
  - "Current code has global bottom-bar playback swipe behavior in app/lib/widgets/app_shell.dart."
  - "Current i18n already contains fullscreen/focus labels in app/lib/i18n/en.dart and fr.dart."
next_step: "/sf-start replayglows-global-focus-swipe-menus"
---

# Spec: ReplayGlows Global Focus Swipe Menus

## Title

ReplayGlows global focus swipe menus

## Status

ready

This spec is updated after readiness review. It intentionally keeps the implementation out of this run and fixes the previous blockers by defining exact focus entry/exit behavior, exact page actions, security posture, and a formal test contract.

## User Story

En tant qu'utilisatrice ReplayGlows en train de regarder, trier, lire ou prendre des notes, je veux passer dans un mode focus qui masque le chrome classique et expose les actions utiles par swipe selon la page, afin de garder une interface plus directe, tactile et moins dispersée.

## Minimal Behavior Contract

ReplayGlows must provide a global focus mode that hides normal screen chrome and makes bottom swipe menus page-aware. When focus mode is off, the app keeps its normal app bars, top actions, bottom navigation, and current playback controls. When focus mode is on, each primary page exposes its defined action menu through an upward swipe from the bottom bar. A downward swipe closes an open menu. A downward swipe while the menu is closed exits focus mode. The Play page keeps the current advanced playback menu behavior as its page menu, while Feed, Lists, and Notes receive their own exact action menus. If a page has no valid context for one of its actions, that action must render disabled with a short reason and must not fire a destructive or stale action. The edge case most likely to be missed is moving between pages while a menu is open: the menu must reset to the new page's action model and must not execute actions from the previous page.

## Success Behavior

- A user can enable focus mode from a global Focus icon in the top app bar on Feed, Play, Lists, and Notes.
- The existing Play focus icon becomes the Play route instance of that global Focus toggle.
- In focus mode, top app bars, top-right menu icons, YouTube status chrome, and other standard app shell chrome are hidden or collapsed according to the page contract.
- In focus mode, an upward swipe from the bottom bar opens the current page's action menu.
- In focus mode, a downward swipe from an open menu closes the page action menu.
- In focus mode, a downward swipe from the closed bottom bar exits focus mode and restores normal chrome.
- Each focus menu includes an `Exit focus` action as a secondary escape path.
- On Play, the menu contains the already-stabilized playback actions: `Hide`, `Watched`, `Add to playlist`, `Add channel to feed`, progress, seek, speed, `Previous`, `Play/Pause`, `Next`, and `Loop`.
- On Feed, the menu contains exactly these page actions: `Play feed`, `Refresh feed`, `Filter feeds`, `Sort newest/oldest`, and common playback actions only when a current video exists.
- On Lists root, the menu contains exactly these page actions: `Create playlist`, `Create feed`, `Refresh playlists`, `Sort lists`, and common playback actions only when a current video exists.
- On playlist detail, the menu contains exactly these page actions: `Play playlist`, `Refresh playlist`, `Edit playlist` when the playlist is user-mutable, `Copy playlist link`, and common playback actions only when a current video exists.
- On feed detail, the menu contains exactly these page actions: `Play feed`, `Edit feed`, `Manage sources`, `Refresh feed`, and common playback actions only when a current video exists.
- On Notes, the menu contains exactly these page actions: `Focus search`, `Sort notes`, `Clear search` when a search query exists, `Copy visible notes` when the filtered notes list is not empty, and common playback actions only when a current video exists.
- Common playback actions on non-Play pages are exactly `Previous`, `Play/Pause`, `Next`, and `Open Play`; they never include Play-only metadata actions including `Hide`, `Watched`, `Add to playlist`, or `Add channel to feed`.
- The visible menu always matches the current route after navigation.
- The user can leave focus mode and recover the standard app shell without losing playback, notes, scroll state, or selected route.

## Error Behavior

- If focus mode is enabled on a page with no implemented page menu, the app must either keep swipe inert or show a small non-blocking message that no focus menu exists for this page.
- If a page action depends on YouTube connection, auth, current video metadata, or a selected resource, it must use the existing guarded action path and show the existing connection/error feedback instead of silently failing.
- If a user navigates while a menu is open, close the previous menu and clear drag/progress state.
- If the app loses active video context, playback-specific controls must disable or disappear instead of targeting stale video IDs.
- The feature must not broaden permissions: hiding top chrome is not a security boundary, and every action must keep its existing auth/backend checks.
- Focus menus must not create a new authorization path. Actions that mutate YouTube, Convex, watched/hidden state, playlists, or feeds must call the same guarded functions used by the current buttons, including existing auth checks, quota confirmations, backend validation, and error feedback.

## Problem

ReplayGlows is moving toward a tactile watch-and-work interface where the bottom bar and swipe gestures are more natural than scattered top-right icons. The current code already has a Play-local focus mode and a global playback swipe menu, but these concepts are not unified. Users can control playback from multiple routes, yet a future page-specific menu system would become confusing if it simply adds more swipe layers on top of normal app bars and route-specific top actions.

## Solution

Create a single global focus mode in the app shell. In that mode, hide normal chrome and route all bottom swipe gestures through a page action menu registry. Each page owns a small menu model that declares its focus actions, required context, fallback behavior, and validation path. The Play page's existing advanced playback menu becomes the first concrete page menu; Feed, Lists, and Notes follow with their exact action groups.

The MVP must use an in-app focus mode, not the browser Fullscreen API. Browser fullscreen can be considered later if needed, but it is not required for the product behavior described here.

## Page Action Registry

The implementation must use the following action contract for the MVP. Labels can be translated and shortened in i18n, but action identity and availability rules must stay stable.

| Route family | Primary actions | Availability and disabled behavior |
|--------------|-----------------|------------------------------------|
| Feed `/feed` | `Play feed`; `Refresh feed`; `Filter feeds`; `Sort newest/oldest`; common playback actions | `Play feed` is disabled when the visible feed queue is empty. `Refresh feed` uses the existing quota guard and YouTube connection path. `Filter feeds` is disabled when virtual feeds have not loaded. `Sort newest/oldest` toggles the current feed sort. Common playback actions appear only when an active video ID exists. |
| Play `/play?videoId=...` | `Hide`; `Watched`; `Add to playlist`; `Add channel to feed`; progress row; `Speed -0.50`; `Speed -0.10`; `Back 30s`; `Back 10s`; `Forward 10s`; `Forward 30s`; `Speed +0.10`; `Speed +0.50`; `Previous`; `Play/Pause`; `Next`; `Loop` | Metadata actions resolve the current route/session video and disable with a reason when no current video can be resolved. Timeline controls can render before iframe activation, but seek actions disable until player timing is known. Speed changes queue until the player is ready. |
| Lists root `/playlists` | `Create playlist`; `Create feed`; `Refresh playlists`; `Sort lists`; common playback actions | `Create playlist` and `Create feed` open the existing create dialogs. `Refresh playlists` uses the existing YouTube connection/sync path. `Sort lists` opens a compact sort sheet with exactly `Manual`, `A-Z`, and `Recent`. `Manual` uses the existing custom order. `A-Z` sorts loaded playlists and feeds by title. `Recent` sorts loaded playlists and feeds by newest cached/updated timestamp, with items lacking timestamps after dated items. The selected mode is persisted locally with `SharedPreferences`; no backend mutation is created for sorting. Common playback actions appear only when an active video ID exists. |
| Playlist detail `/playlists/:id` | `Play playlist`; `Refresh playlist`; `Edit playlist`; `Copy playlist link`; common playback actions | `Play playlist` is disabled when the playlist has no loaded videos. `Refresh playlist` uses the existing quota guard. `Edit playlist` appears only for mutable owned playlists. `Copy playlist link` uses the existing clipboard path. Common playback actions appear only when an active video ID exists. |
| Feed detail `/playlists/feeds/:id` | `Play feed`; `Edit feed`; `Manage sources`; `Refresh feed`; common playback actions | `Play feed` is disabled when the feed has no loaded videos. `Edit feed`, `Manage sources`, and `Refresh feed` must reuse the existing virtual-feed detail flows. Common playback actions appear only when an active video ID exists. |
| Notes `/notes` | `Focus search`; `Sort notes`; `Clear search`; `Copy visible notes`; common playback actions | `Focus search` puts focus in the existing search field. `Sort notes` toggles the existing sort. `Clear search` appears only when search text exists. `Copy visible notes` copies the currently filtered notes list and is disabled when that list is empty. Common playback actions appear only when an active video ID exists. |

Every menu also includes `Exit focus`. Destructive or external-side-effect actions keep the existing confirmation, quota, auth, and error behavior.

## Scope In

- Global focus mode state in `app`.
- App shell behavior that hides or collapses normal chrome in focus mode.
- Migration of the existing Play focus affordance into the global focus toggle.
- Route-aware bottom swipe menu host in `AppShell`.
- Page menu contracts for primary routes: Feed, Play, Lists, Notes.
- Migration of the Play advanced playback menu into the page menu model without changing its actions.
- A focus-mode entry/exit affordance that is reachable from standard UI before chrome is hidden.
- Tests for menu availability, route changes, swipe state transitions, and stale-context prevention.
- English and French strings for new labels, hints, unavailable states, and focus-mode affordances.
- Compact/mobile bottom-bar viewport behavior as the MVP surface.

## Scope Out

- Browser Fullscreen API, native OS fullscreen, or device orientation locking.
- Wide side-rail/tablet focus menus; wide viewport may keep the current side rail until a separate desktop interaction contract is specified.
- New backend actions, new Convex schema, or new YouTube API behavior.
- Replacing the YouTube iframe/player UI.
- Designing every future route menu beyond Feed, Play, Lists, and Notes.
- Removing current top actions before their focus menu replacements are implemented and tested.
- Creating a marketing/support explanation page.

## Constraints

- Preserve the existing working global playback controls until the focus-mode menu path fully covers them.
- Do not use UI visibility as an authorization mechanism.
- Do not add another competing gesture layer. There must be one focus-mode bottom swipe contract.
- The implementation must preserve current long-press `Previous` / `Next` thumbnail preview behavior unless a later spec replaces it.
- The existing Play focus preference is not persisted or migrated for the MVP. Focus mode is session-local UI state and resets when the app reloads or the shell is rebuilt.
- The Play advanced action reliability fixes remain required: actions must target current route/session video IDs and avoid stale metadata.
- `Sort lists` is display-only local UI state for the MVP; it must not reorder YouTube playlists, virtual feed sources, or Convex playlist order documents.
- Prefer existing Flutter/Riverpod patterns in `app_shell.dart`, `play_screen.dart`, and current screens over a new state-management library.
- The feature must work on Flutter Web first because that is the current testable surface.
- The MVP applies to compact/mobile bottom-bar layouts; wide `NavigationRail` layouts must not regress and can remain unchanged.

## Test Contract

- `surface`: Flutter Web compact/mobile UI, Riverpod state, GoRouter route awareness, gesture-driven bottom bar.
- `proof_profile`: automated widget/provider tests plus manual Flutter Web mobile-viewport QA.
- `proof_order`: run static checks first, then focused widget/provider tests, then manual checklist, then authenticated YouTube-write smoke if credentials are available.
- `checklist_path`: `shipglows_data/workflow/test-checklists/replayglows-global-focus-swipe-menus.md`.
- `automated_commands`:
  - `(cd app && flutter analyze)`
  - `(cd app && flutter test test/widgets/app_shell_playback_swipe_test.dart test/app/playback_session_provider_test.dart)`
- `required_scenario_ids`:
  - `GFSM-001`: Normal mode keeps standard app bars, top actions, bottom navigation, and current playback controls; upward swipe does not open a page focus menu.
  - `GFSM-002`: Focus mode can be entered from Feed, Play, Lists, and Notes through the global Focus icon.
  - `GFSM-003`: Focus mode can be exited by downward swipe when the menu is closed, by `Exit focus`, and by browser/app back before route navigation.
  - `GFSM-004`: Feed focus menu shows `Play feed`, `Refresh feed`, `Filter feeds`, `Sort newest/oldest`, and no Play-only metadata actions.
  - `GFSM-005`: Play focus menu shows the full advanced playback contract and preserves recent reliability fixes for `Add to playlist`, `Add channel to feed`, seek, speed, and current-video targeting.
  - `GFSM-006`: Lists root focus menu shows `Create playlist`, `Create feed`, `Refresh playlists`, `Sort lists`, and no detail-only playlist actions.
  - `GFSM-006a`: `Sort lists` opens `Manual`, `A-Z`, and `Recent`; changing sort changes only the loaded Lists root display order and persists locally.
  - `GFSM-007`: Playlist detail focus menu shows `Play playlist`, `Refresh playlist`, `Edit playlist` only when mutable, `Copy playlist link`, and no root-only create actions.
  - `GFSM-008`: Feed detail focus menu shows `Play feed`, `Edit feed`, `Manage sources`, `Refresh feed`, and no playlist-specific edit action.
  - `GFSM-009`: Notes focus menu shows `Focus search`, `Sort notes`, conditional `Clear search`, conditional `Copy visible notes`, and never intercepts text input typing.
  - `GFSM-010`: Common non-Play playback actions appear only with active video context and are exactly `Previous`, `Play/Pause`, `Next`, and `Open Play`.
  - `GFSM-011`: Navigating while a focus menu is open closes the old menu and resolves the next swipe against the new route.
  - `GFSM-012`: YouTube disconnected/auth-required states reuse existing connection/error flows and do not produce hidden side effects.
  - `GFSM-013`: Narrow French labels fit without overflow or overlap in every MVP menu.
- `required_results`: each required scenario must pass or be explicitly blocked with reproduction notes, affected route, and follow-up issue before `/sf-verify` can pass.
- `exception_with_proof`: authenticated YouTube write actions including adding a video to a playlist, hiding a video, marking watched, and adding a channel to a feed can be manually smoke-tested with a connected test account because they depend on external account state.
- `exception_without_proof`: none.

## Dependencies

- Local Flutter app code under `app/lib`.
- Existing Riverpod providers:
  - `appPlaybackControllerProvider`
  - `activePlayVideoIdProvider`
  - `playbackSessionProvider`
- Existing routes in `app/lib/app/router.dart`.
- Existing i18n files:
  - `app/lib/i18n/en.dart`
  - `app/lib/i18n/fr.dart`
- Product context: `shipglows_data/product/app/product.md` version `1.2.0`.
- Branding context: `shipglows_data/branding/branding.md` version `1.0.0`.
- Fresh external docs verdict: `fresh-docs not needed` for spec creation because this spec defines local Flutter UI behavior using already-installed project patterns. If implementation introduces browser fullscreen, new gesture packages, GoRouter upgrades, or platform APIs, rerun the documentation freshness gate before coding that part.

## Invariants

- Normal mode remains familiar: standard app bars, top actions, and bottom navigation are visible.
- Focus mode is reversible from every primary route.
- A menu action can only execute if its source page context is current and valid.
- Playback controls never target an empty or stale video ID.
- Page-specific actions cannot leak across routes.
- Any destructive or external-side-effect action keeps its existing confirmation, auth, and error behavior.
- State cleanup happens on route change, focus exit, and menu close.

## Links & Consequences

- `AppShell` becomes the owner of global focus state and swipe menu hosting.
- Individual pages must expose page action descriptors or callbacks without duplicating shell layout.
- Play's existing focus mode moves into global focus mode. The Play focus icon must toggle the same shell-owned focus state used by Feed, Lists, and Notes.
- Existing top-right actions should not be removed until the corresponding focus menu action exists and is tested.
- The i18n layer needs new strings for menu labels and focus-mode hints.
- The app may need one small page-menu abstraction; avoid over-building a generic plugin system.
- This feature may change onboarding/support expectations because hidden chrome can make actions less discoverable if focus mode is entered accidentally.

## Documentation Coherence

- Update internal product/UX documentation if the app documents Play focus mode, fullscreen, or gesture controls.
- Add changelog/release-note copy when implemented because this changes a primary navigation model.
- Marketing/public claims do not need updates unless the site explicitly claims fullscreen or gesture menus.
- Support/help text should explain that focus mode hides standard chrome and exposes page actions through swipe.

## Edge Cases

- User enters focus mode with no active video.
- User enters focus mode on Feed or Notes before ever visiting Play.
- User opens Feed menu, navigates to Notes, and swipes again.
- User opens a video from Feed and immediately swipes before Play metadata finishes loading.
- User exits focus mode while a page menu is open.
- User swipes down with the menu open, then swipes down again with the menu closed.
- User is signed out or YouTube disconnected and opens an action requiring YouTube.
- User is on a wide viewport with side rail; MVP must leave the current side-rail layout unchanged instead of introducing an untested desktop focus menu.
- Browser back/forward navigation while focus mode is active.
- Keyboard focus/accessibility traversal when top chrome is hidden.
- Long labels in French on narrow screens.

## Implementation Tasks

- [ ] Task 1: Model global focus mode in the app shell.
  - File: `app/lib/widgets/app_shell.dart`
  - Action: Add shell-level focus mode state, expose entry/exit behavior, close open menus on route changes, and implement downward-swipe exit when the focus menu is closed.
  - User story link: User can switch into one consistent focus mode across pages.
  - Depends on: None.
  - Validate with: New widget/unit tests for focus state and route cleanup.
  - Notes: Reuse current `AppShell` state patterns; do not add a new state library.

- [ ] Task 2: Bridge Play-local focus mode to global focus mode.
  - File: `app/lib/screens/play/play_screen.dart`
  - Action: Remove Play-only persisted focus ownership and make the existing Play focus button toggle the shell-owned global Focus state.
  - User story link: Existing user affordance still works but now controls the global focus contract.
  - Depends on: Task 1.
  - Validate with: `flutter analyze`; Play route sanity test/manual test.
  - Notes: Do not preserve or migrate `_prefsFocusMode` for the MVP; focus mode resets on reload.

- [ ] Task 3: Create a page menu contract.
  - File: `app/lib/widgets/app_shell.dart` or a new `app/lib/widgets/focus/page_action_menu.dart`
  - Action: Define a small route-aware action model for menu rows, labels, icons, enabled state, callbacks, unavailable messages, and `Exit focus`.
  - User story link: Each page can expose its own actions without mixing route behavior.
  - Depends on: Task 1.
  - Validate with: Unit/widget tests for route-to-menu resolution.
  - Notes: Keep the abstraction small; route-specific callbacks can stay in existing screens when simpler.

- [ ] Task 4: Migrate Play advanced playback menu into the page menu host.
  - File: `app/lib/widgets/app_shell.dart`
  - Action: Make Play's existing advanced playback rows render through the focus-mode menu host while preserving current buttons, feedback, and swipe behavior.
  - User story link: Play remains the reference implementation for focus swipe menus.
  - Depends on: Tasks 1 and 3.
  - Validate with: Existing `app_shell_playback_swipe_test.dart` updated; manual Play swipe test.
  - Notes: Do not regress recent fixes for `Playlist`, `Channel`, speed, seek, or active-video availability.

- [ ] Task 5: Add Feed focus menu.
  - File: `app/lib/screens/videos/videos_screen.dart` and shell/menu files.
  - Action: Surface exactly `Play feed`, `Refresh feed`, `Filter feeds`, `Sort newest/oldest`, and common playback actions when active video exists.
  - User story link: Feed becomes usable in focus mode without top icons.
  - Depends on: Task 3.
  - Validate with: Widget/unit tests for menu availability and disabled states; manual Feed mobile viewport test.
  - Notes: Do not trigger sync automatically; preserve quota confirmation.

- [ ] Task 6: Add Lists focus menu.
  - File: `app/lib/screens/playlists/playlists_screen.dart`, `playlist_detail_screen.dart`, `virtual_feed_detail_screen.dart`, and shell/menu files.
  - Action: Surface the exact Lists root, playlist detail, and feed detail action contracts from the Page Action Registry, with disabled states when current context is missing.
  - User story link: Lists can be managed without relying on top-right icons in focus mode.
  - Depends on: Task 3.
  - Validate with: Manual tests on Lists root, playlist detail, and virtual feed detail.
  - Notes: Keep destructive actions behind existing confirmation patterns.

- [ ] Task 7: Implement Lists root local sort.
  - File: `app/lib/screens/playlists/playlists_screen.dart`
  - Action: Implement `Sort lists` as a local display sort sheet with `Manual`, `A-Z`, and `Recent`, persisted in `SharedPreferences`, without changing backend playlist order or YouTube order.
  - User story link: Lists remain usable in focus mode without relying on the top bar sort placeholder.
  - Depends on: Tasks 3 and 6.
  - Validate with: Widget/unit test or manual Lists root test covering all three modes.
  - Notes: This task replaces the current sort placeholder with defined MVP behavior.

- [ ] Task 8: Add Notes focus menu.
  - File: `app/lib/screens/notes/notes_screen.dart` and shell/menu files.
  - Action: Surface exactly `Focus search`, `Sort notes`, conditional `Clear search`, conditional `Copy visible notes`, and common playback actions when active video exists.
  - User story link: Notes stay productive when standard chrome is hidden.
  - Depends on: Task 3.
  - Validate with: Manual Notes test and focused widget tests for enabled/disabled action states.
  - Notes: Do not intercept text input gestures or keyboard focus.

- [ ] Task 9: Hide normal chrome in focus mode.
  - File: `app/lib/widgets/app_shell.dart` and primary screen app bars where needed.
  - Action: Hide/collapse app bars, top action icons, YouTube status chrome, and standard bottom navigation according to route and compact/mobile viewport rules while keeping the focus bottom gesture surface available.
  - User story link: Focus mode removes standard UI distractions.
  - Depends on: Tasks 1 and 3.
  - Validate with: Browser/manual screenshots on mobile and desktop widths.
  - Notes: Maintain a visible or gesture-accessible exit path.

- [ ] Task 10: Add i18n strings.
  - File: `app/lib/i18n/en.dart`, `app/lib/i18n/fr.dart`
  - Action: Add labels/tooltips/unavailable text for focus mode and page menus.
  - User story link: English/French users understand the mode and actions.
  - Depends on: Tasks 3-9.
  - Validate with: `flutter analyze`; focused i18n key sanity check if project has one.
  - Notes: Avoid long labels that overflow narrow cells.

- [ ] Task 11: Add validation checklist.
  - File: `shipglows_data/workflow/test-checklists/replayglows-global-focus-swipe-menus.md`
  - Action: Create a manual checklist containing all required scenario IDs from the Test Contract.
  - User story link: The feature needs gesture/runtime proof beyond static tests.
  - Depends on: Tasks 1-10.
  - Validate with: Checklist executed during `/sf-verify`.
  - Notes: Include YouTube-connected and disconnected states.

## Acceptance Criteria

- [ ] CA 1 / `GFSM-001`: Given the user is in normal mode on any MVP route, when focus mode is off, then standard top/bottom chrome remains visible and upward swipe does not open a page focus menu.
- [ ] CA 2 / `GFSM-002`: Given the user is on Feed, Play, Lists, or Notes, when the global Focus icon is pressed, then focus mode starts and standard route chrome is hidden.
- [ ] CA 3 / `GFSM-003`: Given focus mode is active, when the menu is closed and the user swipes down, presses `Exit focus`, or uses browser/app back, then focus mode exits before normal route navigation occurs.
- [ ] CA 4 / `GFSM-004`: Given focus mode is enabled on Feed, when the user swipes up from the bottom bar, then the Feed menu shows exactly the Feed actions defined in the Page Action Registry plus eligible common playback actions.
- [ ] CA 5 / `GFSM-005`: Given focus mode is enabled on Play, when the user swipes up, then the current advanced playback menu opens with the same behavior as the existing stabilized Play menu.
- [ ] CA 6 / `GFSM-006`: Given focus mode is enabled on Lists root, when the user swipes up, then the Lists root menu shows exactly the root actions defined in the Page Action Registry plus eligible common playback actions.
- [ ] CA 6a / `GFSM-006a`: Given the Lists root menu is open, when the user chooses `Manual`, `A-Z`, or `Recent`, then the visible list order changes locally, the choice persists locally, and no backend or YouTube order mutation is sent.
- [ ] CA 7 / `GFSM-007`: Given focus mode is enabled on playlist detail, when the user swipes up, then playlist detail actions match the Page Action Registry and `Edit playlist` is absent or disabled for non-mutable playlists.
- [ ] CA 8 / `GFSM-008`: Given focus mode is enabled on feed detail, when the user swipes up, then feed detail actions match the Page Action Registry and playlist-specific actions do not appear.
- [ ] CA 9 / `GFSM-009`: Given focus mode is enabled on Notes, when the user swipes up while not editing text, then Notes actions match the Page Action Registry and typing/search input is not intercepted by the menu gesture layer.
- [ ] CA 10 / `GFSM-010`: Given no active video exists, when the user opens any non-Play page menu, then common playback controls are hidden or disabled and cannot target stale IDs.
- [ ] CA 11 / `GFSM-011`: Given any focus menu is open, when the user navigates to another route, then the previous menu closes and the next swipe resolves the new route's menu.
- [ ] CA 12 / `GFSM-012`: Given YouTube is disconnected, when a menu action requires YouTube, then the existing connection flow or error feedback is shown and no hidden side effect occurs.
- [ ] CA 13 / `GFSM-013`: Given a narrow French UI, when page menu labels render, then text does not overflow or overlap.
- [ ] CA 14: Given implementation is complete, when validation runs, then `flutter analyze`, focused widget/provider tests, the manual checklist, and authenticated YouTube-write smoke where available pass.

## Test Strategy

- Add or extend `app/test/widgets/app_shell_playback_swipe_test.dart` for:
  - focus mode gating;
  - downward swipe close vs downward swipe exit;
  - global route availability;
  - page menu route resolution;
  - close/reset behavior.
- Add page-menu unit/widget tests near the chosen menu abstraction if it is split out of `AppShell`.
- Run:
  - `(cd app && flutter analyze)`
  - `(cd app && flutter test test/widgets/app_shell_playback_swipe_test.dart test/app/playback_session_provider_test.dart)`
- Manual proof:
  - execute every scenario ID in `shipglows_data/workflow/test-checklists/replayglows-global-focus-swipe-menus.md`;
  - include active video and no-active-video states;
  - include YouTube disconnected behavior;
  - include narrow French labels.

## Risks

- Gesture conflict risk: bottom swipe may collide with page scroll, note editing, or browser gestures.
- Discoverability risk: hiding normal chrome can make actions harder to find if exit/focus affordance is weak.
- Stale-context risk: page actions can target prior route or prior video if menu state is not reset.
- Security/workflow risk: focus menus centralize actions with external side effects, so every mutation must reuse existing guarded paths and must not rely on client visibility for authorization.
- Scope creep risk: a generic page action system can become too broad; keep MVP route-specific.
- Accessibility risk: hidden top chrome can trap keyboard/screen-reader users unless focus/semantics are handled.
- Product risk: if focus mode is presented as true fullscreen, users may expect browser/OS fullscreen; copy must call it focus mode unless browser fullscreen is actually implemented.

## Execution Notes

- Read first:
  - `app/lib/widgets/app_shell.dart`
  - `app/lib/screens/play/play_screen.dart`
  - `app/lib/screens/videos/videos_screen.dart`
  - `app/lib/screens/playlists/playlists_screen.dart`
  - `app/lib/screens/notes/notes_screen.dart`
- Preserve current playback reliability fixes before adding new page menus.
- Start by centralizing focus mode and route/menu resolution before moving individual page actions.
- Treat global focus as session-local UI state. Do not store a focus-mode preference for the MVP.
- Implement Lists root sort as local display state only. Do not touch Convex order mutations or YouTube playlist ordering for this task.
- Reuse existing mutations and guarded UI flows for external side-effect actions; do not introduce new backend actions for this feature.
- Do not introduce browser fullscreen APIs in MVP.
- Do not create a large reusable framework before proving the four primary page menus.
- Stop and rescope if an action requires a new backend mutation, a new YouTube API side effect, or a permission decision not already present.
- Fresh-docs verdict for this spec: `fresh-docs not needed`; implementation must revisit docs if new platform APIs are introduced.

## Open Questions

- None.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-06-09 | sf-spec | GPT-5 Codex | Created global focus swipe menus spec from user product direction and current AppShell/Play focus context. | draft saved | `/sf-ready replayglows-global-focus-swipe-menus` |
| 2026-06-09 | sf-ready | GPT-5 Codex | Reviewed structure, user-story alignment, scope, test contract, adversarial risks, and security posture. | not ready | `/sf-spec replayglows-global-focus-swipe-menus` |
| 2026-06-09 | sf-spec | GPT-5 Codex | Clarified exact page actions, focus entry/exit behavior, and formal test contract after readiness review. | draft updated | `/sf-ready replayglows-global-focus-swipe-menus` |
| 2026-06-09 | sf-ready | GPT-5 Codex | Re-reviewed clarified spec for implementation readiness, language doctrine, test contract, and security posture. | not ready | `/sf-spec replayglows-global-focus-swipe-menus` |
| 2026-06-09 | sf-spec | GPT-5 Codex | Integrated user decisions: keep `Sort lists` with local sort behavior, unify Play focus into global focus, make focus session-local, and document existing guarded action paths. | draft updated | `/sf-ready replayglows-global-focus-swipe-menus` |
| 2026-06-09 | sf-ready | GPT-5 Codex | Validated updated spec against readiness checklist, adversarial risks, security posture, and test contract. | ready | `/sf-start replayglows-global-focus-swipe-menus` |

## Current Chantier Flow

| Stage | Status | Notes |
|-------|--------|-------|
| sf-spec | done | Draft updated with user decisions for list sorting, focus ownership, focus persistence, and guarded side-effect actions. |
| sf-ready | ready | Spec is ready for implementation. |
| sf-start | next | Implement from the ready spec. |
| sf-verify | not launched | Requires automated and manual gesture proof. |
| sf-end | not launched | Close after verification and documentation/changelog decisions. |
| sf-ship | not launched | Ship only after focused runtime QA. |

Next command: `/sf-start replayglows-global-focus-swipe-menus`
