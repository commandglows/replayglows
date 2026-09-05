---
artifact: documentation
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-05"
updated: "2026-09-05"
status: reviewed
source_skill: shipglows
scope: minor-dependency-refresh
owner: Diane
confidence: high
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems: []
depends_on: []
supersedes: []
evidence:
  - "Flutter analysis and 50 tests passed."
  - "Backend typecheck, mocked structured output and webhook signature tests passed."
  - "Site build and extension typecheck/build passed; extension packaging gaps identified."
next_step: "Resolve separately tracked advisory, extension packaging and major migration lanes."
---

# Minor Dependency Refresh — 2026-09-05

## Approved scope

Updated 21 direct dependencies across backend, site, extension and Flutter, plus compatible transitive dependencies. Major migrations, Python worker dependencies, Docker images and CI policy are unchanged. Four pre-existing untracked ENVIRONMENT.md files were preserved. No local server, device session, hosted authentication or live API request was started.

| Surface | Direct updates |
| --- | --- |
| Backend | convex 1.45.0, openai 7.10.0, svix 1.99.1, zod 4.5.4, @types/node 26.4.1 |
| Site | astro 7.2.9 |
| Extension | vue 3.5.42, @types/chrome 0.2.8, @types/node 26.4.1, @typescript-eslint/eslint-plugin and parser 8.69.0, autoprefixer 10.5.5, concurrently 10.0.5, eslint 10.10.0, postcss 8.5.28, vite 8.2.2, vue-tsc 3.3.11 |
| Flutter | flutter_riverpod 3.4.3, go_router 17.5.0, record 6.2.1, sentry_flutter 9.29.0 |

Astro 7.3.1 was available but too recent for the site's seven-day minimum release age; that rule remains unchanged. The extension's pnpm 11 installer generated exact-version minimumReleaseAgeExclude entries for autoprefixer 10.5.5, browserslist 4.28.9 and eslint 10.10.0 during the explicitly requested update; no global age setting was changed. Existing extension TypeScript 5.9.3 and globals 16.5.0 remain pinned to their current major lanes. Flutter Rust Bridge remains overridden to 2.11.1 for native binding compatibility.

## Verification

- Flutter `analyze --no-pub` passed; all 50 tests passed. Package resolution removed obsolete test-tool transitives; test execution remains functional. No native device, APK, recording or live authentication proof is claimed.
- Backend typecheck passed after direct and transitive updates. OpenAI Responses parsing with Zod passed against mocked fetch, the backend action bundled for a browser platform, and Svix accepted a valid local signature while rejecting a tampered payload. No credentials or external messages were used.
- Astro generated 11 pages and RSS. The extension passed TypeScript/Vue typechecking and its build command. Build success does not establish a usable unpacked extension; see the existing gaps below.
- Compatible backend updates of axios, form-data, websocket-driver and gaxios reduced `npm audit` from nine affected packages (one critical, two high, six moderate) to six moderate packages, with no high or critical results. The remaining chain includes uuid <11.1.1 via Firebase Admin / Google Storage. The suggested Firebase downgrade was not applied.
- Targeted transitive updates of js-yaml and svgo in the site, and nanoid in the extension, leave both pnpm audits with zero reported advisories at this check. This is a point-in-time registry result, not a security guarantee.

## Remaining work and proof limits

- Backend: six moderate audit entries remain in the Firebase/Google Storage dependency chain. Track an upstream-compatible fix rather than forcing uuid across major versions. [uuid advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
- Extension: `build:ext` generates CSS before Vite empties dist, so manifest resource `output-ytb.css` is absent. `node_modules/tinykeys/dist/tinykeys.modern.js` is also declared but absent. The prior committed script, Vite config and manifest already contain these conditions. Repair packaging and validate actual Chrome extension contexts separately; no packaging files were changed in this refresh.
- Extension Docker still uses Node 18 despite Node >=24 in package.json, and the extension is not covered by Dependabot. These are separate existing maintenance items.
- Google Sign-In 7, record 7 and Python 3.14 PRs remain open. Firebase, other Flutter majors, extension TypeScript/globals, Svix 2 and Python SDK/worker upgrades remain outside this approved non-major batch.
- No deployment, hosted OAuth or exhaustive end-to-end verification was performed. Public content and release notes were not changed.
