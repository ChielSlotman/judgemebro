import { judgeAnswers } from "../src/lib/judgeEngine.js";

const MAX_CHARS = 280;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const payload = request.body ?? {};
  const validationError = validatePayload(payload);
  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  const result = await judgeWithConfiguredProvider(payload);
  response.status(200).json({ result });
}

async function judgeWithConfiguredProvider(payload) {
  const localResult = judgeAnswers(payload);

  if (!shouldUseOpenAIJudge() || shouldSkipAiJudge(localResult)) {
    return localResult;
  }

  try {
    const aiVerdict = await requestOpenAIJudge(payload);
    const youWin = aiVerdict.winner === "you";
    const points = payload.mode === "bot" || payload.mode === "streamer" ? 0 : youWin ? 18 : -18;

    return {
      ...localResult,
      youWin,
      points,
      reason: aiVerdict.reason,
      judgeModel: `openai:${process.env.OPENAI_JUDGE_MODEL || DEFAULT_OPENAI_MODEL}`,
    };
  } catch (error) {
    console.warn("OpenAI judge failed, falling back to deterministic judge", error);
    return {
      ...localResult,
      judgeModel: `${localResult.judgeModel}:fallback`,
    };
  }
}

function shouldUseOpenAIJudge() {
  return Boolean(process.env.OPENAI_API_KEY) && process.env.OPENAI_JUDGE_PROVIDER !== "local";
}

function shouldSkipAiJudge(localResult) {
  return localResult.yourAnswer === "No answer submitted." || localResult.opponentAnswer === "No answer submitted.";
}

async function requestOpenAIJudge(payload) {
  const model = process.env.OPENAI_JUDGE_MODEL || DEFAULT_OPENAI_MODEL;
  const openAIResponse = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You are the fair judge for judgemebro.com, a fast 1v1 decision game. Pick the better short answer. Reward practical judgment, boundaries, clarity, confidence without cruelty, and a useful next step. Do not reward roasting, unsafe advice, manipulation, or empty bravado.",
        },
        {
          role: "user",
          content: JSON.stringify({
            mode: payload.mode ?? "ranked",
            category: payload.category,
            prompt: payload.prompt,
            you: payload.yourAnswer,
            opponentName: payload.opponent ?? "Opponent",
            opponent: payload.opponentAnswer,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "judge_verdict",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              winner: {
                type: "string",
                enum: ["you", "opponent"],
              },
              reason: {
                type: "string",
                minLength: 20,
                maxLength: 240,
              },
            },
            required: ["winner", "reason"],
          },
        },
      },
    }),
  });

  if (!openAIResponse.ok) {
    const errorText = await openAIResponse.text();
    throw new Error(`OpenAI judge HTTP ${openAIResponse.status}: ${errorText}`);
  }

  const responsePayload = await openAIResponse.json();
  const outputText = extractResponseText(responsePayload);
  const verdict = JSON.parse(outputText);

  if (!["you", "opponent"].includes(verdict.winner) || typeof verdict.reason !== "string") {
    throw new Error("OpenAI judge returned invalid verdict payload");
  }

  return verdict;
}

function extractResponseText(responsePayload) {
  if (typeof responsePayload.output_text === "string") return responsePayload.output_text;

  const outputText = responsePayload.output
    ?.flatMap((item) => item.content ?? [])
    ?.map((content) => content.text)
    ?.find((text) => typeof text === "string");

  if (!outputText) throw new Error("OpenAI judge response did not include output text");
  return outputText;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return "Missing JSON body";
  if (!payload.category || typeof payload.category !== "object") return "Missing category";
  if (typeof payload.category.id !== "string") return "Missing category id";
  if (typeof payload.category.name !== "string") return "Missing category name";
  if (typeof payload.prompt !== "string" || payload.prompt.length === 0) return "Missing prompt";
  if (typeof payload.yourAnswer !== "string") return "Missing yourAnswer";
  if (typeof payload.opponentAnswer !== "string") return "Missing opponentAnswer";
  if (payload.yourAnswer.length > MAX_CHARS) return "yourAnswer exceeds 280 characters";
  if (payload.opponentAnswer.length > MAX_CHARS) return "opponentAnswer exceeds 280 characters";
  if (payload.mode && !["ranked", "friend", "bot", "streamer"].includes(payload.mode)) return "Invalid mode";
  return null;
}
