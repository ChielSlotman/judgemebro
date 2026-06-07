import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const push = args.includes("--push");
const connectVercel = args.includes("--connect-vercel");

function valueFor(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}

const name = valueFor("--name", "judgemebro");
const description = valueFor(
  "--description",
  "Fast 1v1 AI dilemma game where the best decision wins.",
);
const org = valueFor("--org");
const isPrivate = args.includes("--private");
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

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
    command: printable,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

function requireOk(result) {
  if (result.ok) return;
  console.error(`Command failed: ${result.command}`);
  if (result.output) console.error(result.output);
  process.exit(1);
}

function remoteUrl() {
  const result = spawnSync("git", ["remote", "get-url", "origin"], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  return result.status === 0 ? result.stdout.trim() : "";
}

async function createRepository() {
  const endpoint = org
    ? `https://api.github.com/orgs/${org}/repos`
    : "https://api.github.com/user/repos";

  const body = {
    name,
    description,
    private: isPrivate,
    has_issues: true,
    has_projects: false,
    has_wiki: false,
    auto_init: false,
  };

  if (dryRun) {
    console.log(`DRY RUN POST ${endpoint}`);
    console.log(JSON.stringify(body, null, 2));
    return {
      full_name: org ? `${org}/${name}` : `<authenticated-user>/${name}`,
      clone_url: `https://github.com/${org || "<authenticated-user>"}/${name}.git`,
      html_url: `https://github.com/${org || "<authenticated-user>"}/${name}`,
    };
  }

  if (!token) {
    console.error("Missing GH_TOKEN or GITHUB_TOKEN.");
    console.error("Create a GitHub fine-grained token with repository creation permission, then rerun this command.");
    process.exit(1);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(`GitHub repository creation failed: ${response.status}`);
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  return payload;
}

const existingRemote = remoteUrl();
if (existingRemote) {
  console.log(`origin already configured: ${existingRemote}`);
  process.exit(0);
}

const repository = await createRepository();
const cloneUrl = repository.clone_url;

requireOk(run("git", ["remote", "add", "origin", cloneUrl]));

if (push) {
  requireOk(run("git", ["push", "-u", "origin", "main"]));
}

if (connectVercel) {
  requireOk(run("npm", ["exec", "vercel", "--", "git", "connect", cloneUrl]));
}

console.log(`GitHub repository ready: ${repository.html_url}`);
