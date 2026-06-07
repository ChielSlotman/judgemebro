# GitHub Setup

This repository is ready to push, but no GitHub remote is configured locally yet.

## Create The Repository

Create a GitHub repository named `judgemebro` through GitHub Desktop or the GitHub web UI.

Then add the remote from this local repo:

```bash
git remote add origin https://github.com/<owner>/judgemebro.git
git push -u origin main
```

Run:

```bash
npm run setup:check
```

The `Git remote configured` line should change from `TODO` to `PASS`.

## Required Secrets

Add these repository secrets for the manual Vercel deploy workflow:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The current Vercel project values are in local `.vercel/project.json`, which is gitignored.

Add these repository secrets for the manual Supabase migration workflow:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF`

Do not add `SUPABASE_SERVICE_ROLE_KEY` to the Vite client environment.

## GitHub Workflows

After the first push, GitHub should run `.github/workflows/ci.yml` on `main` and pull requests.

CI checks:

- `npm ci`
- `npm run build`
- `npm run test:judge`
- `npm run test:supabase`
- `npm run test:workflows`
- `npm run test:smoke`

Manual workflows:

- `Vercel Deploy`: preview or production deployment through Vercel CLI.
- `Supabase Migrations`: dry-run first, then apply only when `apply=true`.

## Verification

After GitHub is connected:

```bash
npm run test:workflows
npm run setup:check
```

Then verify GitHub Actions in the repository UI. The first CI run should pass before relying on GitHub-based deploys.
