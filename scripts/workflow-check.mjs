import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const workflowChecks = [
  {
    file: ".github/workflows/ci.yml",
    requirements: [
      "npm ci",
      "node-version: 24",
      "npx playwright install --with-deps chromium",
      "npm run verify",
    ],
  },
  {
    file: ".github/workflows/vercel-deploy.yml",
    requirements: [
      "workflow_dispatch",
      "VERCEL_TOKEN",
      "VERCEL_ORG_ID",
      "VERCEL_PROJECT_ID",
      "node-version: 24",
      "npm run build",
      "npm run test:judge",
      "npm run test:supabase",
      "npm run test:supabase-migrate",
      "npm run test:workflows",
      "npm run test:docs",
      "npm run test:env-example",
      "npm run test:vercel-env-sync",
      "npm run test:github-create",
      "npm run test:github-publish",
      "pull --yes",
      "build ${{ inputs.production",
      "deploy --prebuilt",
    ],
  },
  {
    file: ".github/workflows/supabase-migrations.yml",
    requirements: [
      "workflow_dispatch",
      "SUPABASE_ACCESS_TOKEN",
      "SUPABASE_DB_PASSWORD",
      "SUPABASE_PROJECT_REF",
      "node-version: 24",
      "supabase/setup-cli@v2",
      "npm run test:supabase",
      "npm run test:supabase-migrate",
      "npm run supabase:migrate",
      "--dry-run",
      "--apply",
      "inputs.apply == 'true'",
    ],
  },
];

const failures = [];

for (const check of workflowChecks) {
  const text = readFileSync(join(root, check.file), "utf8");
  for (const requirement of check.requirements) {
    if (!text.includes(requirement)) {
      failures.push(`${check.file} is missing "${requirement}"`);
    }
  }
}

if (failures.length) {
  console.error("Workflow check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Workflow check passed for ${workflowChecks.length} GitHub workflows`);
