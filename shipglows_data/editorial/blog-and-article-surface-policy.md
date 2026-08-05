---
artifact: editorial_content_context
metadata_schema_version: "1.0"
artifact_version: "0.1.0"
project: "replayglows"
created: "2026-05-10"
updated: "2026-05-10"
status: "draft"
source_skill: sf-docs
scope: "blog-policy"
owner: "Diane"
confidence: "medium"
risk_level: "medium"
security_impact: "unknown"
docs_impact: "yes"
content_surfaces:
  - "blog"
claim_register: "shipglows_data/editorial/claim-register.md"
page_intent: "shipglows_data/editorial/page-intent-map.md"
linked_systems:
  - "site/src/pages/blog"
  - "site/src/content/blog"
depends_on:
  - "shipglows_data/editorial/astro-content-schema-policy.md"
supersedes: []
evidence:
  - "site/src/pages/blog/index.astro"
  - "site/src/pages/blog/[slug].astro"
next_review: "2026-06-10"
next_step: "/sf-docs editorial audit"
---

# Blog And Article Surface Policy

## Declared Surface

The blog surface exists at `site/src/pages/blog` and renders Markdown entries from `site/src/content/blog`.

## Article Rules

- Preserve the Astro content schema in `astro-content-schema-policy.md`.
- Check `claim-register.md` for sensitive claims before publishing.
- Link article intent back to the relevant product, business, brand, or GTM contract.
- Do not create article claims about AI, automation, savings, compliance, security, or pricing without proof.

## Validation

```bash
(cd site && npm run build)
```
