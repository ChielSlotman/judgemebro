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

async function visibleText(page, text) {
  return page.getByText(text, { exact: false }).first().isVisible().catch(() => false);
}

async function assertAnyVisible(page, options, label) {
  for (const option of options) {
    if (await visibleText(page, option)) return option;
  }
  throw new Error(`Expected one visible text for ${label}: ${options.join(", ")}`);
}

async function assertLocatorText(page, selector, pattern, label) {
  const text = await page.locator(selector).innerText();
  if (!pattern.test(text)) throw new Error(`Expected ${label} to match ${pattern}, received: ${text}`);
}

async function clickButton(page, name) {
  const button = page.getByRole("button", { name });
  const count = await button.count();
  if (count !== 1) throw new Error(`Expected one "${name}" button, found ${count}`);
  await button.click();
}

async function startFriendBattleOrBot(page) {
  const startButton = page.getByRole("button", { name: "Start battle" });
  if (await startButton.isEnabled().catch(() => false)) {
    const clicked = await startButton.click({ timeout: 1_000 }).then(() => true).catch(() => false);
    if (clicked) {
      await page.waitForTimeout(500);
      if (await visibleText(page, "Submit to judge")) return "friend";
    }
  }

  await clickButton(page, "Play bot instead");
  await assertVisible(page, "Submit to judge", "friend battle fallback");
  return "bot";
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

    await page.goto(`${baseUrl}/terms`, { waitUntil: "load" });
    await assertVisible(page, "Terms and Conditions", "terms deep link");
    await page.goto(`${baseUrl}/privacy`, { waitUntil: "load" });
    await assertVisible(page, "Privacy Policy", "privacy deep link");
    await page.goto(`${baseUrl}/account`, { waitUntil: "load" });
    await assertVisible(page, "Log in", "account deep link");
    await page.goto(`${baseUrl}/auth/callback`, { waitUntil: "load" });
    await assertAnyVisible(
      page,
      ["Checking your sign-in session", "No active sign-in session found", "Signed in with Google"],
      "auth callback route",
    );
    await page.goto(`${baseUrl}/profile`, { waitUntil: "load" });
    await assertVisible(page, "Recent battles", "profile deep link");
    await page.goto(`${baseUrl}/rewards`, { waitUntil: "load" });
    await assertVisible(page, "Rewards", "rewards deep link");

    await page.goto(baseUrl, { waitUntil: "load" });
    await clickButton(page, /3-day streak.*extra battle/i);
    await assertVisible(page, "Rewards", "rewards screen");
    await clickButton(page, "Claim extra battle");
    await assertVisible(page, "Reward claimed", "claimed streak reward");
    await assertVisible(page, "New daily claim unlocks tomorrow", "daily reward reset copy");
    await page.goto(baseUrl, { waitUntil: "load" });
    await assertLocatorText(page, ".stats-row", /5\s+BATTLES LEFT TODAY/i, "home battles-left after reward");

    await page.goto(baseUrl, { waitUntil: "load" });
    await clickButton(page, "Open profile");
    await assertVisible(page, "Guest bro", "guest profile");
    await clickButton(page, "Account");
    await assertVisible(page, "Log in", "account login screen");
    await clickButton(page, "Use demo profile");
    await assertVisible(page, "Demo profile active", "demo profile status");

    await page.goto(baseUrl, { waitUntil: "load" });
    await clickButton(page, "Find opponent");
    await page.waitForTimeout(5_300);
    if (await visibleText(page, "Start quick battle")) {
      await clickButton(page, "Start quick battle");
    }
    await assertVisible(page, "Submit to judge", "battle submit");
    await page.getByPlaceholder("Type your answer...").fill(
      "That one makes me uncomfortable. Can you take it down and ask me before posting next time?",
    );
    await clickButton(page, "Submit to judge");
    await assertVisible(page, "Waiting for opponent", "waiting state");
    await page.waitForTimeout(2_200);
    await assertVisible(page, "AI judge has spoken", "verdict");
    await assertVisible(page, "You win", "win state");
    await assertVisible(page, "new rating 1146 Gold", "dynamic result rating");
    await clickButton(page, "Share verdict");
    await page.waitForTimeout(600);
    await assertAnyVisible(page, ["Copied verdict", "Shared verdict", "Verdict ready"], "share verdict feedback");
    await page.goto(baseUrl, { waitUntil: "load" });
    await clickButton(page, "Open profile");
    await assertVisible(page, "1W / 0L", "profile win/loss updated");
    await assertVisible(page, "Recent battles", "profile history");
    await assertVisible(page, "Social Drama", "profile history category");

    await page.goto(baseUrl, { waitUntil: "load" });
    await clickButton(page, "Challenge friend");
    await page.waitForTimeout(2_100);
    const friendLobbyState = await assertAnyVisible(
      page,
      ["Maya joined", "Friend joining..."],
      "friend lobby state",
    );
    if (friendLobbyState !== "Maya joined") {
      await assertVisible(page, "Room is live", "friend room waiting state");
    }
    await startFriendBattleOrBot(page);

    await page.goto(`${baseUrl}/battle/V7P2`, { waitUntil: "load" });
    await assertVisible(page, "Room V7P2", "friend deep link room");
    await assertAnyVisible(
      page,
      ["Maya joined", "Friend joining..."],
      "friend deep link lobby state",
    );
    await startFriendBattleOrBot(page);

    await page.goto(baseUrl, { waitUntil: "load" });
    await clickButton(page, "Find opponent");
    await page.waitForTimeout(5_300);
    if (await visibleText(page, "Bot fallback ready")) {
      await clickButton(page, /Smooth Talker/);
      await assertVisible(page, "Smooth Talker", "selected bot opponent");
    } else if (!(await visibleText(page, "Submit to judge"))) {
      await clickButton(page, "Start quick battle");
      await assertVisible(page, "Submit to judge", "ranked battle from live queue");
    }

    await page.goto(baseUrl, { waitUntil: "load" });
    await clickButton(page, "I am a streamer");
    await assertVisible(page, "Chat gets judged", "streamer dashboard");
    await clickButton(page, "Viewer link");
    await assertVisible(page, "Viewer answers", "copy link stays on streamer dashboard");
    await clickButton(page, "Preview viewer");
    await assertVisible(page, "Kai's room", "viewer room");
    await page.getByPlaceholder("Submit something stream-worthy...").fill(
      "No spark? I brought the lighter anyway.",
    );
    const viewerInsert = page
      .waitForResponse(
        (response) =>
          response.url().includes("/rest/v1/streamer_viewer_answers") &&
          response.request().method() === "POST",
        { timeout: 3_000 },
      )
      .catch(() => undefined);
    await clickButton(page, "Submit to streamer");
    await assertVisible(page, "Answer submitted", "viewer submitted");
    await viewerInsert;

    await page.goto(`${baseUrl}/stream/BRO9`, { waitUntil: "load" });
    await assertVisible(page, "Kai's room", "viewer deep link room");
    await assertVisible(page, "Room BRO9", "viewer deep link code");
    await assertAnyVisible(
      page,
      ["Connected to the live room", "Synced with the streamer room", "Preview mode", "Room not live yet", "Could not refresh room state"],
      "viewer room sync status",
    );

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
      (issue) =>
        !issue.includes("Download the React DevTools") &&
        !issue.includes("WebSocket is closed before the connection is established"),
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
