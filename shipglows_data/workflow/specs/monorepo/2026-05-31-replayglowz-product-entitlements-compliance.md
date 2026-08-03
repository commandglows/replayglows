---
artifact: audit
metadata_schema_version: "1.0"
artifact_version: "1.1.0"
project: "replayglowz"
created: "2026-05-31"
updated: "2026-06-10"
status: active
source_skill: sf-verify
scope: "product-entitlements-compliance"
owner: "Diane"
confidence: "medium"
risk_level: "high"
security_impact: "yes"
docs_impact: "yes"
linked_systems:
  - "app"
  - "backend"
  - "/home/claude/shipglows/skills/references/product-entitlements-playbook.md"
depends_on:
  - artifact: "/home/claude/shipglows/skills/references/product-entitlements-playbook.md"
    artifact_version: "1.0.1"
    required_status: "active"
supersedes: []
evidence:
  - "Latest reviewed commit: b7a08ee2ec19adb367f2d42793fc8c899bf3c88c, record feed import extension verification."
  - "Commit b7a08ee updates only the Feed source discovery spec and checklist; it records extension verification for subscription import and playlist channel metadata backfill."
  - "2026-06-10 correction: remaining YouTube actions, channel sync actions, and private subscription queries/mutations now call requireReplayGlowzAccess(ctx)."
next_step: "Decide and document whether default_free_entitlement remains a canonical suite-backed free access policy, then retire or demote product-local subscription billing truth."
---

# Audit: ReplayGlowz Product Entitlements Compliance

## Verdict

ReplayGlowz is materially closer to the product entitlements doctrine, but not fully compliant yet.

The architecture correctly separates identity from product access in documentation, in the YouTube OAuth Vercel handlers, and now in the reviewed high-value Convex product paths. The app also has a fail-closed client-visible product access status provider. The main remaining compliance questions are product policy and ledger ownership: recognized ReplayGlowz accounts still receive server-created default free access snapshots, and the local `subscriptions` table can still be mistaken for billing entitlement truth if future work builds on it.

## Doctrine Checklist

| Doctrine point | Status | Evidence | Gap |
|---|---:|---|---|
| Identity is separate from product access | partial | `users:getProductAccessStatus` distinguishes unauthenticated, account recognized, active, revoked, and missing entitlement states. | Recognized ReplayGlowz accounts still default to free access in product backend status. |
| Suite ledger is canonical | partial | `productAccessSnapshots` are clearly snapshots with `source: suite | legacy`, `globalUserId`, `productId`, status, and expiry. | Product backend still has local `subscriptions` and default free access semantics that can be confused with entitlement truth. |
| Fail closed when entitlement lookup fails | partial | Flutter `productAccessStatusProvider` denies access on missing status function, unauthorized errors, and generic failures; protected backend paths use `requireReplayGlowzAccess(ctx)`. | The default-free snapshot policy still grants access for recognized users unless explicitly revoked. |
| Protected reads/writes validate entitlement | partial | YouTube OAuth start/callback verifies suite entitlement server-side; reviewed Convex product paths use `requireReplayGlowzAccess(ctx)`. | Continue requiring the guard for any newly added protected product function; keep feedback/public plan surfaces intentionally separate. |
| Provider events are not runtime source of truth | pass for reviewed surface | OAuth uses YouTube as a permission/data provider, not as product authorization. | Billing/provider ingestion was not in scope of this repo audit. |
| Client-provided entitlement data is not trusted | partial | Product access status is queried from Convex; OAuth server handlers verify with suite bridge and secret. | Convex product functions need centralized enforcement so a client cannot bypass the UI status by calling functions directly. |

## Latest Commit Impact

Reviewed commit: `b7a08ee2ec19adb367f2d42793fc8c899bf3c88c`.

Files changed:

- `shipglows_data/workflow/specs/replayglowz-feed-source-discovery-playlist-channel-expansion.md`
- `shipglows_data/workflow/test-checklists/replayglowz-feed-source-discovery-playlist-channel-expansion.md`

Security/compliance impact:

- No code changed in this commit.
- The commit records that the Feed extension was shipped and verified.
- The recorded extension covers two code paths that matter for entitlement compliance: explicit subscription import via `subscriptions.list`, and explicit playlist channel metadata backfill via `videos.list`.
- The extension does not add a new entitlement model or a local entitlement ledger.
- This gap was corrected on 2026-06-10 for the reviewed Feed extension paths: `fetchYoutubeSubscriptions`, `backfillPlaylistVideoChannelMetadata`, broader YouTube actions, channel sync actions, and private subscription helpers now use `requireReplayGlowzAccess(ctx)`.

## Evidence Notes

- `backend/packages/backend/convex/access.ts` owns `requireReplayGlowzAccess(ctx)`, product-id matching, revoked/expired denial, and default-free snapshot creation.
- `backend/packages/backend/convex/users.ts:30` exposes product access status from server state.
- `backend/packages/backend/convex/schema.ts:170` defines `productAccessSnapshots`, which looks like a product-local mirror/cache rather than a durable canonical ledger.
- `app/lib/providers/providers.dart:756` makes the UI product access provider fail closed on backend errors.
- `backend/packages/backend/convex/youtube.ts` now gates user-facing YouTube actions with `requireReplayGlowzAccess(ctx)`, including subscription import and playlist channel metadata backfill.
- `backend/packages/backend/convex/channelLinks.ts` now gates channel sync actions with `requireReplayGlowzAccess(ctx)`.
- `backend/packages/backend/convex/subscriptions.ts` now gates private subscription status, limits, checkout identity, and cancellation helpers with `requireReplayGlowzAccess(ctx)`.
- `backend/packages/backend/convex/virtualFeeds.ts:607` scopes playlist-channel candidate extraction to the authenticated user's feed, playlist cache, channel cache, and sources.

## Findings

### High: Default free access needs a policy decision

`access.ts` creates/extends a server-owned `productAccessSnapshots` row with `reasonCode=default_free_entitlement` for recognized users, unless a revoked snapshot exists.

Impact: this can be compatible only if ReplayGlowz intentionally grants product-scoped free access by default. If not, it contradicts the doctrine that authentication must not grant product access by itself.

Recommended fix: decide whether `default_free_entitlement` is the canonical free-plan policy. If yes, make the suite ledger/verifier return that free entitlement or document it as an explicit product policy. If no, remove the fallback and require a suite-owned active snapshot.

### Medium: Product-local subscription table can confuse billing truth

The schema still has `subscriptions` with plan/status and Polar references. This may be a legacy product-plan table rather than the canonical entitlement ledger.

Impact: future work could accidentally treat `subscriptions` as entitlement truth and recreate a duplicate ledger.

Recommended fix: document `subscriptions` as feature/plan display cache or deprecate it behind suite entitlements. Do not add new billing-provider writes here unless a spec explicitly describes it as a temporary adapter with retirement.

### Medium: Protected product guard rollout must stay enforced for new functions

The previous audit identified product actions that authenticated the Clerk user but did not prove active ReplayGlowz access. The reviewed high-value paths have now been changed to call `requireReplayGlowzAccess(ctx)`.

Impact: the immediate Feed/YouTube quota-spend gap is closed, but future functions can reintroduce the same class of bug if they use raw `ctx.auth.getUserIdentity()` or `getUserId(ctx)` for protected product data.

Recommended fix: keep `requireReplayGlowzAccess(ctx)` as the default entrypoint for protected product queries, mutations, and actions. Reserve raw identity reads for access helpers, bootstrap/status functions, admin/support public surfaces, and intentionally public feedback surfaces.

## 2026-06-10 Correction

Files changed:

- `backend/packages/backend/convex/youtube.ts`
- `backend/packages/backend/convex/channelLinks.ts`
- `backend/packages/backend/convex/subscriptions.ts`

What changed:

- Replaced remaining user-facing YouTube action auth-only blocks with `requireReplayGlowzAccess(ctx)`.
- Replaced channel sync action auth-only blocks with `requireReplayGlowzAccess(ctx)`.
- Replaced private subscription status/limit/cancel/checkout identity helpers with `requireReplayGlowzAccess(ctx)`.
- Kept `getPlans` public.
- Kept raw identity usage in access helpers, user bootstrap/status functions, and feedback/admin lookup surfaces.

Proof:

- `(cd backend/packages/backend && npm run typecheck)` passed after installing backend dependencies with `npm ci`.
- `git diff --check` passed.
- Residual `ctx.auth.getUserIdentity()` / `getUserId(ctx)` scan shows only `access.ts`, `utils.ts`, `users.ts`, and `feedback.ts`, which are access/bootstrap/status/public-feedback surfaces rather than protected product data paths.

## Next Implementation Step

Decide and document the remaining policy boundary:

1. If ReplayGlowz free access is intentional, make `default_free_entitlement` an explicit suite/product policy and ensure support docs know revoked snapshots override it.
2. If free access is not intentional, remove default-free snapshot creation and require a suite-owned active snapshot.
3. Demote or document `subscriptions` as plan/feature display cache, not entitlement truth.
