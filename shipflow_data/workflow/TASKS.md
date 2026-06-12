# Tasks - replayglowz

> Operational task records follow `/home/claude/shipflow/skills/references/operational-record-format.md`.

---

## Audit: Deps

🟢 [replayglowz] task: Upgrade `replayglowz_backend/packages/backend` to the latest non-major `convex`, `openai`, and `svix` releases, rerun `npm audit`, and verify Convex backend typecheck/runtime behavior | status: done | area: deps | evidence: `npm install`, `npm audit --json`, `npm run typecheck`
🟢 [replayglowz] task: Open a migration lane for `firebase-admin` 14.x so the backend can clear the remaining `uuid` / `google-gax` advisory chain without forcing an unreviewed major jump | status: done | area: deps | evidence: command-scoped `npm_config_min_release_age=0 npm install`, `npm run typecheck`, `npm audit --json`
🟢 [replayglowz] task: Add `replayglowz_backend/packages/backend` to `.github/dependabot.yml` and pin its Node/package-manager policy so backend dependency drift is monitored like the site and worker | status: done | area: deps | evidence: `.github/dependabot.yml`, `replayglowz_backend/packages/backend/package.json`
🟢 [replayglowz] task: Patch `replayglowz_lab` Starlette advisory GHSA-86qp-5c8j-p5mr by updating the FastAPI/Starlette lock lane and validating worker auth/routing behavior | status: done | area: deps
🟢 [replayglowz] task: Patch `replayglowz_site` transitive `devalue` advisory GHSA-77vg-94rm-hx3p through the Astro/Vite dependency lane and rebuild the marketing site | status: done | area: deps
🟢 [replayglowz] task: Patch `replayglowz_lab` transitive `idna` advisory CVE-2026-45409 while preserving hash-checked `requirements.lock` installs | status: done | area: deps
🟡 [replayglowz] task: Review remaining direct major dependency lanes for `record` and transcript-worker ML/tooling packages | status: todo | area: deps | next: /sf-migrate ReplayGlowz dependency major upgrade lanes
🟢 [replayglowz] task: Migrate `replayglowz_app` from `youtube_player_flutter` 9.x to 10.x and adapt player API usage | status: done | area: deps
🟢 [replayglowz] task: Remove beta auth packages `clerk_flutter` / `clerk_auth` and replace the disabled path with stable Firebase Auth | status: done | area: deps
🟢 [replayglowz] task: Remove unused Flutter codegen packages: `riverpod_annotation`, `build_runner`, and `riverpod_generator` | status: done | area: deps
🟢 [replayglowz] task: Upgrade direct non-beta dependencies to latest resolvable versions, including `go_router`, `sentry_flutter`, and `flutter_lints` | status: done | area: deps
🟢 [replayglowz] task: Remove legacy app/domain fallbacks (`TUBEFLOW_APP_URL`, `TUBEFLOW_WEB_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_SENTRY_DSN`) from app config and OAuth runtime | status: done | area: deps
🟠 [replayglowz] task: Validate Firebase Auth, Convex token acceptance, and YouTube OAuth on the deployed Vercel/Convex environment | status: pending | area: prod | next: /sf-prod replayglowz_app

## Documentation Governance

🟢 [replayglowz] task: Align root and subproject ShipFlow docs under canonical `shipflow_data/` paths | status: done | area: docs
🟢 [ShipFlow] task: Close local governance spec for ShipFlow skill reporting and proof hardening | status: done | area: workflow | spec: shipflow_data/workflow/specs/shipflow-skill-reporting-and-proof-hardening.md | next: /sf-ship shipflow-skill-reporting-and-proof-hardening

## Audit: Perf

🟢 [replayglowz] task: Enable Android release shrinking in `replayglowz_app/android/app/build.gradle.kts` so dead Java/Kotlin code and unused resources are removed from production artifacts | status: done | area: perf | evidence: `flutter analyze`
🟢 [replayglowz] task: Constrain `CachedNetworkImage` decode/cache dimensions in `replayglowz_app/lib/widgets/media/media_thumbnail.dart` to the rendered thumbnail size on device-density screens | status: done | area: perf | evidence: `flutter analyze`
🟠 [replayglowz] task: Reduce large filtered-feed fetch pressure in `VideosScreen` where each selected virtual feed currently requests up to 500 entries before merge | status: in_progress | area: perf | evidence: bounded progressive pagination now implemented locally in `VideosScreen` and `VirtualFeedDetailScreen`; `flutter analyze` passed | next: /005-sf-ship replayglowz-android-feed-pagination-and-virtualization -> /405-sf-prod replayglowz_app
🟢 [replayglowz] task: Remove unused `replayglowz_site/public/professional-headshot-*.png` payloads that were copied into every static build despite having no source references | status: done | area: perf
🟢 [replayglowz] task: Remove global `lenis` smooth-scroll dependency and layout script so the Astro site build emits no client JavaScript chunks | status: done | area: perf
🟢 [replayglowz] task: Batch `youtube:fetchPlaylistItems` calls in `syncAllPlaylists` instead of waiting for each playlist sync sequentially | status: done | area: perf
🟢 [replayglowz] task: Defer the all-notes subscription on `VideosScreen` until the Notes view is active | status: done | area: perf
🟢 [replayglowz] task: Gate `PlayScreen` transcript subscriptions to the active Transcript tab and avoid the normal full-library videos subscription during play render | status: done | area: perf
🟢 [replayglowz] task: Self-host/subset the Google and Cal Sans font stack to remove remaining render-blocking remote font CSS | status: done | area: perf
🟡 [replayglowz] task: Evaluate transcript worker preflight/download duplication if `/transcribe` latency becomes an operational bottleneck | status: todo | area: perf

## Audit: Design

🟠 [replayglowz] task: Open a spec to align public marketing claims, pricing, AI/security badges, and social proof with the product and claim-register evidence | status: pending | area: design | next: /sf-spec ReplayGlowz public design and claim alignment
🟢 [replayglowz] task: Wire persisted app theme settings into `themeModeProvider` or remove the non-functional selector until the preference changes the UI | status: done | area: design | evidence: `replayglowz_app/lib/app/theme.dart` and `replayglowz_app/lib/main.dart`
🟡 [replayglowz] task: Consolidate site/app design tokens for typography, radius, color roles, focus states, and motion so both surfaces feel like one product | status: todo | area: design

## Current Fixes

🟠 [replayglowz] task: Fix Feed video snap so slow vertical scroll release visibly aligns to the nearest video in cards, list, and notes views | status: fixed-pending-verify | area: app | bug: BUG-2026-06-01-002 | evidence: `flutter analyze`, `flutter test`, metadata lint | next: /sf-test --retest BUG-2026-06-01-002
🟠 [replayglowz] task: Stop the watched visibility toggle from refreshing the whole Feed; filter watched videos locally instead | status: fixed-pending-verify | area: app | bug: BUG-2026-06-01-003 | evidence: `flutter analyze`, `flutter test`, metadata lint, `git diff --check`
🟠 [replayglowz] task: Keep Feed cards, list, and notes scroll positions synchronized continuously, including near the last videos | status: fixed-pending-verify | area: app | bug: BUG-2026-06-01-004 | evidence: `flutter analyze`, `flutter test`, `git diff --check`; active-video scroll is now limited to explicit Play-to-Feed entry and Feed items highlight the current video | next: /sf-test --retest BUG-2026-06-01-004

---

## Audit Findings

<!-- Populated by /sf-audit with traffic-first task records when findings become tasks. -->
