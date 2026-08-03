---
artifact: spec
metadata_schema_version: "1.0"
artifact_version: "1.1.0"
project: "replayglowz"
created: "2026-07-16"
created_at: "2026-07-16 12:57:58 UTC"
updated: "2026-07-16"
updated_at: "2026-07-16 13:16:22 UTC"
status: ready
source_skill: 100-sg-spec
source_model: "GPT-5 Codex"
scope: "site-landing-benefits-features-card-harmonization"
owner: "Diane"
user_story: "As a ReplayGlowz landing-page visitor, I want the Benefits and Features cards to follow the same centered, scannable visual grammar as the Solution cards, so the page feels coherent without changing its content, testimonials, or pricing presentation."
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
  - artifact: "shipglows_data/technical/site/guidelines.md"
    artifact_version: "1.0.0"
    required_status: "reviewed"
supersedes: []
evidence:
  - "Operator decision on 2026-07-16: use the centered Solution-card direction, but do not touch Testimonials or Pricing."
  - "Source audit: Benefits uses horizontal small-icon cards while Features uses an asymmetric bento layout; Solution uses centered stacked cards with large icons."
  - "Local browser evidence at 1440x1000 and 390x844 confirmed the anatomy drift and the readability of the Solution pattern."
  - "Repository contract: `site/AGENT.md` requires intentional English/French parity and identifies the duplicated French landing as a drift risk."
next_step: "/005-sg-ship replayglowz landing cards, then /405-sg-prod and /108-sg-browser"
---

# Title

Harmonize ReplayGlowz Landing Benefits And Features Cards

## Status

Implemented locally. Verification is partial until the matching Vercel preview is shipped, discovered, and checked in a browser.

## User Story

As a ReplayGlowz landing-page visitor, I want the Benefits and Features cards to follow the same centered, scannable visual grammar as the Solution cards, so the page feels coherent without changing its content, testimonials, or pricing presentation.

## Minimal Behavior Contract

When a visitor opens the English or French landing page, the Benefits and Features sections render regular responsive grids whose cards follow the existing Solution rhythm of a large decorative icon, title, description, and any secondary label stacked and centered. If the intended layout cannot be produced without new raw visual literals or content changes, the implementation must stop rather than create a one-off style. The easy-to-miss edge case is locale parity: the componentized English landing and inline French landing must express the same anatomy while Testimonials and Pricing remain exactly outside the change.

## Success Behavior

- On desktop, Benefits forms a regular grid with four equal card positions only when the viewport has enough room; Features forms two regular rows of three cards.
- On medium widths, both sections reflow to two columns, and on mobile they reflow to one column.
- Every Benefits and Features card uses the established stacked order: large icon, title, description, then the existing tag or badges when present.
- Existing copy, tags, badges, section order, background alternation, links, metadata, Testimonials, and Pricing remain unchanged.
- English and French render the same card anatomy and responsive behavior.
- Success is proven by the Astro production build, design-system drift scan, source-diff review, and local browser screenshots at desktop and mobile widths for both locales.

## Error Behavior

- If a new layout value cannot resolve through the existing design-system authority or established Solution utilities, no raw literal or arbitrary Tailwind value is added; implementation stops for design-system review.
- If EN/FR parity cannot be achieved without changing copy or claims, implementation stops and reports the mismatch instead of rewriting content.
- If Testimonials or Pricing change in the final diff or rendered DOM, verification fails and the out-of-scope change must be removed while preserving unrelated pre-existing user changes.
- Build, drift-scan, or browser-proof failures leave the chantier incomplete and unshipped.

## Problem

The landing already shares card chrome through `.marketing-card`, but Benefits switches to a horizontal small-icon anatomy and Features switches again to an asymmetric bento anatomy. This weakens the coherent scan rhythm established by the centered Solution cards.

## Solution

Reuse the Solution section's existing centered stacked card grammar for Benefits and Features only. Normalize their grids, promote existing or newly mapped decorative emojis to the same large-icon role, retain every text string and secondary label, and use existing design tokens and utility patterns without introducing raw visual values.

## Scope In

- English Benefits layout in `site/src/components/Benefits.astro`.
- English Features layout in `site/src/components/BentoGrid.astro`.
- French Benefits and Features rendering in `site/src/pages/fr/index.astro`.
- French feature icon data in `site/src/i18n/fr.ts` when needed for parity.
- Existing centralized styles in `site/src/styles/global.css` only if a reusable semantic card variant is strictly required; prefer the already established Solution utility composition.
- Responsive and accessible presentation at desktop, medium, and mobile widths.

## Scope Out

- No changes to Testimonials or Pricing, including their data, classes, alignment, layout, and copy.
- No changes to Hero, Problem, Solution, Final CTA, Newsletter, Navbar, Footer, SEO metadata, routes, or conversion links.
- No copy edits, claim strengthening, translation rewrites, product behavior changes, or pricing changes.
- No broad French/English component extraction or landing-page architecture refactor.
- No commit, push, Vercel preview, or production deployment without separate operator authorization.

## Constraints

- `site/src/styles/global.css` is the site design-system authority.
- Reuse the existing Solution classes and semantic tokens; do not add raw colors, dimensions, spacing, breakpoints, shadows, or arbitrary Tailwind bracket utilities.
- Preserve unrelated dirty changes already present in the Navbar and the French page header.
- Decorative emoji icons must be hidden from assistive technology when the adjacent title carries the same meaning.
- Keep the page content-first, study-oriented, and legible rather than decorative or generic SaaS-like.
- Repository-specific governance remains under `shipglows_data/`; do not create a parallel `shipglowz_data/` corpus.

## Test Contract

- `surface`: Astro static marketing landing, English `/` and French `/fr/`.
- `proof_profile`: evidence-first UI change.
- `automated_proof`: `(cd site && npm run build)` and the canonical site design-system drift scan.
- `browser_proof`: Playwright snapshots/screenshots on the matching Vercel preview for `/` and `/fr/` at 1440x1000, 768x900, and 390x844.
- `proof_order`: source diff and scope check -> build -> drift scan -> `005-sg-ship` -> `405-sg-prod` target discovery -> `108-sg-browser` desktop/medium/mobile -> final contract verification.
- `required_scenario_ids`: `LG-EN`, `LG-FR`, `MD-EN`, `MD-FR`, `SM-EN`, `SM-FR`, `SCOPE-NR`.
- `required_results`: regular grids, centered stacked anatomy, no clipping or horizontal overflow, content parity, and no Testimonials/Pricing change.
- `checklist_path`: not required; bounded preview screenshots and source-diff evidence are sufficient proof.
- `exception_with_proof`: local browser proof is intentionally not used because `CLAUDE.md` declares `vercel-preview-push`; static build and source checks prove local implementation while hosted visual proof remains required.
- `hosted_follow_through`: proof type `preview/browser`; owner route `005-sg-ship -> 405-sg-prod -> 108-sg-browser`; scenarios `LG-EN`, `LG-FR`, `MD-EN`, `MD-FR`, `SM-EN`, `SM-FR`; target `matching Vercel preview URL, target discovery required`.

## Dependencies

- Astro 6 and Tailwind CSS 4 as already installed by the site.
- `site/src/styles/global.css` and `.marketing-card` as the canonical style carrier.
- `site/src/components/SolutionSection.astro` and the inline French Solution section as the visual reference.
- `site/src/i18n/fr.ts` as the French landing content source.
- Fresh external docs: not needed; the work reuses local markup, existing utilities, and established project behavior.

## Invariants

- All text strings and their locale meanings remain unchanged.
- Testimonials and Pricing remain byte-for-byte untouched in component sources and structurally untouched in the French page.
- Existing public URLs, conversion paths, canonical metadata, and section order do not change.
- Background alternation and shared `.marketing-card` chrome remain intact.
- Mobile remains a single readable column with no horizontal overflow.

## Links & Consequences

- The English landing consumes `Benefits.astro` and `BentoGrid.astro` from `site/src/pages/index.astro`.
- The French landing duplicates the two sections inline, so both surfaces must be updated in the same implementation batch.
- Removing bento-only previews also removes their decorative animation script when no longer consumed; this is a presentation simplification, not a content change.
- Product claims are preserved but not revalidated or strengthened by this design chantier.
- Hosted truth remains a later release proof because the repository requires Vercel preview validation after push.

## Documentation Coherence

No public documentation or copy update is required because product behavior, claims, routes, and wording do not change. This spec and its verification evidence are the only documentation changes required for the local chantier.

## Edge Cases

- Long French descriptions must remain readable in four-up layouts; Benefits uses four columns only at the wide breakpoint and two columns below it.
- Feature tags and privacy badges must stay inside the centered card and must not force horizontal overflow.
- Cards with different text lengths must stretch consistently without fixed raw heights.
- Decorative emojis must not be announced redundantly by screen readers.
- The pre-existing `whitespace-nowrap` Navbar edits must survive untouched even though `site/src/pages/fr/index.astro` is also a target file.

## Implementation Tasks

- [x] Task 1: Normalize the English Benefits card anatomy and grid.
  - File: `site/src/components/Benefits.astro`
  - Action: Reuse the Solution stacked centered anatomy, hide decorative icons from assistive technology, and use a responsive one/two/four-column grid.
  - User story link: Establishes a coherent scan rhythm in Benefits.
  - Depends on: None.
  - Validate with: Astro build plus desktop/mobile browser proof for `/`.
- [x] Task 2: Replace the English Features bento anatomy with regular centered cards.
  - File: `site/src/components/BentoGrid.astro`
  - Action: Remove the wide-card span and decorative previews/animation, map a large icon to each existing feature, preserve descriptions and tags/badges, and render a one/two/three-column grid with consistent flex anatomy.
  - User story link: Removes the largest visual-system divergence after Solution.
  - Depends on: Task 1 pattern.
  - Validate with: Astro build, drift scan, and desktop/mobile browser proof for `/`.
- [x] Task 3: Apply the same Benefits and Features anatomy to the French landing.
  - Files: `site/src/pages/fr/index.astro`, `site/src/i18n/fr.ts`
  - Action: Mirror the approved grids and card anatomy, add decorative feature-icon mappings without changing copy, and preserve the existing Navbar change plus all Testimonials/Pricing markup.
  - User story link: Prevents locale-specific design drift.
  - Depends on: Tasks 1-2.
  - Validate with: Source-diff scope review and desktop/mobile browser proof for `/fr/`.
- [ ] Task 4: Prove scope and design-system compliance.
  - Files: changed site files and this spec.
  - Action: Run build and drift checks, capture four browser scenarios, inspect Testimonials/Pricing non-regression, and record results in `Skill Run History` and `Current Chantier Flow`.
  - User story link: Demonstrates coherent design without collateral changes.
  - Depends on: Tasks 1-3.
  - Validate with: Commands and scenarios in `Test Contract`.

## Acceptance Criteria

- [ ] CA 1: Given the English landing at 1440x1000, when Benefits and Features render, then Benefits uses four regular centered cards and Features uses six regular centered cards in two rows of three.
- [ ] CA 2: Given the French landing at 1440x1000, when the same sections render, then their anatomy and responsive grid match the English implementation without copy changes.
- [ ] CA 2a: Given either locale at 768x900, when Benefits and Features render, then both sections use two regular columns without clipping or horizontal overflow.
- [ ] CA 3: Given either locale at 390x844, when the visitor scrolls through Benefits and Features, then cards form one readable column with no horizontal overflow or clipped tags/badges.
- [x] CA 4: Given any changed card, when inspected structurally, then its large decorative icon precedes the centered title, description, and existing secondary content, and the icon is hidden from assistive technology.
- [x] CA 5: Given the final source diff, when Testimonials and Pricing are compared with their pre-implementation state, then this chantier introduces no modification to them.
- [x] CA 6: Given the final source diff, when visual literals are scanned, then no new unexplained literal, arbitrary Tailwind utility, color, breakpoint, or fixed card height has been introduced.
- [x] CA 7: Given the site production build, when `npm run build` completes, then both locale routes build successfully.
- [x] CA 8: Given the current dirty worktree, when the chantier completes, then the pre-existing Navbar `whitespace-nowrap` edits remain preserved and excluded from this chantier's claimed changes.

## Test Strategy

1. Inspect the scoped diff and explicitly compare Testimonials/Pricing source regions.
2. Run `(cd site && npm run build)`.
3. Run `/home/claude/shipglows/tools/design_system_drift_check.py --root /home/claude/replayglowz/site --changed --format markdown --max-findings 5000`; any new unexplained visual literal fails the check.
4. After authorized ship and Vercel target discovery, capture Playwright snapshot plus screenshot on the matching preview for `LG-EN`, `LG-FR`, `MD-EN`, `MD-FR`, `SM-EN`, and `SM-FR`.
5. Check document overflow and card alignment at each viewport; inspect the accessibility snapshot for headings, text order, and absence of redundant emoji names.
6. Do not claim authoritative visual verification until the matching Vercel preview scenarios pass.

## Risks

- Medium: the English and French pages use different composition strategies and can drift.
- Medium: long translated copy can make a four-column Benefits grid too dense; the wide-only breakpoint mitigates this.
- Low: removing decorative bento previews can leave dead script or style hooks if cleanup is incomplete.
- Low: emoji rendering varies by platform; this is accepted because the operator selected the existing Solution direction.
- Security impact: none, because this is static presentation work with no auth, data, form submission, API, or permission changes.

## Execution Notes

- Read first: `site/AGENT.md`, `CLAUDE.md`, `shipglows_data/technical/design-system-authority.md`, `site/src/components/SolutionSection.astro`, then the three target implementation files.
- Implementation order: English Benefits -> English Features -> French parity -> checks -> browser proof -> contract verification.
- Prefer established Solution utility composition over a new abstraction; add a semantic global variant only if repeated markup cannot remain coherent without it.
- Do not introduce packages, inline styles, arbitrary Tailwind values, fixed heights, or a broad shared-component refactor.
- Stop if copy must change, Testimonials/Pricing would need modification, a new raw visual token is required, or unrelated dirty changes overlap the target sections.
- Repository path note: this monorepo's explicit guidance and existing corpus use `shipglows_data/`; do not follow the generic `shipglowz_data/` naming when it would create a duplicate corpus.

## Open Questions

None. The operator explicitly approved the centered Solution direction and excluded Testimonials and Pricing.

## Skill Run History

| Date UTC | Skill | Model | Action | Result | Next step |
|----------|-------|-------|--------|--------|-----------|
| 2026-07-16 12:57:58 UTC | 100-sg-spec | GPT-5 Codex | Created a bounded implementation contract from the approved design audit and scope reduction. | Draft created. | `/101-sg-ready replayglowz-harmonize-landing-benefits-features-cards` |
| 2026-07-16 13:02:18 UTC | 101-sg-ready | GPT-5 Codex | Reviewed structure, user-story fit, adversarial scope, security, design-system authority, and proof coverage; added the missing medium-width scenarios and canonical changed-file drift check. | Ready. | `/102-sg-start replayglowz-harmonize-landing-benefits-features-cards` |
| 2026-07-16 13:09:54 UTC | 102-sg-start | GPT-5 Codex | Harmonized Benefits and Features in EN/FR, removed the bento-only previews and animation, preserved copy and excluded sections, then ran the site build, diff check, and changed-file drift scan. | Implemented locally; hosted preview proof remains unauthorized and pending. | `/103-sg-verify replayglowz-harmonize-landing-benefits-features-cards` |
| 2026-07-16 13:16:22 UTC | 103-sg-verify | GPT-5 Codex | Verified the source contract, build, metadata, excluded-section scope, CSS cleanup, accessibility structure, and zero changed-file design drift; corrected the proof route to match the repository preview-push policy. | Partial: implementation is locally proven, but the required preview browser scenarios are not authorized or run. | `/005-sg-ship replayglowz landing cards, then /405-sg-prod and /108-sg-browser` |
| 2026-07-16 13:16:22 UTC | 006-sg-design | GPT-5 Codex | Piloted audit, operator validation, spec/readiness, implementation, and local design proof for the bounded Benefits and Features redesign. | Partial: design implementation is complete; authoritative visual proof awaits the matching Vercel preview. | `/005-sg-ship replayglowz landing cards, then /405-sg-prod and /108-sg-browser` |

## Current Chantier Flow

| Step | Status | Notes |
|------|--------|-------|
| 100-sg-spec | done | Spec created from the operator-approved scope. |
| 101-sg-ready | ready | Strict readiness, design-system, security, and proof review passed. |
| 102-sg-start | implemented | Benefits and Features harmonized in EN/FR; build and local drift checks passed. |
| 103-sg-verify | partial | Build, scope, metadata, accessibility structure, and drift checks pass; preview browser scenarios remain required. |
| 104-sg-end | not started | Local closure pending. |
| 005-sg-ship | awaiting authorization | Required before Vercel target discovery and authoritative browser proof. |

Next command: `/005-sg-ship replayglowz landing cards`, then `/405-sg-prod` and `/108-sg-browser` on the matching preview.
