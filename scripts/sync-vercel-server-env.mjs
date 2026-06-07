import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const requiredKeys = ["OPENAI_API_KEY"];
const optionalDefaults = {
  OPENAI_JUDGE_MODEL: "gpt-4o-mini",
};
const environments = ["production", "preview", "development"];
const cliArgs = process.argv.slice(2);
const args = new Set(cliArgs);
const dryRun = args.has("--dry-run");
const envFileIndex = cliArgs.indexOf("--env-file");
const envFile = envFileIndex >= 0 ? cliArgs[envFileIndex + 1] : ".env.local";

function parseEnv(text) {
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

function run(command, commandArgs) {
  return spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

let env;
try {
  env = parseEnv(await readFile(envFile, "utf8"));
} catch {
  console.error(`Missing ${envFile}. Copy .env.example to .env.local and add server AI values first.`);
  process.exit(1);
}

const missing = requiredKeys.filter((key) => !env[key]);
if (missing.length) {
  console.error(`Missing required server env value${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
  process.exit(1);
}

for (const [key, defaultValue] of Object.entries(optionalDefaults)) {
  env[key] ||= defaultValue;
}

for (const key of [...requiredKeys, ...Object.keys(optionalDefaults)]) {
  if (key.startsWith("VITE_")) {
    console.error(`${key} is a client env key. This script only syncs server-only values.`);
    process.exit(1);
  }
}

for (const key of [...requiredKeys, ...Object.keys(optionalDefaults)]) {
  for (const environment of environments) {
    if (dryRun) {
      console.log(`DRY RUN ${key} -> ${environment}`);
      continue;
    }

    const commandArgs = [
      "exec",
      "vercel",
      "--",
      "env",
      "add",
      key,
      environment,
      "--value",
      env[key],
      "--yes",
      "--force",
    ];

    if (key === "OPENAI_API_KEY" && environment !== "development") {
      commandArgs.push("--sensitive");
    }

    const result = run("npm", commandArgs);

    if (result.status !== 0) {
      console.error(`Failed to sync ${key} to ${environment}`);
      console.error(`${result.stdout ?? ""}${result.stderr ?? ""}`.trim());
      process.exit(result.status ?? 1);
    }

    console.log(`Synced ${key} -> ${environment}`);
  }
}

console.log("Vercel server environment sync complete");
