import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const text = readFileSync(join(root, ".env.example"), "utf8");
const requiredKeys = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
const failures = [];

for (const key of requiredKeys) {
  const pattern = new RegExp(`^${key}=.+$`, "m");
  if (!pattern.test(text)) {
    failures.push(`.env.example is missing ${key}`);
  }
}

if (text.includes("SUPABASE_SERVICE_ROLE_KEY")) {
  failures.push(".env.example must not include SUPABASE_SERVICE_ROLE_KEY");
}

if (text.includes("sk_") || text.includes("eyJ")) {
  failures.push(".env.example appears to contain a real secret or JWT-like value");
}

if (failures.length) {
  console.error("Env example check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Env example check passed");
