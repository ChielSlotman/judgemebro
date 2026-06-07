# Deployment

## Vercel

The repo includes `vercel.json` for a Vite deployment:

- install: `npm ci`
- build: `npm run build`
- output: `dist`

Recommended first-time setup:

```bash
npm run setup:check
npx vercel link --yes --project judgemebro
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
npx vercel env add VITE_SUPABASE_URL preview development
npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY preview development
npx vercel deploy
```

For GitHub-based deployment, connect the GitHub repo to Vercel and let pushes create preview deployments. Production should deploy from `main`.

## GitHub CI

`.github/workflows/ci.yml` runs:

```bash
npm ci
npm run build
npm run test:judge
npx playwright install --with-deps chromium
npm run test:smoke
```

## GitHub Vercel Deploy Workflow

`.github/workflows/vercel-deploy.yml` is a manual workflow for preview or production deployment once the GitHub repository has these secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

It uses pinned `npx vercel@54.9.1`, so a global Vercel CLI install is not required in CI.

## Judge API

Vercel deploys `api/judge.js` as a serverless function. The client calls `/api/judge` first and falls back to the local deterministic judge engine when running in plain Vite preview or when the API is unavailable.

The API intentionally judges only official battles. Streamer viewer answers are stored/displayed by default and should only be sent to `/api/judge` after the streamer manually selects one.
