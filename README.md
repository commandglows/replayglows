# ReplayGlowz

Canonical monorepo for the ReplayGlowz product surfaces.

## Repository Layout

- `app` - Flutter application
- `backend` - product Convex backend
- `site` - website
- `lab` - backend and tooling
- `shipflow_data` - governance, specs, research, audits, and trackers

## Deployment Model

- GitHub source of truth: `diane-defores/replayglowz`
- Vercel project `ReplayGlowz-App` uses `app` as its Root Directory
- Vercel project `ReplayGlowz-Site` uses `site` as its Root Directory
- `lab` is maintained in this monorepo and deployed separately from Vercel

## Related Repository

- Historical TubeFlow repositories are migration sources only; ReplayGlowz must not depend on them for active backend code.

## Dependency Maintenance

Dependabot is configured at `.github/dependabot.yml` for the site npm lock,
worker Python requirements, Flutter pub packages, GitHub Actions, and the worker
Docker base image. Dependabot PRs require human review; no dependency updates
are auto-merged.

Use the subproject lockfiles and audit commands as the source of truth:

```bash
(cd site && npm ci && npm audit --json && npm run build)
(cd lab && pip-compile --generate-hashes --allow-unsafe --strip-extras --output-file requirements.lock requirements.in)
(cd lab && pip-audit -r requirements.lock -f json)
(cd app && flutter pub outdated --json && flutter analyze)
(cd backend/packages/backend && npm run typecheck)
```

The worker installs from `lab/requirements.lock` with
`--require-hashes`; edit `requirements.in` first, then regenerate the lock.
If `pip-audit -r requirements.lock` cannot create its temporary environment on
the host, install the lock into a disposable target directory and audit that
directory with `pip-audit --path`.
The Flutter web deploy and Android workflow pin Flutter `3.41.7`.

## Working Rule

All Flutter web surfaces now live in this repository. Do not use the archived legacy repositories as active sources of truth.
