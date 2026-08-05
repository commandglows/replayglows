---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: "replayglows"
created: "2026-07-16"
created_at: "2026-07-16 18:56:30 UTC"
updated: "2026-07-17"
updated_at: "2026-07-17 08:34:05 UTC"
status: ready
source_skill: 100-sg-spec
source_model: "GPT-5 Codex"
scope: "site-landing-narrative-copy-and-section-architecture"
owner: "Diane"
user_story: "As a ReplayGlows landing-page visitor, I want a clear learning-first story followed by scannable benefit and feature summaries, so I understand the product before pricing and can still explore its capabilities afterward."
confidence: "high"
risk_level: "medium"
security_impact: "none"
docs_impact: "yes"
linked_systems:
  - "site"
  - "English landing page"
  - "French landing page"
  - "Astro"
  - "Tailwind CSS"
  - "site design-system tokens"
depends_on:
  - artifact: "shipglows_data/technical/design-system-authority.md"
    artifact_version: "1.0.0"
    required_status: "draft"
  - artifact: "shipglows_data/branding/branding.md"
    artifact_version: "0.1.0"
    required_status: "draft"
  - artifact: "shipglows_data/product/site/product.md"
    artifact_version: "1.0.0"
    required_status: "reviewed"
  - artifact: "shipglows_data/gtm/site/gtm.md"
    artifact_version: "1.0.0"
    required_status: "reviewed"
  - artifact: "shipglows_data/technical/site/guidelines.md"
    artifact_version: "1.0.0"
    required_status: "reviewed"
supersedes:
  - artifact: "shipglows_data/workflow/specs/monorepo/replayglows-harmonize-landing-benefits-features-cards.md"
    artifact_version: "1.1.0"
evidence:
  - "Operator validated a learning-first promise with anti-distraction as a secondary benefit."
  - "Operator validated this sequence: narrative landing, pricing, primary CTA, then retained icon-based benefits and feature summaries."
  - "Operator selected the centered three-card row with large icons as the preferred visual grammar."
  - "Product contract positions ReplayGlows as a learning layer for video built around timestamped notes, organization, and retrieval."
  - "GTM contract requires the learning workflow to remain primary and algorithm-escape framing to remain subordinate."
next_step: "/103-sg-verify replayglows-landing-narrative-and-deep-dive"
---

# Title

Rebuild ReplayGlows Landing Narrative And Deep-Dive Flow

## Status

Implemented locally. The bilingual copywriting review gives every section a distinct persuasion role, and testimonial review text now uses operator-requested Lorem ipsum placeholders without changing identities, ratings, cards, or rail behavior. Pricing remains unchanged. Structural, claim-safety, pricing non-regression, production-build, rendered-order, and design-system checks pass; authoritative responsive and motion proof remains assigned to the matching Vercel preview.

## User Story

As a ReplayGlows landing-page visitor, I want a clear learning-first story followed by scannable benefit and feature summaries, so I understand the product before pricing and can still explore its capabilities afterward.

## Minimal Behavior Contract

When a visitor opens the English or French homepage, the page first explains how ReplayGlows turns YouTube viewing into reusable learning through organized videos, timestamped notes, and exact-context retrieval; it then answers the YouTube-plus-notes objection, presents the unchanged pricing, and offers a primary conversion CTA before revealing the retained icon-based benefit and feature summaries. If a claim is not supported by the product contract, it must be removed or made neutral instead of being strengthened. The easy-to-miss edge case is that the post-pricing summaries must deepen the story without restarting it or making the first CTA feel like the end of the page.

## Success Behavior

- The hero leads with learning and retrieval, while distraction reduction appears only as supporting context.
- The testimonial rail stays directly under the hero actions and keeps its current accessible horizontal motion behavior.
- Before pricing, visitors encounter one problem narrative, a centered three-step workflow with large icons, a concrete product-context proof section, and a YouTube-plus-notes comparison.
- Pricing keeps its existing plans, alignment, behavior, and component/markup structure.
- Immediately after pricing, a strong conversion CTA appears; retained Benefits and Features follow as a deeper scannable summary, then a short attention-control punchline and compact closing CTA finish the page.
- English and French remain aligned in meaning, section order, CTA destination, and visual grammar.
- Newsletter is removed from the homepage flow because it interrupts the product conversion narrative; blog/footer newsletter behavior is outside scope.
- Success is proven by source-scope checks, the Astro production build, the changed-file design-system drift scan, and later browser proof on the matching Vercel preview.

## Error Behavior

- Unsupported numeric trust, AI, security-certification, privacy, or broad sync claims are not added; existing unsupported claims encountered in sections being rewritten are replaced with product-contract-safe wording.
- If the new layout would require raw visual literals or arbitrary Tailwind values, implementation stops and uses the established token/component grammar instead.
- If EN/FR parity cannot be maintained, the chantier remains incomplete rather than shipping one locale with a materially different promise or order.
- If Pricing behavior or plan content changes in the final diff, verification fails and those changes must be removed.
- Build, drift-scan, or hosted browser-proof failures remain observable and block a verified/ship-ready claim.

## Problem

The current homepage presents several disconnected product stories: algorithm control, generic productivity, generic notes, and AI. Repeated card sections create volume but not progression, so visitors can scan features without understanding why ReplayGlows is a distinct learning workflow or why it is better than YouTube plus a separate notes app.

## Solution

Create a two-level homepage. The first level is a conversion narrative: learning-first hero, proof rail, problem, three-step workflow, concrete context proof, comparison, pricing, and primary CTA. The second level retains the strongest existing large-icon Benefits and Features grids as an optional deep dive, followed by a focused punchline and compact closing CTA.

## Scope In

- English and French homepage copy, section order, and navigation anchors.
- Learning-first Hero copy and safe social-proof label while preserving the testimonial rail component.
- A concise single problem narrative rather than a four-problem card grid.
- A centered three-step workflow row with large icons.
- A concrete product proof section for timestamped notes, organization, and exact-context retrieval.
- A side-by-side comparison between YouTube plus a notes app and ReplayGlows.
- Repositioning the existing Benefits and Features sections after Pricing and the first CTA.
- Rewriting Benefits/Features copy only where required to remove generic, AI, privacy-certification, or unsupported claims and reduce duplication.
- A post-feature attention-control punchline and compact final CTA.
- Operator-requested Lorem ipsum placeholder review text in both locales while preserving testimonial identities, ratings, cards, and rail behavior.
- Removal of Newsletter from the homepage assembly only.
- Shared Astro components or typed props when they reduce EN/FR structural drift without changing Pricing.

## Scope Out

- No changes to Pricing plans, prices, alignment, toggle behavior, markup contract, or conversion destination.
- No edits to testimonial identities or ratings; review text is explicitly non-final placeholder content.
- No changes to product app behavior, backend, authentication, data, entitlements, or APIs.
- No newsletter backend or blog/footer newsletter redesign.
- No new dependencies, image-generation assets, analytics, or form handling.
- No commit, push, preview, or production deployment without the separate ship workflow.

## Constraints

- `shipglows_data/product/app/product.md` is canonical product truth; the site and GTM contracts govern public framing.
- `site/src/styles/global.css` is the site design-system authority; use existing section spacing, typography, card, CTA, motion, and responsive utilities.
- Preserve the centered stacked card anatomy and large-icon rhythm already validated by the operator.
- Do not add raw colors, arbitrary Tailwind bracket values, new spacing literals, fixed card heights, or component-local animation timings.
- Preserve reduced-motion behavior, heading hierarchy, keyboard accessibility, testimonial pause behavior, and decorative-icon `aria-hidden` semantics.
- Keep CTA targets routed through `appSignInRedirectUrl('/videos')`.
- Keep French natural and accented; keep English/French meaning aligned rather than word-for-word literal.
- Do not create a parallel `shipglowz_data/` corpus; this repository explicitly uses `shipglows_data/`.

## Test Contract

- `surface`: Astro static marketing homepage, English `/` and French `/fr/`.
- `proof_profile`: evidence-first UI and public-copy change.
- `automated_proof`: `(cd site && npm run build)`, targeted source assertions, and the canonical site changed-file design-system drift scan.
- `browser_proof`: matching Vercel preview at 1440x1000, 768x900, and 390x844 for both locales.
- `proof_order`: source diff and claim/order assertions -> build -> drift scan -> `005-sg-ship` -> `405-sg-prod` target discovery -> `108-sg-browser` responsive/accessibility proof.
- `required_scenario_ids`: `FLOW-EN`, `FLOW-FR`, `PRICE-NR-EN`, `PRICE-NR-FR`, `RESP-EN`, `RESP-FR`, `MOTION-A11Y`.
- `required_results`: narrative order is correct, pricing is unchanged, testimonial rail remains operable, post-pricing deep dive is readable, no clipping/overflow, and EN/FR meaning stays aligned.
- `checklist_path`: not required; bounded source assertions plus preview screenshots/accessibility snapshots are sufficient.
- `exception_with_proof`: local browser proof is not authoritative because `CLAUDE.md` declares `vercel-preview-push`; local build and source checks prove implementation only.
- `hosted_follow_through`: proof type `preview/browser`; owner route `005-sg-ship -> 405-sg-prod -> 108-sg-browser`; target `matching Vercel preview URL, target discovery required`.

## Dependencies

- Astro 6 and Tailwind CSS 4 already installed in `site/`.
- Existing homepage components, `site/src/i18n/*`, `site/src/styles/global.css`, and `appSignInRedirectUrl`.
- Existing `.marketing-card`, CTA, reveal, and testimonial-rail primitives.
- Fresh external docs: not needed; the implementation reuses local static Astro/component behavior and introduces no framework or provider integration behavior.

## Invariants

- Pricing content and behavior remain unchanged.
- Testimonial identities and ratings remain unchanged; review text uses explicit Lorem ipsum placeholders, and the rail remains directly beneath the hero.
- All conversion links continue to use the canonical app URL helper.
- Canonical, `hreflang`, Open Graph, JSON-LD, and page-language metadata remain intact.
- The learning workflow is the primary promise; algorithm control is a secondary benefit.
- Benefits and Features remain centered icon-card grids rather than returning to asymmetric or mixed anatomy.
- No homepage section makes unsupported AI, certification, encryption, quantitative trust, or guaranteed cross-device claims.

## Links & Consequences

- English `/` is assembled from shared components, while French `/fr/` currently duplicates most sections inline; shared content components may be extended with locale props to reduce future drift.
- Navigation `#benefits`, `#features`, and `#pricing` anchors must continue to resolve after section movement.
- Removing Newsletter from homepage assembly shortens the primary funnel but does not delete the reusable Newsletter component.
- Existing reveal and marquee motion must continue to honor reduced-motion handling from `Layout.astro` and global tokens.
- The previous landing-card spec remains historical evidence for the centered-card decision but no longer owns page order or copy invariants.

## Documentation Coherence

The homepage itself is the public documentation surface being changed. No README, feature docs, pricing docs, or product behavior docs change because the implementation aligns the site to the already reviewed product and GTM contracts. This spec records the new public narrative and proof obligations.

### Copywriting Review — 2026-07-17

- Intended buyer: an individual who uses YouTube to learn, research, teach, or return to useful explanations and is frustrated by disconnected notes and lost source context.
- Funnel position: homepage bridge from problem-aware to solution-aware, with a product-led app CTA after mechanism, objection handling, and offer visibility.
- Awareness path: lost idea -> repeatable workflow -> timestamp/context mechanism -> YouTube-plus-notes objection -> Pricing -> action -> optional capability deep dive.
- Inspiration Gate: the private inspiration index was unavailable, so no external reference was selected or loaded; decisions use only ReplayGlows product, GTM, brand, and operator evidence.
- Persuasion grades: persona alignment `A`; value proposition `A`; persuasion structure `A`; objections `A`; emotional path `A-`; CTA strategy `A`; journey coherence `A`.
- Content-quality rubric: clarity `94`; structure `95`; source faithfulness `96`; compliance `94`; brand voice `93`; call to action `92`; weighted overall `94`; status `publishable with caveats`; confidence `0.90`.
- Caveat: existing AI and cross-device wording inside Pricing remains outside this chantier by explicit invariant and still requires separate proof review. Testimonial review text is intentionally non-final placeholder content.

#### Editorial Update Plan

- Changed behavior or source: operator-requested copywriting refinement grounded in reviewed site product/GTM contracts and the canonical app product contract.
- Impacted surface: English `/` and French `/fr/` homepage narrative, benefits/features summary, CTA copy, footer tagline, and homepage metadata.
- Source of truth: `shipglows_data/product/app/product.md`, `shipglows_data/product/site/product.md`, `shipglows_data/gtm/site/gtm.md`, and `shipglows_data/branding/branding.md`.
- Required action: update.
- Reason: remove repeated generic benefit language and assign one persuasion job to each section.
- Owner role: executor.
- Parallel-safe: no; English and French meaning must remain synchronized.
- Validation: bilingual rendered-heading review, claim scan, unchanged Pricing comparison, intentional testimonial-placeholder assertion, Astro build, and preview browser proof.
- Closure status: complete locally; preview proof remains pending under the parent spec.

#### Claim Impact Plan

- Changed claim: qualitative promise that ReplayGlows keeps YouTube videos, timestamped notes, and exact playback context connected for later retrieval.
- Surface: English and French homepages.
- Evidence checked: canonical app product contract, site product/GTM contracts, and editorial claim register.
- Status: supported.
- Required action: none for rewritten narrative sections; testimonial claims were removed through placeholders, while the separate proof caveat remains for untouched Pricing claims.

#### Documentation Update Plan

- Code changed: homepage locale copy and page metadata only.
- Subsystem: Astro public site.
- Primary technical doc: `shipglows_data/technical/site/architecture.md`.
- Secondary docs: this active spec.
- Required action: review primary doc; update this spec only.
- Priority: low.
- Reason: public wording and metadata changed, but product behavior, routing, APIs, build configuration, and component contracts did not.
- Owner role: executor.
- Parallel-safe: no.
- Notes: documentation coherence is complete in this spec.

## Edge Cases

- Long French copy must not make the three-step workflow or comparison unreadable at medium widths.
- The post-pricing CTA must not point to a later section as though it were the page ending; its secondary action may lead to the deeper feature summary.
- Moving `#benefits` and `#features` below Pricing must not break navbar anchor navigation.
- The comparison must stack into a clear single-column order on mobile and keep equivalent concepts adjacent on desktop.
- Decorative icons must remain hidden from assistive technology; headings and text must preserve meaningful reading order without them.
- Auto-moving testimonial content must remain focusable, pausable, and reduced-motion safe.
- Unsupported `2,000+` social proof must not remain in rewritten hero copy without proof.

## Implementation Tasks

- [x] Task 1: Make the shared narrative components accept locale-safe content.
  - Files: `site/src/components/Hero.astro`, `site/src/components/ProblemSection.astro`, `site/src/components/SolutionSection.astro`, `site/src/components/FinalCTA.astro`
  - Action: Replace hardcoded English narrative copy with typed/defaulted props while preserving the established visual and accessibility primitives.
  - User story link: Creates one coherent conversion narrative in both locales.
  - Depends on: None.
  - Validate with: Astro type/build check and source review for unchanged CTA targets and testimonial behavior.
- [x] Task 2: Add product-proof, comparison, attention punchline, and compact closing CTA components.
  - Files: new scoped components under `site/src/components/`
  - Action: Implement reusable locale-driven sections using only established card, typography, spacing, CTA, and responsive utility patterns.
  - User story link: Explains the differentiated workflow and objection before pricing, then closes the post-pricing deep dive.
  - Depends on: Task 1 patterns.
  - Validate with: Build, heading/order assertions, and design-system drift scan.
- [x] Task 3: Align safe bilingual copy with product and GTM truth.
  - Files: `site/src/i18n/en.ts`, `site/src/i18n/fr.ts`, and existing Benefits/Features component data owners as needed.
  - Action: Add the approved learning-first narrative and replace unsupported generic/AI/security claims in rewritten homepage sections with concrete product-safe benefits and features.
  - User story link: Makes the product understandable and credible without losing punchlines or scan value.
  - Depends on: Product/GTM contracts.
  - Validate with: Targeted claim scan for AI, SOC2, E2E, numeric trust, and unsupported guarantees in homepage-owned copy.
- [x] Task 4: Reassemble English and French homepage order.
  - Files: `site/src/pages/index.astro`, `site/src/pages/fr/index.astro`
  - Action: Render narrative sections before Pricing; keep Pricing untouched; render the first CTA, Benefits, Features, punchline, and compact final CTA afterward; remove Newsletter from homepage assembly.
  - User story link: Delivers the validated two-level reading flow.
  - Depends on: Tasks 1-3.
  - Validate with: Source-order assertions, anchor scan, build, and pricing non-regression diff.
- [x] Task 5: Prove local implementation and route hosted proof.
  - Files: changed site sources and this spec.
  - Action: Run source assertions, production build, changed-file design drift scan, update chantier history, and route preview scenarios without pushing from `102-sg-start`.
  - User story link: Demonstrates the full narrative exists without collateral pricing or design-system drift.
  - Depends on: Tasks 1-4.
  - Validate with: Commands in `Test Contract`.

## Acceptance Criteria

- [x] CA 1: Given either homepage locale, when the page loads, then the hero promises learning and retrieval first and presents anti-distraction only as supporting context.
- [x] CA 2: Given the hero, when its social-proof area renders, then testimonials appear directly below the CTA row in the existing accessible horizontal rail and no unsupported numeric trust count is introduced by this chantier.
- [x] CA 3: Given a visitor scrolls before Pricing, when they read the narrative, then they encounter the problem, three-step workflow, product-context proof, and YouTube-plus-notes comparison exactly once and in that order.
- [x] CA 4: Given the Pricing section, when compared to its pre-implementation source and behavior, then plans, prices, copy, alignment, toggle, CTA, and card structure are unchanged.
- [x] CA 5: Given a visitor continues after Pricing, when the first CTA ends, then Benefits and Features appear as centered large-icon summary grids followed by one attention-control punchline and a compact closing CTA.
- [x] CA 6: Given English and French source content, when corresponding sections are compared, then they convey the same product promise, order, benefits, and CTA intent with natural locale wording.
- [x] CA 7: Given homepage-owned copy, when scanned for unsupported claims, then no numeric trust, AI automation, SOC2, E2E, guaranteed sync, or broad privacy certification claim remains in sections rewritten by this chantier.
- [ ] CA 8: Given desktop, medium, and mobile preview widths, when the new sections render, then cards and comparison layouts reflow without horizontal overflow, clipped copy, or broken heading order.
- [ ] CA 9: Given reduced motion or keyboard navigation, when visitors interact with the page, then reveal/marquee behavior remains reduced-motion safe and the testimonial rail remains focusable and pausable.
- [x] CA 10: Given the final implementation, when `pnpm build` and the changed-file drift scan run, then the site builds and no new unexplained visual literal is reported.

## Test Strategy

1. Diff the homepage/component/i18n scope and confirm Pricing sources/regions are unchanged.
2. Assert section order and unique IDs in both locale sources.
3. Scan homepage-owned copy for `2,000`, `AI`, `SOC2`, `E2E`, and unsupported guarantee language; assert testimonial review text is placeholder-only and classify unavoidable Pricing occurrences as out of this chantier.
4. Run `(cd site && pnpm build)`.
5. Run `python3 /home/claude/shipglowz/tools/design_system_drift_check.py --root /home/claude/replayglows/site --changed --format markdown --max-findings 5000` after canonical tool preflight.
6. After authorized ship and target discovery, run `108-sg-browser` at the required desktop, medium, and mobile viewports for `/` and `/fr/`, including accessibility/reduced-motion inspection.

## Risks

- Medium: copy changes can accidentally strengthen unsupported claims; targeted scans and product-contract review mitigate this.
- Medium: keeping Benefits and Features after a strong CTA can make the page feel finished too early; transition copy and a compact final CTA mitigate this.
- Medium: English shared components and French inline assembly can drift; locale-driven props for narrative components reduce that risk.
- Low: homepage becomes longer; the first conversion story stays concise, and the post-pricing layer is intentionally optional/scannable.
- Low: anchor movement can surprise users but remains valid because IDs are preserved.
- Security impact: none, because this is static public presentation with no auth, data, form submission, API, or permission behavior.

## Execution Notes

- Read first: `site/AGENT.md`, `CLAUDE.md`, `shipglows_data/technical/design-system-authority.md`, product/GTM contracts, current homepage components, both locale files, and both homepage entrypoints.
- Implementation order: typed narrative props -> new shared sections -> safe bilingual copy -> EN assembly -> FR assembly -> source assertions -> build -> drift scan.
- Reuse `.marketing-card`, existing reveal classes, existing section spacing, current CTA classes, and current responsive grid utilities; do not add packages or new animation primitives.
- Preserve `Pricing.astro` byte-for-byte and preserve the French inline Pricing region structurally and textually.
- Preserve testimonial identities, ratings, card structure, and rail behavior; review text is deliberately placeholder-only until final proof-backed testimonials are supplied.
- Stop if implementation needs new raw design literals, changes Pricing, cannot keep locale parity, or exposes a claim that product contracts do not support.
- Development mode is `vercel-preview-push`: local static proof is implementation evidence only; authoritative browser proof routes through `005-sg-ship -> 405-sg-prod -> 108-sg-browser`.
- Fresh external docs verdict: not needed; no external framework/provider behavior changes.

## Open Questions

None. The operator approved the learning-first plus anti-distraction hybrid positioning, the two-level page order, retention of icon/punchline sections after Pricing, and implementation.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-07-16 18:56:30 UTC | 100-sg-spec | GPT-5 Codex | Converted the operator-approved landing narrative, section order, retained deep-dive blocks, claim boundaries, and proof route into a durable implementation contract. | Draft created. | `/101-sg-ready replayglows-landing-narrative-and-deep-dive` |
| 2026-07-16 18:58:13 UTC | 101-sg-ready | GPT-5 Codex | Reviewed user-story fit, mandatory structure, product truth, claim boundaries, locale parity, pricing non-regression, accessibility, design-system authority, edge cases, and hosted proof routing. | Ready. | `/102-sg-start replayglows-landing-narrative-and-deep-dive` |
| 2026-07-16 19:07:51 UTC | 102-sg-start | GPT-5 Codex | Implemented the bilingual learning-first narrative, product proof, comparison, post-pricing deep dive, shared locale-driven components, and homepage newsletter removal while preserving Pricing and testimonial content. Ran rendered-order assertions, Pricing source comparison, Astro build, metadata lint, and design drift checks. | Implemented locally; preview responsive and motion proof remains pending. | `/103-sg-verify replayglows-landing-narrative-and-deep-dive` |
| 2026-07-16 19:13:39 UTC | 106-sg-fix | GPT-5 Codex | Diagnosed and repaired the testimonial rail's finite native-scroll endpoint by using one scroll coordinate system, triple buffering, and bidirectional position normalization. | Fix attempted locally; build and static checks pass, but preview interaction retest remains required. | `/005-sg-ship -> /405-sg-prod -> /107-sg-test --preview --retest BUG-2026-07-16-001` |
| 2026-07-17 08:00:06 UTC | 103-sg-verify | GPT-5 Codex | Exercised the testimonial rail in local development and compiled-preview browsers at mobile, medium, and desktop widths across both locales; then strengthened animation scheduling, focus handling, and duplicate accessibility isolation and reran focused scenarios. | Partial: local browser, build, metadata, and design-system evidence pass; the declared development mode still requires matching Vercel preview proof for a verified verdict. | `/005-sg-ship -> /405-sg-prod -> /108-sg-browser` |
| 2026-07-17 08:25:06 UTC | 009-sg-marketing | GPT-5 Codex | Audited persona fit, value proposition, persuasion sequence, objections, CTA strategy, claim safety, and bilingual journey coherence; rewrote the homepage narrative and metadata so each section has one distinct role while preserving Pricing and testimonial content. | Copywriting remediated locally; rubric 94/100, build/static proof and six local responsive browser scenarios pass; matching preview proof remains pending. | `/103-sg-verify replayglows-landing-narrative-and-deep-dive` |
| 2026-07-17 08:34:05 UTC | 007-sg-content | GPT-5 Codex | Routed and applied the operator-requested public testimonial placeholder update across both homepage locales. | Implemented locally; testimonial identities, ratings, cards, and rail behavior preserved. | `/103-sg-verify replayglows-landing-narrative-and-deep-dive` |
| 2026-07-17 08:34:05 UTC | 201-sg-enrich | GPT-5 Codex | Replaced the three testimonial review claims with matching Lorem ipsum placeholder copy in English and French. | Placeholder content applied; final testimonial copy remains intentionally unresolved. | `/103-sg-verify replayglows-landing-narrative-and-deep-dive` |

## Current Chantier Flow

| Step | Status | Notes |
|------|--------|-------|
| 100-sg-spec | done | Spec created from the validated copy and architecture decisions. |
| 101-sg-ready | ready | Structural, adversarial, security, design-system, and proof-contract review passed. |
| 102-sg-start | implemented | EN/FR narrative and deep-dive flow complete; local build, scope, claim, pricing, metadata, and drift evidence pass. |
| 106-sg-fix | fix attempted | Testimonial rail loop repaired locally; hosted manual-scroll retest remains pending. |
| 103-sg-verify | partial | Testimonial loop behavior passes local browser checks at 1440, 768, and 390 pixels; full landing responsive and motion proof remains preview-dependent. |
| 009-sg-marketing | remediated | Bilingual persuasion sequence, section roles, CTAs, and homepage metadata improved; six local responsive copy-rendering scenarios pass and the existing Pricing proof caveat remains explicitly out of scope. |
| 007-sg-content | implemented | Testimonial review claims replaced by explicit bilingual Lorem ipsum placeholders. |
| 201-sg-enrich | implemented | Placeholder text applied without changing testimonial identities, ratings, cards, or rail behavior. |
| 104-sg-end | not started | Closure not started. |
| 005-sg-ship | not started | No commit or push authorized in this workflow. |

Next command: `/103-sg-verify replayglows-landing-narrative-and-deep-dive`; hosted proof then routes through `/005-sg-ship`, `/405-sg-prod`, and `/108-sg-browser`.
