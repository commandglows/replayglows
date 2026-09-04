---
artifact: documentation
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-04"
updated: "2026-09-04"
status: reviewed
source_skill: sg-engineering
scope: dependabot-review
owner: Diane
confidence: high
risk_level: medium
security_impact: yes
docs_impact: yes
linked_systems: []
depends_on: []
supersedes: []
evidence:
  - "GitHub merged states and exact-head checks on 2026-09-04."
  - "Flutter analysis and 50 tests passed; Android analysis/tests passed on PR #16."
  - "Backend typecheck, mocked OpenAI structured output and Astro build passed."
next_step: "Complete the three native/authentication/worker migration lanes below."
---

# Dependabot Review — 2026-09-04

## Scope and decisions

Reviewed the 13 open Dependabot PRs. Ten are merged; three remain open pending specific migration proofs. The user explicitly deferred adding a mandatory CI control. No new gate, branch-protection change, runner replacement, force push or live authentication operation was performed. Existing Linux CI remains valid. Node >=24 is now also declared for extension tooling; its dependencies were not changed in this review.

## Merged PRs

| PR | Change | Merge commit |
| --- | --- | --- |
| [#2](https://github.com/commandglows/replayglows/pull/2) | checkout 7 | 44521af348b3c290210fc3ae7a1ad807a7c62d84 |
| [#3](https://github.com/commandglows/replayglows/pull/3) | Tailwind 4.3.3 | fae1740b5e7b693acf76a54fc56c0ada4cc7751c |
| [#4](https://github.com/commandglows/replayglows/pull/4) | OpenAI 7.3 | bba2616d4ded9803b3ed449a3c85ef29fc5f026f |
| [#5](https://github.com/commandglows/replayglows/pull/5) | Node types 26.1.2 | 0c9c09352553ce7f6c98e6f8135243195c76c05f |
| [#6](https://github.com/commandglows/replayglows/pull/6) | cache 6 | c89becfbf0b04f048f6c04413b5509e763176ebc |
| [#7](https://github.com/commandglows/replayglows/pull/7) | Astro 7.1.6, explicit HTML compression | eb2c30a5996b3ec66b78ad3a6784893036c006ed |
| [#8](https://github.com/commandglows/replayglows/pull/8) | TypeScript 7.0.2, explicit Node types | 189f15a099e607d270de59f47faea0407f6b43c9 |
| [#15](https://github.com/commandglows/replayglows/pull/15) | Convex 1.44, Firebase Admin 14.3 | 5e0d9517d9cdd5bad394d491d6ea94abb0096c2b |
| [#16](https://github.com/commandglows/replayglows/pull/16) | Flutter package group, Flutter 3.47.1 compatibility | 75bd8eec1331a7773c2774fb611db99849d14a45 |
| [#17](https://github.com/commandglows/replayglows/pull/17) | setup-java 6 | 26eca89b65c26fb7c891768a490e698ca0f02f00 |

## Proof and compatibility work

- Flutter: refreshed the SDK pins and Dart minimum for Riverpod; migrated reorder callbacks without double-adjusting indices and updated SizeTransition alignment. Awaiting token resolution within the catch boundary preserves the missing-token/no-access result on asynchronous failures. Analysis and all 50 tests passed. The final constructor adjustment also passed six focused bridge tests and hosted Android analysis/tests at `c4bbb5b545b054ff64deeebcfccbce18721f5105` ([CI run](https://github.com/commandglows/replayglows/actions/runs/33922752175)). No APK or native login was tested.
- Backend: typecheck passed with refreshed Convex/Firebase, OpenAI 7, Node types 26, then TypeScript 6.0.3 and 7.0.2. Mocked Firebase initialization checked the messaging API shape without sending anything. OpenAI Responses parsing with Zod passed against mocked fetch; browser-platform bundling passed. No secret or live API request was used.
- Site: frozen install and Astro 7 build passed; checked 11 HTML outputs and RSS. HTML compression remains explicit. No browser visual regression or live deployment validation is claimed.
- Existing PR statuses were inspected before merging exact reviewed heads. A skipped Vercel build is not runtime proof. This review is not a comprehensive advisory audit or a release certification.

## Open migration lanes

| PR | Finding and required next proof |
| --- | --- |
| [#10](https://github.com/commandglows/replayglows/pull/10) Google Sign-In 7 | Existing constructor/signIn calls are incompatible. Migrate to the singleton, initialize once, use authenticate, and preserve Firebase ID-token and cancellation behavior. Validate login, cancellation, sign-out and suite access on Android before merging. |
| [#11](https://github.com/commandglows/replayglows/pull/11) record 7 | The plugin is used by feedback recording. Refresh against the merged Flutter SDK, regenerate the lock consistently, then verify permission handling, recording and playback on a native target. No managed device session was active during this review. |
| [#13](https://github.com/commandglows/replayglows/pull/13) Python 3.14 | The Linux Docker daemon was unavailable. A wheel-only, hash-enforced Linux dependency dry run stopped on aliyun-python-sdk-core 2.16.0 requiring a source build; this does not establish Python 3.14 incompatibility. Build the actual Linux image and run worker health/auth/transcription contract checks before merging. |

## Documentation and references

Architecture notes, site guidance and the task tracker record this maintenance. No public claims or release notes are warranted. Follow the existing integration/deployment policy; pushing a commit is not deployment proof.

- [Astro 7 migration](https://docs.astro.build/en/guides/upgrade-to/v7/)
- [OpenAI Node 7 release](https://github.com/openai/openai-node/releases/tag/v7.0.0)
- [Convex runtimes and TypeScript configuration](https://docs.convex.dev/functions/runtimes)
- [TypeScript 6 migration](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [Google Sign-In migration](https://github.com/flutter/packages/blob/main/packages/google_sign_in/google_sign_in/MIGRATION.md)
