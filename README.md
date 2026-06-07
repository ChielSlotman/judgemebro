# judgemebro.com

Fast competitive AI dilemma game prototype.

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
npm run test:smoke
```

The judge test validates the Vercel API contract. The Supabase test statically checks that public tables have RLS and policies, that Realtime tables are published, and that the service-role key is not referenced by client source. The smoke test starts a built Vite preview and verifies the ranked, friend, bot, streamer, viewer, and official streamer battle flows.

## Setup Check

```bash
npm run setup:check
```

Use this before pushing/deploying to see whether GitHub, Vercel, and Supabase local setup is complete.

## Setup Docs

- Supabase schema and RLS notes: `docs/supabase.md`
- Vercel and GitHub CI notes: `docs/deployment.md`
- Creative production brief and generated prompt pack: `docs/creative-production.md`
- Design QA report: `design-qa.md`
