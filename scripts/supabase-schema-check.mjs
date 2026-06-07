import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");
const sourceDir = join(root, "src");
const configPath = join(root, "supabase", "config.toml");
const configText = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
const seedConfig = configText.match(/\[db\.seed\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? "";

const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const migrationSql = migrationFiles
  .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
  .join("\n\n")
  .toLowerCase();

const publicTables = [
  ...migrationSql.matchAll(/create\s+table\s+public\.([a-z0-9_]+)/g),
].map((match) => match[1]);

const requiredRealtimeTables = [
  "friend_battle_rooms",
  "streamer_rooms",
  "streamer_viewer_answers",
  "battle_results",
];

const failures = [];

for (const table of publicTables) {
  const rlsPattern = new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`);
  const policyPattern = new RegExp(`create\\s+policy\\s+["'][^"']+["']\\s+on\\s+public\\.${table}\\s+for\\s+`);

  if (!rlsPattern.test(migrationSql)) {
    failures.push(`Missing RLS enablement for public.${table}`);
  }

  if (!policyPattern.test(migrationSql)) {
    failures.push(`Missing policy for public.${table}`);
  }
}

for (const table of requiredRealtimeTables) {
  const realtimePattern = new RegExp(
    `alter\\s+publication\\s+supabase_realtime\\s+add\\s+table\\s+public\\.${table}`,
  );

  if (!realtimePattern.test(migrationSql)) {
    failures.push(`Missing Realtime publication entry for public.${table}`);
  }
}

const sourceFiles = readdirSync(sourceDir, { recursive: true })
  .filter((name) => String(name).endsWith(".js") || String(name).endsWith(".jsx"));

for (const file of sourceFiles) {
  const text = readFileSync(join(sourceDir, file), "utf8");
  if (text.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    failures.push(`Client source references server-only SUPABASE_SERVICE_ROLE_KEY: ${file}`);
  }
}

if (publicTables.length === 0) {
  failures.push("No public tables found in Supabase migrations");
}

if (!configText) {
  failures.push("Missing supabase/config.toml");
}

if (!configText.includes('project_id = "judgemebro"')) {
  failures.push('supabase/config.toml must set project_id = "judgemebro"');
}

if (!configText.includes('site_url = "http://127.0.0.1:5173"')) {
  failures.push("supabase/config.toml auth.site_url must match the local Vite dev URL");
}

if (!configText.includes('"https://judgemebro.vercel.app"')) {
  failures.push("supabase/config.toml auth redirects must include the live Vercel URL");
}

if (!configText.includes('"https://judgemebro.com"') || !configText.includes('"https://www.judgemebro.com"')) {
  failures.push("supabase/config.toml auth redirects must include custom domains");
}

if (!seedConfig.includes("enabled = false")) {
  failures.push("supabase/config.toml should keep db.seed disabled until seed.sql exists");
}

if (failures.length) {
  console.error("Supabase schema check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Supabase schema check passed for ${publicTables.length} public tables`);
