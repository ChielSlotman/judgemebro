import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const connectVercel = args.includes("--connect-vercel");
const remoteIndex = args.indexOf("--remote");
const remoteUrl = remoteIndex >= 0 ? args[remoteIndex + 1] : "";

function run(command, commandArgs) {
  const printable = [command, ...commandArgs].join(" ");

  if (dryRun) {
    console.log(`DRY RUN ${printable}`);
    return { ok: true, output: "" };
  }

  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
    command: printable,
  };
}

function requireOk(result) {
  if (result.ok) return;
  console.error(`Command failed: ${result.command}`);
  if (result.output) console.error(result.output);
  process.exit(1);
}

if (!remoteUrl) {
  console.error("Missing --remote. Example: npm run github:publish -- --remote https://github.com/<owner>/judgemebro.git");
  process.exit(1);
}

if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\.git$/.test(remoteUrl)) {
  console.error("Remote must look like https://github.com/<owner>/<repo>.git");
  process.exit(1);
}

const existingRemote = spawnSync("git", ["remote", "get-url", "origin"], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (existingRemote.status === 0) {
  const current = existingRemote.stdout.trim();
  if (current !== remoteUrl) {
    console.error(`origin already points to ${current}`);
    console.error("Update it manually if you intentionally want a different GitHub repository.");
    process.exit(1);
  }

  console.log(`origin already configured: ${remoteUrl}`);
} else {
  requireOk(run("git", ["remote", "add", "origin", remoteUrl]));
}

requireOk(run("git", ["push", "-u", "origin", "main"]));

if (connectVercel) {
  requireOk(run("npm", ["exec", "vercel", "--", "git", "connect", remoteUrl]));
}

console.log("GitHub publish flow complete");
