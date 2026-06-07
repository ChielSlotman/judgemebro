import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const port = process.env.SMOKE_PORT || "4173";
const baseUrl = `http://127.0.0.1:${port}`;
const artifactsDir = join(root, "docs", "qa");

mkdirSync(artifactsDir, { recursive: true });

function localChromePath() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function startPreview() {
  const viteBin = join(root, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(
    process.execPath,
    [viteBin, "preview", "--host", "127.0.0.1", "--port", port, "--strictPort"],
    {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return { child, getOutput: () => output };
}

async function waitForServer(url, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until the preview server is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Preview server did not respond at ${url}`);
}

async function assertVisible(page, text, label = text) {
  const visible = await page.getByText(text, { exact: false }).first().isVisible();
  if (!visible) throw new Error(`Expected visible text: ${label}`);
}

async function clickButton(page, name) {
  const button = page.getByRole("button", { name });
  const count = await button.count();
  if (count !== 1) throw new Error(`Expected one "${name}" button, found ${count}`);
  await button.click();
}

async function run() {
  const preview = startPreview();
  let browser;

  try {
    await waitForServer(baseUrl);

    const executablePath = localChromePath();
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleIssues = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleIssues.push(`${message.type()}: ${message.text()}`);
      }
    });

    await page.goto(baseUrl, { waitUntil: "load" });
    await assertVisible(page, "judgemebro", "brand");
    await assertVisible(page, "Find opponent", "primary CTA");

    await clickButton(page, "Find opponent");
    await page.waitForTimeout(5_300);
    await assertVisible(page, "Play a bot now", "bot fallback");
    await clickButton(page, "Enter real battle");
    await assertVisible(page, "Submit to judge", "battle submit");
    await page.getByPlaceholder("Type your answer...").fill(
      "That one makes me uncomfortable. Can you take it down and ask me before posting next time?",
    );
    await clickButton(page, "Submit to judge");
    await assertVisible(page, "Waiting for opponent", "waiting state");
    await page.waitForTimeout(2_200);
    await assertVisible(page, "AI judge has spoken", "verdict");
    await assertVisible(page, "You win", "win state");

    await page.goto(baseUrl, { waitUntil: "load" });
    await clickButton(page, "Challenge friend");
    await page.waitForTimeout(2_100);
    await assertVisible(page, "Maya joined", "friend joined");
    await clickButton(page, "Start battle");
    await assertVisible(page, "Submit to judge", "friend battle");

    await page.goto(`${baseUrl}/battle/V7P2`, { waitUntil: "load" });
    await assertVisible(page, "Room V7P2", "friend deep link room");
    await assertVisible(page, "Maya joined", "friend deep link joined");
    await clickButton(page, "Start battle");
    await assertVisible(page, "Submit to judge", "friend deep link battle");

    await page.goto(baseUrl, { waitUntil: "load" });
    await clickButton(page, "Find opponent");
    await page.waitForTimeout(5_300);
    await clickButton(page, "Play a bot now");
    await assertVisible(page, "Cold CEO", "bot opponent");

    await page.goto(baseUrl, { waitUntil: "load" });
    await clickButton(page, "I am a streamer");
    await assertVisible(page, "Chat gets judged", "streamer dashboard");
    await clickButton(page, "Viewer link");
    await assertVisible(page, "Kai's room", "viewer room");
    await page.getByPlaceholder("Submit something stream-worthy...").fill(
      "No spark? I brought the lighter anyway.",
    );
    await clickButton(page, "Submit to streamer");
    await assertVisible(page, "Answer submitted", "viewer submitted");

    await page.goto(`${baseUrl}/stream/BRO9`, { waitUntil: "load" });
    await assertVisible(page, "Kai's room", "viewer deep link room");
    await assertVisible(page, "Room BRO9", "viewer deep link code");

    await page.goto(baseUrl, { waitUntil: "load" });
    await clickButton(page, "I am a streamer");
    const officialButtons = page.getByRole("button", { name: "Pick official" });
    const officialCount = await officialButtons.count();
    if (officialCount < 1) throw new Error("Expected at least one Pick official button");
    await officialButtons.first().click();
    await assertVisible(page, "AI judge has spoken", "official battle verdict");

    await page.screenshot({
      path: join(artifactsDir, "smoke-test-final.png"),
      fullPage: true,
    });

    const relevantIssues = consoleIssues.filter(
      (issue) => !issue.includes("Download the React DevTools"),
    );
    if (relevantIssues.length > 0) {
      throw new Error(`Console issues:\n${relevantIssues.join("\n")}`);
    }
  } finally {
    if (browser) await browser.close();
    preview.child.kill();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
