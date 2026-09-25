---
artifact: architecture_context
metadata_schema_version: "1.0"
artifact_version: "0.1.9"
project: "replayglows"
created: "2026-05-10"
updated: "2026-09-25"
status: "draft"
source_skill: "sf-docs"
scope: "architecture"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
docs_impact: "yes"
security_impact: "yes"
evidence:
  - "README.md"
  - "shipglows_data/technical/app/architecture.md"
  - "shipglows_data/technical/site/architecture.md"
  - "shipglows_data/technical/lab/architecture.md"
linked_systems:
  - "Flutter Web"
  - "Vercel"
  - "Astro"
  - "FastAPI"
  - "Clerk"
  - "Convex"
  - "YouTube OAuth"
external_dependencies:
  - "Clerk"
  - "Convex"
  - "Google OAuth / YouTube API"
  - "Vercel"
  - "Astro"
  - "FastAPI"
  - "yt-dlp"
  - "ffmpeg"
invariants:
  - "AGENTS.md remains a compatibility symlink to AGENT.md."
  - "Astro runtime content frontmatter follows site/src/content.config.ts."
  - "Public site claims stay bounded by app/product contracts and the claim register."
depends_on:
  - "shipglows_data/technical/guidelines.md"
supersedes: []
next_review: "2026-06-10"
next_step: "sg-docs technical audit"
---

# Architecture Context

## System Map

- `app`: Flutter web client with Riverpod, go_router, Clerk auth, Convex client state, Vercel static deployment, and Vercel API handlers for YouTube OAuth.
- `backend`: Convex product backend for ReplayGlows product data, YouTube tokens, preferences, playlists, transcripts, and product access snapshots.
- `site`: Astro static marketing site with English/French routes, blog content collection, public pricing/comparison/trust pages, and app CTA routing through `src/config/site.ts`.
- `ext`: standalone Chrome extension retaining the bundled JavaScript YouTube integration, a TypeScript MV3 worker that serializes local bookmark storage, and connected Vue popup/options surfaces. Vite produces the unpacked package.
- `lab`: FastAPI transcript worker for media download, normalization, provider transcription, health checks, and operational deployment.

## Integration Boundaries

- The ReplayGlows product Convex backend lives inside this monorepo under `backend`.
- Flutter app code under `lib/convex/` is client transport/state, not backend schema or functions.
- Private product Convex reads, writes, and actions must use the shared backend access guard before touching product data or spending YouTube quota. The guard validates the Clerk/Convex identity and an active `replayglows` product-access snapshot; client product-access UI state is not authorization.
- Recognized accounts that receive ReplayGlows free access are represented by a server-owned `productAccessSnapshots` row with `reasonCode=default_free_entitlement`. Revoked snapshots block access and must not be overwritten by the default-free bootstrap.
- Public site content must use app/product contracts as claim boundaries.
- Extension code and packaging are isolated under `ext/`; generated extension output remains disposable and is not a governance source of truth.
- Worker secrets, provider keys, cookies, and raw logs must not be copied into docs.

## Invariants

- `AGENTS.md`, when present, is a compatibility symlink to `AGENT.md`.
- Astro runtime content frontmatter follows `site/src/content.config.ts`.
- YouTube OAuth callback behavior must stay aligned across Flutter app routes and Vercel handlers.

## Dependency Compatibility Review (2026-09-04)

The backend uses Convex 1.45, Firebase Admin 14.3, OpenAI 7.10 and TypeScript 7.0.2. The compiler migration passed through TypeScript 6.0.3; explicit `types: ["node"]` keeps the intended Convex type environment. Node 24 remains the declared host runtime, including extension tooling; Node 26 type declarations do not change that runtime requirement. The OpenAI Responses structured-output path passed a mocked-fetch test and browser-platform bundling, without a live API call.

Astro 7 preserves the site HTML compression policy explicitly. See `../workflow/audits/2026-09-04-dependabot-review.md` for merged PRs, evidence and deferred native/worker migrations. No new mandatory CI gate or protection change was applied.

## Minor Dependency Refresh (2026-09-05)

The approved refresh covers backend, site, extension and Flutter dependencies within their current major versions. Astro is locked at 7.2.9 because the site retains its seven-day minimum release age. See `../workflow/audits/2026-09-05-dependency-refresh.md` for exact scope, verification and remaining risks. The extension packaging and Docker runtime issues found during this refresh were repaired in the subsequent extension/backend maintenance described below.

## Extension Packaging and Backend Security (2026-09-05)

Vite owns all extension manifest assets, and builds verify that every declared resource exists. Docker uses Node 24 and the pinned pnpm lock; Dependabot covers extension npm and Docker dependencies. Isolated Chromium checks cover package loading and mocked content-script injection.

Backend overrides are restricted to `gaxios@6.7.1 -> uuid@11.1.1` and `teeny-request@9.0.0 -> uuid@11.1.1`. These Storage clients use CommonJS `uuid.v4()` for multipart boundaries. `npm run test:dependency-compat` checks actual consumer resolution, buffer-bound rejection, local multipart uploads and Firebase messaging initialization. Remove the overrides once upstream dependencies adopt patched uuid versions; do not broaden them globally. Audit reports zero vulnerabilities for the backend at this check. See `../workflow/audits/2026-09-05-extension-backend-repair.md` for proof and limits.

## Extension Bookmark Runtime (2026-09-05)

`ext/src/content/content.ts` bundles `ext/contentscript.js` as a classic content script. `ext/src/background/background.ts` serializes validated storage operations across tabs and extension pages, with no worker-lifetime data cache. `ext/src/main.ts` mounts the functional Vue popup; options own configurable shortcuts and confirmed JSON replacement/import plus JSON/Markdown export.

The canonical local schema remains a flat `bookmarks` array (`url`, `time`, `formattedTime`, `note`, optional `title` and `channel`) and derived `groupedBookmarks`. `ext/src/bookmarks.ts` also reads historical options `videoId`/`timestamp` records. Imports validate before mutation; duplicate adds preserve the existing record and show an error. No backend connection or dependency migration is introduced. The content match covers the existing YouTube host permission to handle homepage-to-watch SPA navigation.

## YouTube Frame Capture (2026-09-24)

The YouTube capture control reads a boolean Clerk sign-in snapshot from extension-local storage. The authenticated app publishes state changes through a same-origin page event; the app-host `media.js` content script validates the origin and relays only the boolean to the MV3 worker. No auth token or cookie is stored by the extension. Signed-in capture uses the existing nonce-checked app bridge and owner-authorized Convex attachment path; missing/revoked auth or upload failure falls back to local PNG capture.

Local captures use `chrome.downloads` to create `ReplayGlows/<sanitized channel>/<sanitized title> [video ID]/captures/YYMMDD_HHmmss_HH-MM-SS.png`. The worker stores capture metadata (not image bytes) in `chrome.storage.local` and regenerates one `Notes.md` index per video after captures and local bookmark note mutations. The file combines relative image links with timestamped bookmark notes ordered by playback position. `Notes.md` is generated output; downloaded images remain in the user's Downloads directory. The feature adds Chrome `downloads` permission alongside `clipboardWrite`; packaged browser proof remains necessary for permission acceptance and actual file paths.

## Universal Extension Playback (2026-09-05)

The subsequent approved playback feature expands host access to HTTP/HTTPS for a separate `media.js` bundle. YouTube notes and injected CSS remain restricted to their existing host. `src/background/entry.ts` composes the bookmark service with `src/playback/background.ts`; the bookmark listener ignores namespaced playback messages.

`playbackSettings` in local storage owns the global base speed, favorite, step, enabled state and configurable shortcuts. `playbackSession` in session storage owns tab pin overrides and registered frame IDs. All playback read/modify/write and cleanup operations serialize and read durable/session state afresh. Trusted extension-origin UI pages are identified before inspecting `sender.tab`, since options opened as tabs also have tab metadata. Content messages derive tab/frame identity from the sender and cannot mutate UI-only pin settings; inherited frames require a trusted web origin.

Unpinned tabs share one speed; pinned tabs override it until unpinned, closed or the browser/extension session ends. Polling queries actual media state from registered frames and prioritizes playing media. `media.ts` handles HTML5 rate application, DOM discovery, guarded keyboard shortcuts and temporary A–B loops. Unsupported/rejected media state is surfaced rather than represented as success. No remote data service or bookmark schema migration is introduced. Stored segments, audio effects and URL rules remain separate research candidates.

The discovery guide is shared between popup and options. Independent local `discovery.v1.*` keys store confirmed milestones, postponed topics and help visibility, without changing bookmark records or exports. Popup integration confirms a requested speed against a fresh media snapshot, observes pin/loop state, recognizes stored notes and distinguishes a bookmark tab opening from proven playback. The guide reads validated playback settings through the existing message contract; it introduces no worker endpoint, content script or permission. See the extension onboarding spec for UI state, failure and native-popup proof.

Canary proof is local to a dedicated profile and selected public YouTube scenarios; it does not establish exhaustive YouTube behavior or operator visual acceptance. See `../workflow/bugs/BUG-2026-09-05-001.md` for the implementation and verification boundary. Docker/package success remains distinct from these browser proofs.
## Extension localization (2026-09-05)

`ext/src/i18n.ts` owns typed French/English Vue copy and the persisted `auto`/`fr`/`en` preference. The classic YouTube content script mirrors its injected-control vocabulary, while Chrome `_locales` owns localized package metadata.

## Payment adapters (2026-09-25)

The Convex backend keeps the Polar subscription webhook in `convex/billing/polarWebhook.ts`, using `polarAdapter.ts` for signature and explicit product mapping. Unknown products are rejected. Its local subscription projection uses provider-neutral IDs. With no customer history to retain, the old Polar-only fields, hardcoded product ID and unscoped webhook ID fallback have been removed. The webhook records completion after the subscription mutation succeeds. The existing free access snapshot on account creation is independent of payment history and remains in place until the suite entitlement synchronization replaces it.

`convex/billing/stripeAdapter.ts` verifies exact-body Stripe signatures and confirms that its API key belongs to `STRIPE_REPLAYGLOWS_ACCOUNT_ID`. `/stripe-webhook` then relays the original signed body to the ReplayGlows route of the central commerce service. The central route verifies the same business signing secret and account again and remains the only entitlement writer. The account ID and central destination are stored in Doppler `replayglows` (`dev` and `prd`); `dev` uses test mode in the ReplayGlows business account. On 2026-09-25, the test account's dashboard onboarding was completed with `https://replayglows.com` and the online-payments intent. The dashboard next offers to open the production account and verify the business; that operator-owned step is pending, so `prd` has no live API key. No payment configuration is kept in a local env example. The ReplayGlows Convex backend and its `/stripe-webhook` route are deployed to Dev; the current Stripe test endpoint still delivers directly to the central ReplayGlows route. Switching that endpoint requires confirming the product backend and central route share its signing secret. Missing key, signing secret, or approved offer keeps new Stripe sales unavailable. No Polar-to-Stripe subscription migration or offer mapping is implied by this adapter.
