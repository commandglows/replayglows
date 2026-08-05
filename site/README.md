# ReplayGlows Site

Marketing site for ReplayGlows, built with Astro.

## Environment

Copy `.env.example` and override these values when the domains change:

```bash
PUBLIC_SITE_URL=https://replayglowz.com
PUBLIC_APP_URL=https://app.replayglowz.com
PUBLIC_EMAIL_DOMAIN=winflowz.com
```

All canonicals, structured data URLs, and CTA links read from these variables through `src/config/site.ts`.

## Observability

Sentry is not required for this site while it remains a static marketing/content surface with no authentication or user-specific runtime workflow.

Add Sentry before introducing authentication, account state, protected routes, checkout/payment flows, server-handled form submissions, or other runtime behavior where a user action can fail outside the build/deploy pipeline.

## Commands

Use Node.js 24.18.0 (pinned in `.nvmrc`). All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install --frozen-lockfile` | Installs locked dependencies              |
| `pnpm audit --json`               | Checks dependencies for known advisories  |
| `pnpm dev`                        | Starts local dev server at `localhost:4321` |
| `pnpm build`                      | Build your production site to `./dist/`   |
| `pnpm preview`                    | Preview your build locally, before deploying |
| `pnpm astro ...`                  | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help`            | Get help using the Astro CLI              |
