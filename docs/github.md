# GitHub Setup

This repository is ready to push, but no GitHub remote is configured locally yet.

## Create The Repository

Create a GitHub repository named `judgemebro`.

If you have a GitHub token with repository creation permission, this repo can create the remote without GitHub CLI:

```bash
$env:GH_TOKEN = "<github-token>"
npm run github:create -- --name judgemebro --push --connect-vercel
```

For an organization-owned repo:

```bash
$env:GH_TOKEN = "<github-token>"
npm run github:create -- --org <org> --name judgemebro --push --connect-vercel
```

Without a token, create the repo through GitHub Desktop or the GitHub web UI. The local Git user is currently configured as `ChielSlotman`, so the expected personal repo URL would be:

```bash
https://github.com/ChielSlotman/judgemebro
```

Then add the remote from this local repo:

```bash
git remote add origin https://github.com/<owner>/judgemebro.git
git push -u origin main
```

Or use the checked-in helper:

```bash
npm run github:publish -- --remote https://github.com/<owner>/judgemebro.git --connect-vercel
```

`--connect-vercel` runs `vercel git connect` after the push so the linked Vercel project can receive GitHub-triggered builds.

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
- `npx playwright install --with-deps chromium`
- `npm run verify`

Manual workflows:

- `Vercel Deploy`: preview or production deployment through Vercel CLI.
- `Supabase Migrations`: dry-run first, then apply only when `apply=true`.

## Verification

After GitHub is connected:

```bash
npm run test:workflows
npm run check:providers
npm run setup:check
npm run launch:audit
```

Then verify GitHub Actions in the repository UI. The first CI run should pass before relying on GitHub-based deploys.
