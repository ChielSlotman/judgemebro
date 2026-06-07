import { resolve4, resolveCname } from "node:dns/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const vercelIp = "76.76.21.21";

function run(command, args) {
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

function printStatus(label, ok, detail = "") {
  const marker = ok ? "PASS" : "TODO";
  console.log(`${marker} ${label}${detail ? ` - ${detail}` : ""}`);
}

async function dnsState() {
  const result = {
    apexA: [],
    wwwA: [],
    wwwCname: [],
  };

  try {
    result.apexA = await resolve4("judgemebro.com");
  } catch {}

  try {
    result.wwwA = await resolve4("www.judgemebro.com");
  } catch {}

  try {
    result.wwwCname = await resolveCname("www.judgemebro.com");
  } catch {}

  return result;
}

const remote = run("git", ["remote", "-v"]);
const vercelWhoami = run("npm", ["exec", "vercel", "--", "whoami"]);
const vercelProject = run("npm", ["exec", "vercel", "--", "project", "inspect", "judgemebro"]);
const vercelEnv = run("npm", ["exec", "vercel", "--", "env", "ls"]);
const vercelAliases = run("npm", ["exec", "vercel", "--", "alias", "list"]);
const supabaseProjects = run("npm", ["exec", "supabase", "--", "projects", "list"]);
const dns = await dnsState();

const envOutput = vercelEnv.output;
const hasVercelSupabaseUrl = envOutput.includes("VITE_SUPABASE_URL");
const hasVercelSupabaseKey = envOutput.includes("VITE_SUPABASE_PUBLISHABLE_KEY");
const hasVercelOpenAiKey = envOutput.includes("OPENAI_API_KEY");
const hasVercelOpenAiModel = envOutput.includes("OPENAI_JUDGE_MODEL");
const hasApexAlias = vercelAliases.output.includes("judgemebro.com");
const hasWwwAlias = vercelAliases.output.includes("www.judgemebro.com");
const apexDnsReady = dns.apexA.includes(vercelIp);
const wwwDnsReady =
  dns.wwwA.includes(vercelIp) ||
  dns.wwwCname.some((record) => record.includes("vercel")) ||
  (dns.wwwCname.includes("judgemebro.com.") && apexDnsReady);

printStatus("Git remote configured", Boolean(remote.output), remote.output || "no remote");
printStatus("Vercel authenticated", vercelWhoami.ok, vercelWhoami.output.split(/\r?\n/)[0] || "not authenticated");
printStatus("Vercel project linked locally", existsSync(join(root, ".vercel", "project.json")));
printStatus("Vercel project exists", vercelProject.ok, vercelProject.ok ? "judgemebro" : "project inspect failed");
printStatus("Vercel apex alias attached", hasApexAlias, "judgemebro.com");
printStatus("Vercel www alias attached", hasWwwAlias, "www.judgemebro.com");
printStatus("Apex DNS points to Vercel", apexDnsReady, dns.apexA.join(", ") || "no A record");
printStatus(
  "WWW DNS points to Vercel",
  wwwDnsReady,
  `A: ${dns.wwwA.join(", ") || "none"}; CNAME: ${dns.wwwCname.join(", ") || "none"}`,
);
printStatus("Vercel Supabase URL env configured", hasVercelSupabaseUrl);
printStatus("Vercel Supabase publishable key env configured", hasVercelSupabaseKey);
printStatus("Vercel OpenAI API key env configured", hasVercelOpenAiKey);
printStatus("Vercel OpenAI judge model env configured", hasVercelOpenAiModel);
printStatus(
  "Supabase account authenticated",
  supabaseProjects.ok,
  supabaseProjects.ok ? "projects accessible" : "set SUPABASE_ACCESS_TOKEN or run supabase login",
);
