import { resolve4, resolveCname } from "node:dns/promises";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const productionUrl = "https://judgemebro.vercel.app";
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

async function readLocalEnv() {
  try {
    const text = await readFile(join(root, ".env.local"), "utf8");
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
  } catch {
    return {};
  }
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

async function liveDeploymentReady() {
  try {
    const htmlResponse = await fetch(productionUrl);
    if (!htmlResponse.ok) return false;

    const judgeResponse = await fetch(`${productionUrl}/api/judge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "ranked",
        category: { id: "business", name: "Business" },
        opponent: "Juno",
        prompt: 'A client says, "Your price is too high." What do you reply?',
        yourAnswer:
          "If price is the issue, I can reduce the scope, not the quality. What part matters most to you?",
        opponentAnswer: "I understand. I can give you a discount.",
      }),
    });
    if (!judgeResponse.ok) return false;

    const payload = await judgeResponse.json();
    return payload.result?.youWin === true && payload.result?.points === 18;
  } catch {
    return false;
  }
}

const localEnv = await readLocalEnv();
const localAiProvider = (localEnv.JUDGE_PROVIDER || "").toLowerCase();
const dns = await dnsState();
const gitRemote = run("git", ["remote", "-v"]);
const vercelWhoami = run("npm", ["exec", "vercel", "--", "whoami"]);
const vercelProject = run("npm", ["exec", "vercel", "--", "project", "inspect", "judgemebro"]);
const vercelEnv = run("npm", ["exec", "vercel", "--", "env", "ls"]);
const vercelAliases = run("npm", ["exec", "vercel", "--", "alias", "list"]);
const supabaseProjects = run("npm", ["exec", "supabase", "--", "projects", "list"]);

const checks = [
  {
    label: "Git remote configured",
    ok: Boolean(gitRemote.output),
    detail: gitRemote.output || "no remote",
  },
  {
    label: "Live Vercel deployment ready",
    ok: await liveDeploymentReady(),
    detail: productionUrl,
  },
  {
    label: "Vercel authenticated",
    ok: vercelWhoami.ok,
    detail: vercelWhoami.output.split(/\r?\n/)[0] || "not authenticated",
  },
  {
    label: "Vercel project linked",
    ok: existsSync(join(root, ".vercel", "project.json")) && vercelProject.ok,
    detail: "judgemebro",
  },
  {
    label: "Vercel custom aliases attached",
    ok:
      vercelAliases.output.includes("judgemebro.com") &&
      vercelAliases.output.includes("www.judgemebro.com"),
    detail: "judgemebro.com, www.judgemebro.com",
  },
  {
    label: "Apex DNS points to Vercel",
    ok: dns.apexA.includes(vercelIp),
    detail: dns.apexA.join(", ") || "no A record",
  },
  {
    label: "WWW DNS points to Vercel",
    ok:
      dns.wwwA.includes(vercelIp) ||
      dns.wwwCname.some((record) => record.includes("vercel")) ||
      (dns.wwwCname.includes("judgemebro.com.") && dns.apexA.includes(vercelIp)),
    detail: `A: ${dns.wwwA.join(", ") || "none"}; CNAME: ${dns.wwwCname.join(", ") || "none"}`,
  },
  {
    label: "Local Supabase URL configured",
    ok: Boolean(localEnv.VITE_SUPABASE_URL),
    detail: ".env.local",
  },
  {
    label: "Local Supabase publishable key configured",
    ok: Boolean(localEnv.VITE_SUPABASE_PUBLISHABLE_KEY),
    detail: ".env.local",
  },
  {
    label: "Local AI judge configured",
    ok:
      Boolean(localEnv.OPENAI_API_KEY) ||
      (localAiProvider === "groq" && Boolean(localEnv.GROQ_API_KEY) && Boolean(localEnv.GROQ_JUDGE_MODEL)) ||
      (localAiProvider === "ollama" && Boolean(localEnv.OLLAMA_JUDGE_URL) && Boolean(localEnv.OLLAMA_JUDGE_MODEL)),
    detail: localAiProvider || ".env.local",
  },
  {
    label: "Vercel Supabase URL env configured",
    ok: vercelEnv.output.includes("VITE_SUPABASE_URL"),
    detail: "vercel env ls",
  },
  {
    label: "Vercel Supabase publishable key env configured",
    ok: vercelEnv.output.includes("VITE_SUPABASE_PUBLISHABLE_KEY"),
    detail: "vercel env ls",
  },
  {
    label: "Vercel hosted AI API key env configured",
    ok: vercelEnv.output.includes("GROQ_API_KEY") || vercelEnv.output.includes("OPENAI_API_KEY"),
    detail: "vercel env ls",
  },
  {
    label: "Vercel hosted AI judge model env configured",
    ok: vercelEnv.output.includes("GROQ_JUDGE_MODEL") || vercelEnv.output.includes("OPENAI_JUDGE_MODEL"),
    detail: "vercel env ls",
  },
  {
    label: "Supabase account authenticated",
    ok: supabaseProjects.ok,
    detail: supabaseProjects.ok ? "projects accessible" : "set SUPABASE_ACCESS_TOKEN or run supabase login",
  },
];

let failed = 0;
for (const check of checks) {
  const marker = check.ok ? "PASS" : "TODO";
  if (!check.ok) failed += 1;
  console.log(`${marker} ${check.label}${check.detail ? ` - ${check.detail}` : ""}`);
}

if (failed > 0) {
  console.error(`Launch audit incomplete: ${failed} item${failed === 1 ? "" : "s"} remaining`);
  process.exit(1);
}

console.log("Launch audit passed");
