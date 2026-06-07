import { spawnSync } from "node:child_process";

const cliArgs = process.argv.slice(2);
const args = new Set(cliArgs);
const planOnly = args.has("--plan-only");
const dryRun = args.has("--dry-run");
const apply = args.has("--apply");
const projectRefIndex = cliArgs.indexOf("--project-ref");
const projectRef = projectRefIndex >= 0 ? cliArgs[projectRefIndex + 1] : process.env.SUPABASE_PROJECT_REF;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

function runSupabase(commandArgs, options = {}) {
  const printable = ["supabase", ...commandArgs.map((arg) => (arg === dbPassword ? "<SUPABASE_DB_PASSWORD>" : arg))].join(" ");

  if (planOnly) {
    console.log(`PLAN ${printable}`);
    return { ok: true };
  }

  const direct = spawnSync("supabase", commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: options.stdio ?? "pipe",
  });

  if (direct.status === 0) return { ok: true, output: `${direct.stdout ?? ""}${direct.stderr ?? ""}`.trim() };

  const fallback = spawnSync("npm", ["exec", "supabase", "--", ...commandArgs], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: options.stdio ?? "pipe",
  });

  return {
    ok: fallback.status === 0,
    output: `${fallback.stdout ?? ""}${fallback.stderr ?? ""}`.trim(),
    command: printable,
    status: fallback.status,
  };
}

function requireOk(result) {
  if (result.ok) return;
  console.error(`Command failed: ${result.command}`);
  if (result.output) console.error(result.output);
  process.exit(result.status ?? 1);
}

if (!dryRun && !apply && !planOnly) {
  console.error("Choose one mode: --dry-run, --apply, or --plan-only");
  process.exit(1);
}

if (dryRun && apply) {
  console.error("Use either --dry-run or --apply, not both");
  process.exit(1);
}

if (!projectRef) {
  console.error("Missing Supabase project ref. Pass --project-ref <ref> or set SUPABASE_PROJECT_REF.");
  process.exit(1);
}

if (!planOnly && !dbPassword) {
  console.error("Missing SUPABASE_DB_PASSWORD. Set it before running real Supabase migration commands.");
  process.exit(1);
}

const passwordArgs = dbPassword ? ["--password", dbPassword] : [];

requireOk(runSupabase(["link", "--project-ref", projectRef, ...passwordArgs]));

if (apply) {
  requireOk(runSupabase(["db", "push", "--linked", ...passwordArgs], { stdio: "inherit" }));
  console.log("Supabase migrations applied");
} else {
  requireOk(runSupabase(["db", "push", "--linked", "--dry-run", ...passwordArgs], { stdio: "inherit" }));
  console.log("Supabase migration dry run complete");
}
