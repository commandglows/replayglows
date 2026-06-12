# Tasks - replayglowz

## Audit: Deps

🟢 [replayglowz] task: Upgrade `replayglowz_backend/packages/backend` to the latest non-major `convex`, `openai`, and `svix` releases, rerun `npm audit`, and verify Convex backend typecheck/runtime behavior | status: done | area: deps | evidence: `npm install`, `npm audit --json`, `npm run typecheck`
🟢 [replayglowz] task: Open a migration lane for `firebase-admin` 14.x so the backend can clear the remaining `uuid` / `google-gax` advisory chain without forcing an unreviewed major jump | status: done | area: deps | evidence: command-scoped `npm_config_min_release_age=0 npm install`, `npm run typecheck`, `npm audit --json`
🟢 [replayglowz] task: Add `replayglowz_backend/packages/backend` to `.github/dependabot.yml` and pin its Node/package-manager policy so backend dependency drift is monitored like the site and worker | status: done | area: deps | evidence: `.github/dependabot.yml`, `replayglowz_backend/packages/backend/package.json`
🟢 [replayglowz] task: Patch `replayglowz_lab` Starlette advisory GHSA-86qp-5c8j-p5mr by updating the FastAPI/Starlette lock lane and validating worker auth/routing behavior | status: done | area: deps
🟢 [replayglowz] task: Patch `replayglowz_site` transitive `devalue` advisory GHSA-77vg-94rm-hx3p through the Astro/Vite dependency lane and rebuild the marketing site | status: done | area: deps
🟢 [replayglowz] task: Patch `replayglowz_lab` transitive `idna` advisory CVE-2026-45409 while preserving hash-checked `requirements.lock` installs | status: done | area: deps
🟡 [replayglowz] task: Review the direct major dependency lanes before upgrading `youtube_player_flutter`, `openai`, and transcript-worker ML/tooling packages | status: todo | area: deps | next: /sf-migrate ReplayGlowz dependency major upgrade lanes
