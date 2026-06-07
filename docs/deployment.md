# Deployment

## Vercel

The repo includes `vercel.json` for a Vite deployment:

- install: `npm ci`
- build: `npm run build`
- output: `dist`

Current linked project:

- scope: `michaels-projects-d6b99e1a`
- project: `judgemebro`
- production URL: `https://judgemebro.vercel.app`
- project ID and org ID are stored locally in `.vercel/project.json`, which is intentionally gitignored.

Custom domains attached to the Vercel project:

- `judgemebro.com`
- `www.judgemebro.com`

DNS is still pending at the registrar. Current DNS points to Hostinger parking. Set:

```text
A judgemebro.com 76.76.21.21
A www.judgemebro.com 76.76.21.21
```

or switch nameservers to:

```text
ns1.vercel-dns.com
ns2.vercel-dns.com
```

After DNS changes propagate, run:

```bash
npm run domain:check
npm run check:providers
npm run test:deployment
npm run launch:audit
```

Detailed DNS setup is tracked in `docs/domain.md`.

Recommended first-time setup:

```bash
npm run setup:check
npx vercel link --yes --project judgemebro
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
npx vercel env add OPENAI_API_KEY production
npx vercel env add OPENAI_JUDGE_MODEL production
npx vercel env add VITE_SUPABASE_URL preview development
npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY preview development
npx vercel env add OPENAI_API_KEY preview development
npx vercel env add OPENAI_JUDGE_MODEL preview development
npx vercel deploy
```

After `.env.local` contains Supabase client values, sync them to Vercel without exposing the service-role key:

```bash
npm run sync:vercel-env -- --dry-run
npm run sync:vercel-env
npm run sync:vercel-server-env -- --dry-run
npm run sync:vercel-server-env
npm run check:providers
```

For GitHub-based deployment, connect the GitHub repo to Vercel and let pushes create preview deployments. Production should deploy from `main`.
GitHub remote and repository secret setup is tracked in `docs/github.md`.

The GitHub deploy workflow pulls environment variables from Vercel before building. Keep Supabase client values and `OPENAI_API_KEY` configured in Vercel so previews and production use the same provider setup as the dashboard deployment.

On this Windows machine, `vercel build` can fail locally with `spawn cmd.exe ENOENT` even when `npm run build` succeeds. Use `vercel deploy` for cloud builds, or run the prebuilt workflow in GitHub Actions/Linux.

## GitHub CI

`.github/workflows/ci.yml` runs:

```bash
npm ci
npx playwright install --with-deps chromium
npm run verify
```

## GitHub Vercel Deploy Workflow

`.github/workflows/vercel-deploy.yml` is a manual workflow for preview or production deployment once the GitHub repository has these secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

It uses pinned `npx vercel@54.9.1`, so a global Vercel CLI install is not required in CI.

Before pulling and deploying the Vercel build, the workflow runs:

```bash
npm run build
npm run test:judge
npm run test:supabase
npm run test:supabase-migrate
npm run test:workflows
npm run test:docs
npm run test:env-example
npm run test:vercel-env-sync
npm run test:vercel-server-env-sync
npm run test:github-create
npm run test:github-publish
```

## GitHub Supabase Migration Workflow

`.github/workflows/supabase-migrations.yml` is a manual workflow for remote database migrations. It always runs:

```bash
npm ci
npm run test:supabase
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push --dry-run
```

It only applies migrations when the workflow input `apply` is set to `true`.

Required GitHub repository secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF`

The workflow uses `concurrency` so production migration pushes do not overlap.
It installs the Supabase CLI through `supabase/setup-cli@v2`.

## Judge API

Vercel deploys `api/judge.js` as a serverless function. The client calls `/api/judge` first and falls back to the local deterministic judge engine when running in plain Vite preview or when the API is unavailable.

When `OPENAI_API_KEY` is configured in Vercel, `/api/judge` uses the OpenAI Responses API with structured JSON output for submitted answer comparisons. `OPENAI_JUDGE_MODEL` is optional and defaults to `gpt-4o-mini`. Do not expose `OPENAI_API_KEY` through any `VITE_` environment variable.

For free local model testing, set `JUDGE_PROVIDER=ollama`, `OLLAMA_JUDGE_URL=http://127.0.0.1:11434/api/chat`, and `OLLAMA_JUDGE_MODEL=text-judge` in `.env.local`, then run through `npm exec vercel -- dev`. Do not deploy the Ollama provider to Vercel because production functions cannot reach a model server running on this computer. See `docs/local-ai.md`.

Use the server-only sync script after `.env.local` contains `OPENAI_API_KEY`:

```bash
npm run test:vercel-server-env-sync
npm run sync:vercel-server-env -- --dry-run
npm run sync:vercel-server-env
```

The API intentionally judges only official battles. Streamer viewer answers are stored/displayed by default and should only be sent to `/api/judge` after the streamer manually selects one.
