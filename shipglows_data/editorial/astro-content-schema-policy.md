---
artifact: editorial_content_context
metadata_schema_version: "1.0"
artifact_version: "0.2.0"
project: "replayglows"
created: "2026-05-10"
updated: "2026-09-05"
status: "draft"
source_skill: sf-docs
scope: "schema-policy"
owner: "Diane"
confidence: "high"
risk_level: "medium"
security_impact: "none"
docs_impact: "yes"
content_surfaces:
  - "runtime_content"
  - "blog"
claim_register: "shipglows_data/editorial/claim-register.md"
page_intent: "shipglows_data/editorial/page-intent-map.md"
linked_systems:
  - "site/src/content.config.ts"
  - "site/src/content/blog"
depends_on:
  - "shipglows_data/editorial/public-surface-map.md"
supersedes: []
evidence:
  - "site/src/content.config.ts"
next_review: "2026-06-10"
next_step: "sg-docs editorial audit"
---

# Astro Content Schema Policy

## Runtime Schema

`site/src/content.config.ts` defines the blog collection frontmatter schema:

- `title: string`
- `description: string`
- `date: string`
- `author: string` optional
- `tags: string[]` optional

## Policy

- Do not add ShipGlows governance frontmatter to `site/src/content/blog/**` unless the Astro schema is explicitly extended first.
- Store governance metadata in `shipglows_data/editorial/**`, not in runtime blog content.
- Validate content schema changes with `(cd site && npm run build)`.

## Maintenance Rule

Update this policy whenever `site/src/content.config.ts` changes.

## Paired Extension Articles (2026-09-05)

The schema adds `locale: en|fr` (default en), optional `articleKey` and optional `alternateSlug`. The extension review article declares both locales with the same articleKey, date and reciprocal alternateSlug. Existing articles retain their IDs, English routes and content. `/blog` lists both locales using the correct route prefix; the existing English RSS feed includes English entries only. French paired articles resolve under `/fr/blog/[slug]`. No global migration or translation of historical articles is implied. `site/scripts/verify-extension-content.mjs` checks rendered routes, reciprocal alternates and links.
