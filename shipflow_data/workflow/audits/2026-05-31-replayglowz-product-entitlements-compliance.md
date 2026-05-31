---
artifact: audit
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglowz"
created: "2026-05-31"
updated: "2026-05-31"
status: active
source_skill: sf-verify
scope: "product-entitlements-compliance"
owner: "Diane"
confidence: "medium"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "replayglowz_app"
  - "replayglowz_backend"
  - "/home/claude/shipflow/skills/references/product-entitlements-playbook.md"
depends_on:
  - artifact: "/home/claude/shipflow/skills/references/product-entitlements-playbook.md"
    artifact_version: "1.0.1"
    required_status: "active"
supersedes: []
evidence:
  - "Latest reviewed commit: b7a08ee2ec19adb367f2d42793fc8c899bf3c88c, record feed import extension verification."
  - "Commit b7a08ee updates only the Feed source discovery spec and checklist; it records extension verification for subscription import and playlist channel metadata backfill."
next_step: "Add server-side product entitlement enforcement to all protected ReplayGlowz Convex reads/actions, not only client routing and YouTube OAuth start/callback."
---

# Audit: ReplayGlowz Product Entitlements Compliance

## Verdict

ReplayGlowz is partially aligned with the product entitlements doctrine, but not fully compliant yet.

The architecture correctly separates identity from product access in documentation and in the YouTube OAuth Vercel handlers. The app also has a fail-closed client-visible product access status provider. The main compliance gap is backend authorization depth: many product Convex queries, mutations, and actions authenticate the Clerk subject and validate user-owned rows, but do not consistently verify an active suite entitlement before protected product data reads/writes.

## Doctrine Checklist

| Doctrine point | Status | Evidence | Gap |
|---|---:|---|---|
| Identity is separate from product access | partial | `users:getProductAccessStatus` distinguishes unauthenticated, account recognized, active, revoked, and missing entitlement states. | Recognized ReplayGlowz accounts still default to free access in product backend status. |
| Suite ledger is canonical | partial | `productAccessSnapshots` are clearly snapshots with `source: suite | legacy`, `globalUserId`, `productId`, status, and expiry. | Product backend still has local `subscriptions` and default free access semantics that can be confused with entitlement truth. |
| Fail closed when entitlement lookup fails | partial | Flutter `productAccessStatusProvider` denies access on missing status function, unauthorized errors, and generic failures. | Server-side product functions generally only require auth/user ownership; a client/UI gate is not enough for doctrine compliance. |
| Protected reads/writes validate entitlement | fail | YouTube OAuth start/callback verifies suite entitlement server-side before token persistence per `replayglowz_app/api/auth/_youtube.js` and callback flow. | Convex product data paths such as Feed, cached YouTube, notes, playlists, transcript, and settings functions need a shared entitlement guard. |
| Provider events are not runtime source of truth | pass for reviewed surface | OAuth uses YouTube as a permission/data provider, not as product authorization. | Billing/provider ingestion was not in scope of this repo audit. |
| Client-provided entitlement data is not trusted | partial | Product access status is queried from Convex; OAuth server handlers verify with suite bridge and secret. | Convex product functions need centralized enforcement so a client cannot bypass the UI status by calling functions directly. |

## Latest Commit Impact

Reviewed commit: `b7a08ee2ec19adb367f2d42793fc8c899bf3c88c`.

Files changed:

- `shipflow_data/workflow/specs/replayglowz-feed-source-discovery-playlist-channel-expansion.md`
- `shipflow_data/workflow/test-checklists/replayglowz-feed-source-discovery-playlist-channel-expansion.md`

Security/compliance impact:

- No code changed in this commit.
- The commit records that the Feed extension was shipped and verified.
- The recorded extension covers two code paths that matter for entitlement compliance: explicit subscription import via `subscriptions.list`, and explicit playlist channel metadata backfill via `videos.list`.
- The extension does not add a new entitlement model or a local entitlement ledger.
- The underlying shipped code remains subject to the existing backend authorization gap: the new YouTube actions authenticate the Clerk user and operate on that user's token/cache, but they do not themselves prove active ReplayGlowz product entitlement before spending YouTube quota or patching product cache.

## Evidence Notes

- `replayglowz_backend/packages/backend/convex/users.ts:30` exposes product access status from server state.
- `replayglowz_backend/packages/backend/convex/users.ts:68` checks `productAccessSnapshots` for accepted `productId` and legacy aliases.
- `replayglowz_backend/packages/backend/convex/users.ts:106` grants default `replayglowz/free` access for recognized users. This may be intentional product policy, but it must be documented as the canonical free entitlement rule or moved behind the suite ledger.
- `replayglowz_backend/packages/backend/convex/schema.ts:170` defines `productAccessSnapshots`, which looks like a product-local mirror/cache rather than a durable canonical ledger.
- `replayglowz_app/lib/providers/providers.dart:756` makes the UI product access provider fail closed on backend errors.
- `replayglowz_backend/packages/backend/convex/youtube.ts:3529` requires an authenticated Convex identity before fetching YouTube subscriptions.
- `replayglowz_backend/packages/backend/convex/youtube.ts:3622` requires an authenticated Convex identity before backfilling playlist video channel metadata.
- `replayglowz_backend/packages/backend/convex/virtualFeeds.ts:607` scopes playlist-channel candidate extraction to the authenticated user's feed, playlist cache, channel cache, and sources.

## Findings

### High: Product Convex authorization is not entitlement-complete

The product backend has many user-owned queries/actions that rely on `ctx.auth.getUserIdentity()` or `getUserId(ctx)`, then scope by `userId`. That proves identity and ownership, but not active product access. The playbook requires every protected product read/write to validate active entitlement for the requested `product_id`.

Impact: a signed-in user with no active product entitlement, or a revoked/free-default edge case, may still reach protected product data through direct Convex calls if the UI gate is bypassed.

Recommended fix: add a shared backend guard such as `requireReplayGlowzAccess(ctx)` and use it in protected Convex queries, mutations, and actions before product data access or YouTube quota spend. The guard should read a fresh/valid suite snapshot or a documented short-lived mirror and deny when unavailable, expired, missing, revoked, or inactive.

### High: Default free access needs a policy decision

`users:getProductAccessStatus` grants access when a user document exists and `productId === replayglowz`, with `reasonCode: default_free_entitlement`.

Impact: this can be compatible only if ReplayGlowz intentionally grants product-scoped free access by default. If not, it contradicts the doctrine that authentication must not grant product access by itself.

Recommended fix: decide whether `default_free_entitlement` is the canonical free-plan policy. If yes, make the suite ledger/verifier return that free entitlement or document it as an explicit product policy. If no, remove the fallback and require a suite-owned active snapshot.

### Medium: Product-local subscription table can confuse billing truth

The schema still has `subscriptions` with plan/status and Polar references. This may be a legacy product-plan table rather than the canonical entitlement ledger.

Impact: future work could accidentally treat `subscriptions` as entitlement truth and recreate a duplicate ledger.

Recommended fix: document `subscriptions` as feature/plan display cache or deprecate it behind suite entitlements. Do not add new billing-provider writes here unless a spec explicitly describes it as a temporary adapter with retirement.

### Medium: Feed import extension is ownership-safe but not entitlement-gated

The Feed extension paths recorded in `b7a08ee` are good on ownership boundaries: playlist-channel extraction reads only the current user's feed and caches, and the YouTube import/backfill actions use the current user's auth subject and OAuth token.

Impact: there is no cross-user data leak visible in this diff, but these are still protected product capabilities and YouTube quota spend. They should require active ReplayGlowz entitlement server-side.

Recommended fix: include `fetchYoutubeSubscriptions`, `backfillPlaylistVideoChannelMetadata`, and Feed source mutations/queries in the first entitlement guard rollout.

## Next Implementation Step

Create a small backend entitlement enforcement slice:

1. Add a shared Convex helper that validates authenticated identity plus active `replayglowz` access from `productAccessSnapshots`, with explicit revoked/expired/missing denial.
2. Apply it first to high-value protected paths: YouTube actions, Feed queries/mutations, notes, playlists, transcripts, settings, and token/cache mutation paths.
3. Add targeted tests or typecheck-backed fixtures for unauthenticated, missing entitlement, revoked entitlement, expired snapshot, active `replayglowz`, and legacy `tubeflow` compatibility if still retained.
4. Update `replayglowz_app/AGENT.md`, `CLAUDE.md`, and technical architecture docs once the server-side guard is real.
