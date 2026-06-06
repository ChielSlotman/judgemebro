import { judgeAnswers } from "./judgeEngine.js";

export async function requestJudgeVerdict(payload) {
  if (shouldUseLocalJudge()) {
    return {
      ...judgeAnswers(payload),
      judgeSource: "local-fallback",
    };
  }

  try {
    const response = await fetch("/api/judge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Judge API returned ${response.status}`);
    const data = await response.json();
    if (!data?.result) throw new Error("Judge API response missing result");
    return { ...data.result, judgeSource: "api" };
  } catch (error) {
    return {
      ...judgeAnswers(payload),
      judgeSource: "local-fallback",
      judgeError: error.message,
    };
  }
}

function shouldUseLocalJudge() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}
