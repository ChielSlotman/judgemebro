import { existsSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function gitRemote() {
  const result = spawnSync("git", ["remote", "-v"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return (result.stdout ?? "").trim();
}

async function readEnvExample() {
  const envPath = join(root, ".env.local");
  if (!(await fileExists(envPath))) return {};
  const text = await readFile(envPath, "utf8");
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function printStatus(label, ok, detail = "") {
  const marker = ok ? "PASS" : "TODO";
  console.log(`${marker} ${label}${detail ? ` - ${detail}` : ""}`);
}

const env = await readEnvExample();
const vercel = commandExists("vercel");
const npxVercel = commandExists("npm", ["exec", "vercel", "--", "--version"]);
const gh = commandExists("gh");
const supabase = commandExists("supabase");
const npxSupabase = commandExists("npm", ["exec", "supabase", "--", "--version"]);
const remote = gitRemote();

printStatus("Git repository", existsSync(join(root, ".git")));
printStatus("Git remote configured", Boolean(remote), remote || "no remote");
printStatus(
  "Vercel CLI available",
  vercel.ok || npxVercel.ok,
  vercel.ok
    ? vercel.output.split(/\r?\n/)[0]
    : npxVercel.ok
      ? `npx/npm exec available: ${npxVercel.output.split(/\r?\n/).at(-1)}`
      : "install or use npx vercel",
);
printStatus("Vercel project linked", existsSync(join(root, ".vercel", "project.json")));
printStatus("GitHub CLI available", gh.ok, gh.ok ? gh.output.split(/\r?\n/)[0] : "install gh or push through GitHub Desktop/web");
printStatus(
  "Supabase CLI available",
  supabase.ok || npxSupabase.ok,
  supabase.ok
    ? supabase.output.split(/\r?\n/)[0]
    : npxSupabase.ok
      ? `npx/npm exec available: ${npxSupabase.output.split(/\r?\n/).at(-1)}`
      : "install Supabase CLI or use SQL editor",
);
printStatus("Supabase URL set", Boolean(env.VITE_SUPABASE_URL), ".env.local");
printStatus("Supabase publishable key set", Boolean(env.VITE_SUPABASE_PUBLISHABLE_KEY), ".env.local");
printStatus("Vercel config", existsSync(join(root, "vercel.json")));
printStatus("GitHub CI workflow", existsSync(join(root, ".github", "workflows", "ci.yml")));
printStatus("GitHub Vercel deploy workflow", existsSync(join(root, ".github", "workflows", "vercel-deploy.yml")));
printStatus("GitHub Supabase migration workflow", existsSync(join(root, ".github", "workflows", "supabase-migrations.yml")));
printStatus("Supabase migrations", existsSync(join(root, "supabase", "migrations")));
