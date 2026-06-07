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
- Friend battle: create a private room link like `/battle/V7P2`, wait for a friend, start the same-prompt duel.
- Bot fallback: play a bot if matchmaking takes too long.
- Streamer mode: create a live room, share a viewer link like `/stream/BRO9`, collect viewer answers, show selected answers, optionally start an official judged battle.

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
npm run verify
```

`verify` runs the normal passing repo checks: judge API contract, Supabase schema/config contract, Supabase migration helper plan, GitHub workflow contract, docs/env contract, Vercel env sync dry run, GitHub repo creation dry run, GitHub publish dry run, live deployment check, setup check, production build, and the full smoke flow.

`launch:audit` remains separate because it is expected to fail until external GitHub, DNS, and Supabase account setup is complete.

## Setup Check

```bash
npm run setup:check
npm run check:providers
npm run domain:check
```

Use `setup:check` for local repo readiness. Use `check:providers` for account-side GitHub, Vercel, custom-domain DNS, and Supabase readiness. Use `domain:check` for exact current DNS and Vercel domain inspection.

## Launch Audit

```bash
npm run launch:audit
```

This command exits non-zero until the GitHub remote, Vercel deployment, custom-domain DNS, local/Vercel Supabase env vars, and Supabase auth are all complete.

## Vercel Env Sync

Copy `.env.example` to `.env.local`, then add the real Supabase client values:

```bash
copy .env.example .env.local
```

```bash
npm run sync:vercel-env -- --dry-run
npm run sync:vercel-env
```

Use this after `.env.local` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The sync script never sends `SUPABASE_SERVICE_ROLE_KEY`.

The judge API can use a real server-side AI judge when `OPENAI_API_KEY` is set in Vercel. Keep it server-only; never add it as a `VITE_` variable. Use `npm run sync:vercel-server-env` after adding `OPENAI_API_KEY` to `.env.local`.

## GitHub Publish

```bash
$env:GH_TOKEN = "<github-token>"
npm run github:create -- --name judgemebro --push --connect-vercel
```

Use this if you have a GitHub token with repository creation permission. It creates the GitHub repo, adds `origin`, pushes `main`, and can connect the linked Vercel project to the GitHub remote.

```bash
npm run github:publish -- --remote https://github.com/<owner>/judgemebro.git --connect-vercel
```

Use this after creating the GitHub repository manually. It adds `origin`, pushes `main`, and can connect the linked Vercel project to the GitHub remote.

## Setup Docs

- Supabase schema and RLS notes: `docs/supabase.md`
- Vercel and GitHub CI notes: `docs/deployment.md`
- Custom domain DNS setup: `docs/domain.md`
- GitHub remote and secrets setup: `docs/github.md`
- Creative production brief and generated prompt pack: `docs/creative-production.md`
- Design QA report: `design-qa.md`
