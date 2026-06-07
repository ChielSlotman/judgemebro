import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredDocs = [
  "docs/deployment.md",
  "docs/supabase.md",
  "docs/github.md",
  "docs/creative-production.md",
  "design-qa.md",
];

const readme = readFileSync(join(root, "README.md"), "utf8");
const failures = [];

for (const doc of requiredDocs) {
  if (!existsSync(join(root, doc))) {
    failures.push(`Missing ${doc}`);
  }

  if (!readme.includes(doc)) {
    failures.push(`README.md does not reference ${doc}`);
  }
}

if (failures.length) {
  console.error("Docs check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Docs check passed for ${requiredDocs.length} handoff documents`);
