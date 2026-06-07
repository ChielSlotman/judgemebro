import { judgeAnswers } from "../src/lib/judgeEngine.js";

const MAX_CHARS = 280;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const DEFAULT_OLLAMA_MODEL = "text-judge";

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

  if (shouldSkipAiJudge(localResult)) {
    return localResult;
  }

  if (shouldUseOllamaJudge()) {
    return judgeWithProvider({
      payload,
      localResult,
      providerName: "Ollama judge",
      modelName: `ollama:${process.env.OLLAMA_JUDGE_MODEL || DEFAULT_OLLAMA_MODEL}`,
      requestVerdict: requestOllamaJudge,
    });
  }

  if (shouldUseGroqJudge()) {
    return judgeWithProvider({
      payload,
      localResult,
      providerName: "Groq judge",
      modelName: `groq:${process.env.GROQ_JUDGE_MODEL || DEFAULT_GROQ_MODEL}`,
      requestVerdict: requestGroqJudge,
    });
  }

  if (!shouldUseOpenAIJudge()) {
    return localResult;
  }

  return judgeWithProvider({
    payload,
    localResult,
    providerName: "OpenAI judge",
    modelName: `openai:${process.env.OPENAI_JUDGE_MODEL || DEFAULT_OPENAI_MODEL}`,
    requestVerdict: requestOpenAIJudge,
  });
}

async function judgeWithProvider({ payload, localResult, providerName, modelName, requestVerdict }) {
  try {
    const aiVerdict = await requestVerdict(payload);
    const youWin = aiVerdict.winner === "you";
    const points = payload.mode === "bot" || payload.mode === "streamer" ? 0 : youWin ? 18 : -18;

    return {
      ...localResult,
      youWin,
      points,
      reason: aiVerdict.reason,
      judgeModel: modelName,
    };
  } catch (error) {
    console.warn(`${providerName} failed, falling back to deterministic judge`, error);
    return {
      ...localResult,
      judgeModel: `${localResult.judgeModel}:fallback`,
    };
  }
}

function shouldUseOpenAIJudge() {
  return Boolean(process.env.OPENAI_API_KEY) && providerName() === "openai";
}

function shouldUseGroqJudge() {
  return Boolean(process.env.GROQ_API_KEY) && providerName() === "groq";
}

function shouldUseOllamaJudge() {
  return providerName() === "ollama";
}

function providerName() {
  return (
    process.env.JUDGE_PROVIDER ||
    process.env.OPENAI_JUDGE_PROVIDER ||
    (process.env.GROQ_API_KEY ? "groq" : process.env.OPENAI_API_KEY ? "openai" : "local")
  )
    .toLowerCase()
    .trim();
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

async function requestGroqJudge(payload) {
  const model = process.env.GROQ_JUDGE_MODEL || DEFAULT_GROQ_MODEL;
  const groqResponse = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content:
            "You are the fair judge for judgemebro.com, a fast 1v1 decision game. Pick the better short answer. Reward practical judgment, boundaries, clarity, confidence without cruelty, and a useful next step. Do not reward roasting, unsafe advice, manipulation, or empty bravado. Return JSON only with winner and reason.",
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
    }),
  });

  if (!groqResponse.ok) {
    const errorText = await groqResponse.text();
    throw new Error(`Groq judge HTTP ${groqResponse.status}: ${errorText}`);
  }

  const responsePayload = await groqResponse.json();
  const outputText = responsePayload.choices?.[0]?.message?.content;
  const verdict = JSON.parse(outputText);

  if (!["you", "opponent"].includes(verdict.winner) || typeof verdict.reason !== "string") {
    throw new Error("Groq judge returned invalid verdict payload");
  }

  return verdict;
}

async function requestOllamaJudge(payload) {
  const model = process.env.OLLAMA_JUDGE_MODEL || DEFAULT_OLLAMA_MODEL;
  const ollamaResponse = await fetch(process.env.OLLAMA_JUDGE_URL || DEFAULT_OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: judgeVerdictSchema(),
      options: {
        temperature: 0,
      },
      messages: [
        {
          role: "system",
          content:
            "You are the fair judge for judgemebro.com, a fast 1v1 decision game. Pick the better short answer. Reward practical judgment, boundaries, clarity, confidence without cruelty, and a useful next step. Do not reward roasting, unsafe advice, manipulation, or empty bravado. Return JSON only.",
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
    }),
  });

  if (!ollamaResponse.ok) {
    const errorText = await ollamaResponse.text();
    throw new Error(`Ollama judge HTTP ${ollamaResponse.status}: ${errorText}`);
  }

  const responsePayload = await ollamaResponse.json();
  const outputText = responsePayload.message?.content;
  const verdict = JSON.parse(outputText);

  if (!["you", "opponent"].includes(verdict.winner) || typeof verdict.reason !== "string") {
    throw new Error("Ollama judge returned invalid verdict payload");
  }

  return verdict;
}

function judgeVerdictSchema() {
  return {
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
  };
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
