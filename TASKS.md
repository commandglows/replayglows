# Tasks - replayglowz

## Audit: Deps

🟢 [replayglowz] task: Patch `replayglowz_lab` Starlette advisory GHSA-86qp-5c8j-p5mr by updating the FastAPI/Starlette lock lane and validating worker auth/routing behavior | status: done | area: deps
🟢 [replayglowz] task: Patch `replayglowz_site` transitive `devalue` advisory GHSA-77vg-94rm-hx3p through the Astro/Vite dependency lane and rebuild the marketing site | status: done | area: deps
🟢 [replayglowz] task: Patch `replayglowz_lab` transitive `idna` advisory CVE-2026-45409 while preserving hash-checked `requirements.lock` installs | status: done | area: deps
🟡 [replayglowz] task: Review the direct major dependency lanes before upgrading `youtube_player_flutter`, `openai`, and transcript-worker ML/tooling packages | status: todo | area: deps | next: /sf-migrate ReplayGlowz dependency major upgrade lanes
