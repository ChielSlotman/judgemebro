# Deployment

## Vercel

The repo includes `vercel.json` for a Vite deployment:

- install: `npm ci`
- build: `npm run build`
- output: `dist`

Recommended first-time setup:

```bash
vercel link --yes --project judgemebro
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
vercel env add VITE_SUPABASE_URL preview development
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY preview development
vercel deploy
```

For GitHub-based deployment, connect the GitHub repo to Vercel and let pushes create preview deployments. Production should deploy from `main`.

## GitHub CI

`.github/workflows/ci.yml` runs:

```bash
npm ci
npm run build
```

If you later want CLI-based Vercel deployment from GitHub Actions, add these repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Then add a separate deploy workflow that runs `vercel pull`, `vercel build`, and `vercel deploy --prebuilt`.
