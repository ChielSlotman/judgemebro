import { resolve4, resolveCname, resolveNs } from "node:dns/promises";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const apexDomain = "judgemebro.com";
const wwwDomain = "www.judgemebro.com";
const vercelIp = "76.76.21.21";
const vercelNameservers = ["ns1.vercel-dns.com", "ns2.vercel-dns.com"];
const requireReady = process.argv.includes("--require-ready");
const includeVercelInspect = process.argv.includes("--inspect-vercel");

async function resolveSafe(fn, domain) {
  try {
    return await fn(domain);
  } catch {
    return [];
  }
}

function normalize(record) {
  return record.replace(/\.$/, "").toLowerCase();
}

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

const [apexA, apexNs, wwwA, wwwCname] = await Promise.all([
  resolveSafe(resolve4, apexDomain),
  resolveSafe(resolveNs, apexDomain),
  resolveSafe(resolve4, wwwDomain),
  resolveSafe(resolveCname, wwwDomain),
]);

const normalizedNs = apexNs.map(normalize);
const usingVercelNameservers = vercelNameservers.every((server) => normalizedNs.includes(server));
const apexReady = apexA.includes(vercelIp) || usingVercelNameservers;
const wwwReady =
  wwwA.includes(vercelIp) ||
  wwwCname.some((record) => normalize(record).includes("vercel")) ||
  (wwwCname.some((record) => normalize(record) === apexDomain) && apexReady) ||
  usingVercelNameservers;
const hostingerParking = normalizedNs.some((server) => server.includes("dns-parking.com"));

console.log("Custom domain DNS check");
console.log("");
console.log("Expected DNS path:");
console.log(`- Recommended: A ${apexDomain} ${vercelIp}`);
console.log(`- Recommended for this Vercel project: A ${wwwDomain} ${vercelIp}`);
console.log(`- Alternative: move nameservers to ${vercelNameservers.join(", ")}`);
console.log("");
printStatus("Apex domain points to Vercel", apexReady, `A: ${apexA.join(", ") || "none"}`);
printStatus(
  "WWW domain points to Vercel",
  wwwReady,
  `A: ${wwwA.join(", ") || "none"}; CNAME: ${wwwCname.join(", ") || "none"}`,
);
printStatus(
  "Nameservers are not Hostinger parking",
  !hostingerParking,
  normalizedNs.join(", ") || "none",
);

if (includeVercelInspect) {
  console.log("");
  console.log("Vercel domain inspection");
  for (const domain of [apexDomain, wwwDomain]) {
    const result = run("npm", ["exec", "vercel", "--", "domains", "inspect", domain]);
    console.log("");
    console.log(`> vercel domains inspect ${domain}`);
    console.log(result.output || (result.ok ? "ok" : "failed"));
  }
}

if (requireReady && (!apexReady || !wwwReady || hostingerParking)) {
  console.error("Custom domain DNS is not ready yet.");
  process.exit(1);
}
