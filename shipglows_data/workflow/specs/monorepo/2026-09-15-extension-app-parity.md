---
artifact: implementation_spec
metadata_schema_version: "1.0"
artifact_version: "1.0.1"
project: replayglows
created: "2026-09-15"
updated: "2026-09-24"
created_at: "2026-09-15"
updated_at: "2026-09-16"
source_model: kimi-k3
status: active
chantier_status: in_progress
source_skill: sg-development
scope: extension-app-parity
owner: Diane
confidence: high
risk_level: high
security_impact: yes
docs_impact: yes
linked_systems: [ext, app, backend]
depends_on:
  - "shipglows_data/workflow/specs/monorepo/2026-09-05-extension-universal-playback.md"
  - "shipglows_data/workflow/specs/monorepo/2026-09-05-extension-onboarding.md"
  - "shipglows_data/product/ext/product.md"
supersedes: []
evidence:
  - "Read-only exploration of app/, ext/ and backend/packages/backend on 2026-09-15."
  - "Operator validated the parity plan on 2026-09-15 with decisions D1-D4 recorded below."
next_step: "Phase 2 wiring: operator confirms CustomJWT deployment state (D1) and the real CONVEX_URL; then implement the real auth provider, sign-in/out UX and fail-closed product gate."
---

# Title
Maximal Flutter app parity in the Chrome extension through a full extension page on the shared Convex backend

## Status
Plan validated by the operator on 2026-09-15 (decisions D1-D4). Phase 1 (surface, router, app-like shell, i18n, tokens, packaging) and Phase 3 screen implementation (13 screens by three parallel subagents) landed on 2026-09-16; `pnpm type-check`, `pnpm lint` and `pnpm build:ext` pass (manifest verifier OK, 7 resources). Phase 2 is partially stubbed: pluggable auth provider with a fail-closed unauthenticated state and a placeholder Convex URL block the realtime data layer until the operator confirms the deployment state and `CONVEX_URL`. Phase 4 (hosted YouTube connect), Phase 5 (local-to-cloud migration) and Phase 6 (QA, packaged and hosted proofs, docs/claims) remain.

## User Story
As a video learner, I open a full ReplayGlows page from the extension and find the same library, player, playlists, feeds and notes as the app, synchronized with my account, while keeping the lightweight in-page YouTube actions and local-only mode when I am not connected.

## Validated Decisions
- D1 Auth strategy: spike the suite product customJwt path first (`REPLAYGLOWS_PRODUCT_JWT_*` provider already declared in `backend/packages/backend/convex/auth.config.ts`); fall back to Clerk session acquisition inside the extension if the suite cannot issue product tokens.
- D2 Parity scope: full 13-screen parity target (Feed, Play, Playlists, Playlist detail, Virtual feed detail, Notes, Note detail, Notifications, Preferences, Hidden, Stats, Feedback, sign-in), excluding only non-portable surfaces (Android/FCM push, microphone feedback recording, feedback admin, Vercel OAuth handlers which stay hosted).
- D3 Local-to-cloud model: one-time confirmed migration of local bookmarks to cloud notes at first connection (copy, never move; dedupe by video + timestamp); once connected, the cloud is the single source of truth across popup, full page and Flutter app; disconnection returns to current local-only mode; reconnection offers to sync only the notes created meanwhile. No permanent dual-write, no conflict engine.
- D4 Popup role: stays lightweight (quick actions + playback card) and gains an "Open the app" entry; the full page is an additional surface, existing popup/options/content surfaces are preserved.

## Minimal Behavior Contract
A new `ext/src/app/` surface opens as a full browser tab and reproduces the app shell (Feed / Play / Lists / Notes) plus secondary pages. It authenticates the user, gates every product feature on server-verified `replayglows` access (fail-closed), and reads/writes the shared product Convex backend. YouTube connection is initiated from the extension but completed through the hosted Vercel OAuth handlers. Local bookmark records remain compatible; migration to cloud notes is explicit, confirmed and non-destructive.

## Success Behavior
Connected state shows identical library/notes/playlists data as the Flutter app for the same account. Notes created in the extension appear in the app and vice versa. Offline or signed-out state behaves exactly like today's local extension. First-connection migration reports what was copied and leaves the local archive intact.

## Error Behavior
Missing/expired auth or missing product access shows a blocked state with sign-in/account-center actions, never stale data presented as current. OAuth completion failure surfaces the hosted error parameters. Convex unreachable keeps local mode usable. Migration dedupe never drops an existing cloud note silently.

## Problem
The extension is local-only today: no auth, no network, no sync with the app. Users who learn in the browser cannot reach their cloud library, playlists, feeds or transcripts without leaving the extension context.

## Solution
Add a full-page extension surface reusing the Convex JS client against the existing product backend, port the app shell and screens to Vue 3 within the extension design-token layer, reuse the hosted YouTube OAuth ceremony by driving it in a browser tab, and define one explicit local-to-cloud migration moment instead of a permanent synchronization engine.

## Scope In
- New `src/app/` Vite entry (HTML + mount + Vue Router) registered in `rollupOptions.input`; opened via `chrome.tabs.create` from popup and options.
- Auth spike then implementation: customJwt suite token path first, Clerk fallback; product-access gating mirroring `productAccessStatusProvider` semantics, fail-closed.
- Screen parity: Feed (cards/list/notes views, filters, quota strip), Play (YouTube iframe embed, notes/transcript tabs, queue, speed), Playlists + Replay Feeds CRUD and sources, Notes (search/sort/group/detail), Hidden, Notifications, Stats, Preferences (web-applicable subset), Feedback text.
- YouTube connect initiated from the extension, completed by hosted handlers, completion detected via return navigation or `youtube:getYoutubeConnectionStatus` polling; sync remains backend-orchestrated (`youtube:startQuotaSafeSync`), no client-side playlist loops.
- One-time local bookmark migration to cloud notes with confirmation, copy semantics and video+timestamp dedupe.
- FR/EN i18n parity for every new string through `ext/src/i18n.ts`; design tokens aligned with app theme (primary `#0D87E1`, self-hosted fonts).
- Documentation and claim updates: `ext/AGENT.md`, `shipglows_data/product/ext/product.md` (local-only non-goal revision), `shipglows_data/technical/architecture.md`, claim register, TASKS.md.

## Scope Out
Android/FCM push, microphone audio feedback recording, feedback admin, moving or modifying the Vercel OAuth handlers, Web Store publication, side panel or tab-override hosts, telemetry. Saved segments and advanced media effects remain research candidates.

## Constraints
- Existing popup, options, YouTube content bundle (`contentscript.js`) and playback bundle (`media.ts`) remain otherwise unchanged; content bundles stay self-contained. **Operator-authorized exception (2026-09-24):** the separately scoped YouTube frame-capture feature in `2026-09-23-extension-youtube-frame-capture.md` may add a shared icon dropdown with clipboard/local download beside the bookmark control, authenticated cloud note attachment, app-to-extension boolean auth-state relay, automatic cloud/local routing, and the channel/video local image archive with generated Markdown index. This follows checkpoint commit `c6fc159`. All other parity behavior remains frozen; this exception does not close BUG-2026-09-18-003 or authorize broader YouTube-control changes.
- MV3 service worker discipline: no worker-lifetime source of truth; realtime subscriptions live in the full page, worker and popup stay request/response.
- No destructive storage migration; local bookmark schema compatibility preserved; normalize-on-read rules unchanged.
- Hosted auth verification keeps the recorded `vercel-preview-push` mode; local packaging proof never substitutes for hosted OAuth/cookie/Convex verification.
- No telemetry, no remote scripts, no new host permissions beyond the already-approved HTTP/HTTPS set; network usage and privacy copy changes require the product contract and claim register updates listed above.
- Secrets, tokens and cookies are never logged or copied into docs.

## Test Contract
Per phase: `pnpm type-check`, `pnpm exec eslint src`, `pnpm build:ext` (manifest resource verifier), extended `node --test` suites, Playwright-based isolated-profile proofs for popup + full page + YouTube injection. Auth/gating/YouTube-connect proof on the hosted environment, reported separately from local build success. Migration tested against legacy `videoId`/`timestamp` records and duplicate timestamps.

## Dependencies
Existing extension stack (Vue 3, Vite, Tailwind v4, pnpm 11.24, Node 24). Convex JS client for the full page. Backend customJwt provider requires `REPLAYGLOWS_PRODUCT_JWT_*` deployment env vars — activation state unknown, spike-owned. YouTube OAuth completion stays dependent on `app/api/auth/youtube*` hosted handlers.

## Invariants
- Client-only identity is never product access; every product read/write goes through the backend guard semantics.
- Local mode remains fully functional without account; network is only used in connected mode.
- Migration is a copy with confirmation; local records are never deleted by the migration.
- The extension never holds the Google OAuth client secret; token refresh stays server-side.
- One auth strategy ships; the rejected D1 fallback path is removed, not left dormant.

## Links & Consequences
Revises the local-only non-goal in `shipglows_data/product/ext/product.md` and the "bookmarks stay in your browser" copy once connected mode ships; claim register must be reconciled before any public statement. Parity scope overlaps `replayglows-youtube-core-parity-priority-2` acceptance criteria; reuse its QA checklist where applicable.

## Documentation Coherence
Update `ext/AGENT.md`, product contract, `technical/architecture.md`, claim register and `workflow/TASKS.md` as phases land. Extension editorial claims stay bounded by delivered and proven behavior.

## Edge Cases
ZOMBIES: expired/revoked product snapshot mid-session; Convex deployment unreachable; OAuth callback abandoned; duplicate timestamps during migration; legacy local record formats; worker suspension during OAuth dance; YouTube SPA navigation during connect; user cancels hosted sign-in; language switch mid-session; popup opened while full page already open.

## Implementation Tasks
1. Phase 0: spike customJwt deployment state and Clerk fallback acquisition; record decision; revise product contract, privacy copy and claim register.
2. Phase 1: `src/app/` surface, router, app-like shell, token/i18n foundations, package verification.
3. Phase 2: auth service, Convex client wiring, fail-closed product gate, sign-in/out UX.
4. Phase 3: screen parity implementation across Feed/Play/Lists/Notes and secondary pages.
5. Phase 4: YouTube connect from the extension via hosted flow with completion detection.
6. Phase 5: one-time local-to-cloud migration with confirmation and dedupe.
7. Phase 6: QA hardening, packaged browser proofs, hosted auth verification, documentation and claims reconciliation.

## Acceptance Criteria
Full page reproduces validated D2 scope with identical data as the app for the same account; D3 migration proven non-destructive with legacy records; local mode unchanged when signed out; all Test Contract checks pass; hosted auth and YouTube connect verified separately from packaging proof; docs and claims updated.

## Test Strategy
Domain unit tests first, then type/lint/build with the package verifier, then isolated-profile packaged browser scenarios, then hosted environment verification. A Vite page alone never proves extension contexts or permissions.

## Risks
Clerk-in-extension session acquisition may prove fragile (hosted page + token handoff); the customJwt path depends on suite issuance capability; realtime subscriptions must stay out of the MV3 worker; iframe embed inside `chrome-extension://` origin may need CSP and cookie adjustments; parity with a moving Flutter target requires the spec to be re-validated when app screens change materially.

## OWASP Security Gate
Auth tokens stored only via extension-appropriate storage with minimal lifetime; no tokens in URLs, logs or docs; fail-closed gating; sender validation rules extended unchanged to any new message namespace; OAuth state/ticket ceremony remains server-side. Formal ASVS certification not claimed.

## Execution Notes
Internal contracts in English; user-facing UI copy FR/EN. Keep the legacy YouTube integration and its unrelated edits untouched. Prefer small phase-scoped deliveries with packaging proof each time.

## Open Questions
- Is the `customJwt` provider active on the deployed Convex backend, and can the WinFlowz suite issue product tokens for the extension? (Phase 0 spike.)
- Exact token handoff mechanism for the Clerk fallback (hosted sign-in tab vs `chrome.identity.launchWebAuthFlow`) — decided by spike evidence.

## Skill Run History
| Date | Stage | Result |
| --- | --- | --- |
| 2026-09-15 | 100-sg-spec | Plan explored, validated by operator with decisions D1-D4, spec drafted. |
| 2026-09-16 | 100-sg-development | Phase 1 foundations + Phase 3 screens built (`ext/src/app/`). Typecheck/lint/build green. API contract reconciled with live backend (pagination envelope for `youtube:getAllVideos`, `progress:getAllProgress` wrapper, `youtubeInteractions:toggleLike`). Wiring to real auth/URL awaits D1 deployment-state confirmation. |
