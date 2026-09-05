---
artifact: documentation
metadata_schema_version: "1.0"
artifact_version: "1.0.0"
project: replayglows
created: "2026-09-05"
updated: "2026-09-05"
status: reviewed
source_skill: shipglows
scope: extension-docker-validation
owner: Diane
confidence: high
risk_level: low
security_impact: no
docs_impact: yes
linked_systems: []
depends_on: []
supersedes: []
evidence:
  - "Linux Docker image build, container typecheck and build:ext passed."
  - "Default watcher generated all six manifest resources and rebuilt a CSS probe."
next_step: "Keep real YouTube and legacy bookmark validation in its separate feature scope."
---

# Extension Docker Validation — 2026-09-05

## Scope and host

Validated the unchanged extension Dockerfile at d06d0d659a3ec95ab78cc1f87a4f464fb3fdb6ab in the dedicated f09b worktree. Remote main matched that commit at the initial check. No dependency, product, CI or protection changes were needed.

Initially, `docker info` failed because the desktop-linux endpoint `npipe:////./pipe/dockerDesktopLinuxEngine` was absent; `docker desktop status` also could not reach Desktop. Normal `docker desktop start` succeeded without changing global settings. The Linux engine subsequently reported Docker 29.7.2. The ShipGlows extension registry record remained stopped with no assigned URL; this image runs a build watcher, not a web server.

## Reproduction and results

From the repository root:

```powershell
docker --context desktop-linux build --progress=plain -t replayglows-ext-validation:f09b-d06d0d6 ./ext
docker --context desktop-linux run --rm --name replayglows-ext-build-f09b replayglows-ext-validation:f09b-d06d0d6 sh -c 'node --version && pnpm --version && pnpm type-check && pnpm build:ext'
docker --context desktop-linux run -d --name replayglows-ext-watch-f09b replayglows-ext-validation:f09b-d06d0d6
docker --context desktop-linux exec replayglows-ext-watch-f09b pnpm verify:package
```

- Image build: passed, Linux/amd64; Node 24.20.0 and pnpm 11.24.0. Frozen installation passed its 273-entry policy check and installed 215 packages without modifying the repository lockfile. Network-speed warnings were non-fatal.
- Base resolved to `node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf`; image ID was `sha256:4a97d630234553b21096ae0990b985a42c1e18286af85540b17a8ea2c6c5d7d5`.
- Container `pnpm type-check` and `pnpm build:ext`: passed; all six manifest resources existed, including output-ytb.css and the packaged Tinykeys module.
- Default command: started `vite build --watch`, generated the package, and remained running with zero restarts.
- Watch regression: appended `.docker-validation-f09b { color: rgb(1, 2, 3); }` to src/styles/styles-youtube.css only inside the disposable container. The emitted output-ytb.css contained the probe, the rebuild completed in 3953 ms, and all six manifest resources still passed verification.
- Context review: .dockerignore excludes host node_modules, dist, Git and environment files; .env and ENVIRONMENT.md were absent inside the test container. No host source bind mount or published port was used.

The build container was automatically removed. Only the dedicated watcher container was stopped and removed. The validation image was retained locally and the shared Linux engine was left running. No worker container or other session was stopped. The main checkout's four pre-existing untracked ENVIRONMENT.md files were preserved.

## Proof boundaries and documentation

Docker image construction, package generation and watcher execution are freshly verified. Browser loading was already recorded in 2026-09-05-extension-backend-repair.md and was not rerun against this Docker-produced package. This run does not establish real YouTube interactions or legacy bookmark functionality, nor Windows bind-mount file notifications. The container is build tooling, not a browser runtime or hosted product deployment.

Documentation: updated extension runtime guidance and its existing task status; the code-docs map was reviewed, with no code or architecture change. Fresh external documentation was not needed for these direct executable checks. Editorial: not impacted because no public behavior or promise changed; opportunity not assessed. Changelog: internal-only validation evidence, no public release note or deployment.
