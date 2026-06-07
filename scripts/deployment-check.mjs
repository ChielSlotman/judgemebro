import { resolve4, resolveCname } from "node:dns/promises";

const productionUrl = "https://judgemebro.vercel.app";
const apexDomain = "judgemebro.com";
const wwwDomain = "www.judgemebro.com";
const vercelApexIp = "76.76.21.21";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readDns() {
  const result = {
    apexA: [],
    wwwA: [],
    wwwCname: [],
  };

  try {
    result.apexA = await resolve4(apexDomain);
  } catch {}

  try {
    result.wwwA = await resolve4(wwwDomain);
  } catch {}

  try {
    result.wwwCname = await resolveCname(wwwDomain);
  } catch {}

  return result;
}

const htmlResponse = await fetch(productionUrl);
assert(htmlResponse.ok, `Expected live app 200, received ${htmlResponse.status}`);

const html = await htmlResponse.text();
assert(html.includes("root"), "Expected deployed app shell to include root element");

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

assert(judgeResponse.ok, `Expected judge API 200, received ${judgeResponse.status}`);

const judgePayload = await judgeResponse.json();
assert(judgePayload.result?.youWin === true, "Expected stronger answer to win");
assert(judgePayload.result?.points === 18, "Expected ranked win to award 18 points");

const dns = await readDns();
const apexConfigured = dns.apexA.includes(vercelApexIp);
const wwwConfigured =
  dns.wwwA.includes(vercelApexIp) ||
  dns.wwwCname.some((record) => record.includes("vercel")) ||
  (dns.wwwCname.includes(`${apexDomain}.`) && apexConfigured);

console.log("Deployment check passed");
console.log(`- app: ${productionUrl}`);
console.log("- judge API: ok");
console.log(`- ${apexDomain} DNS: ${apexConfigured ? "configured" : `pending (${dns.apexA.join(", ") || "no A record"})`}`);
console.log(
  `- ${wwwDomain} DNS: ${
    wwwConfigured
      ? "configured"
      : `pending (A: ${dns.wwwA.join(", ") || "none"}; CNAME: ${dns.wwwCname.join(", ") || "none"})`
  }`,
);
