# judgemebro.com

Fast competitive AI dilemma game prototype.

Live Vercel deployment: https://judgemebro.vercel.app

## Stack

- React 19 + Vite
- Supabase-ready client persistence
- Vercel-ready static deployment
- GitHub Actions build CI
- Generated visual assets for the `judgemebro.com` product direction

## Prototype Loops

- Ranked 1v1 battle: choose category, find opponent, answer under the timer, get judged, gain or lose points.
- Friend battle: create a private room link, wait for a friend, start the same-prompt duel.
- Bot fallback: play a bot if matchmaking takes too long.
- Streamer mode: create a live room, collect viewer answers, show selected answers, optionally start an official judged battle.

## Run Locally

```bash
npm install
npm run dev
```

The Vite dev server runs on `http://127.0.0.1:5173` by default.

## Build

```bash
npm run build
```

## Smoke Test

```bash
npm run test:judge
npm run test:supabase
npm run test:workflows
npm run test:deployment
npm run test:docs
npm run test:vercel-env-sync
npm run test:smoke
```

The judge test validates the Vercel API contract. The Supabase test statically checks that public tables have RLS and policies, that Realtime tables are published, and that the service-role key is not referenced by client source. The workflow test checks the GitHub CI, Vercel deploy, and Supabase migration workflow contracts. The deployment test checks the live Vercel app, live judge API, and reports custom-domain DNS status. The docs test checks that provider handoff docs are present and linked. The Vercel env sync test dry-runs the Supabase client env sync and confirms the service-role key is ignored. The smoke test starts a built Vite preview and verifies the ranked, friend, bot, streamer, viewer, and official streamer battle flows.

## Setup Check

```bash
npm run setup:check
npm run check:providers
```

Use `setup:check` for local repo readiness. Use `check:providers` for account-side GitHub, Vercel, custom-domain DNS, and Supabase readiness.

## Launch Audit

```bash
npm run launch:audit
```

This command exits non-zero until the GitHub remote, Vercel deployment, custom-domain DNS, local/Vercel Supabase env vars, and Supabase auth are all complete.

## Vercel Env Sync

```bash
npm run sync:vercel-env -- --dry-run
npm run sync:vercel-env
```

Use this after `.env.local` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The sync script never sends `SUPABASE_SERVICE_ROLE_KEY`.

## GitHub Publish

```bash
npm run github:publish -- --remote https://github.com/<owner>/judgemebro.git --connect-vercel
```

Use this after creating the GitHub repository. It adds `origin`, pushes `main`, and can connect the linked Vercel project to the GitHub remote.

## Setup Docs

- Supabase schema and RLS notes: `docs/supabase.md`
- Vercel and GitHub CI notes: `docs/deployment.md`
- GitHub remote and secrets setup: `docs/github.md`
- Creative production brief and generated prompt pack: `docs/creative-production.md`
- Design QA report: `design-qa.md`
