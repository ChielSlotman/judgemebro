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
npx playwright install --with-deps chromium
npm run test:smoke
```

If you later want CLI-based Vercel deployment from GitHub Actions, add these repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Then add a separate deploy workflow that runs `vercel pull`, `vercel build`, and `vercel deploy --prebuilt`.
