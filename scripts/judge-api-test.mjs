import handler from "../api/judge.js";
import { judgeAnswers } from "../src/lib/judgeEngine.js";

function createResponse() {
  return {
    statusCode: null,
    headers: {},
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const validPayload = {
  mode: "ranked",
  category: { id: "business", name: "Business" },
  opponent: "Juno",
  prompt: 'A client says, "Your price is too high." What do you reply?',
  yourAnswer:
    "If price is the issue, I can reduce the scope, not the quality. What part matters most to you?",
  opponentAnswer: "I understand. I can give you a discount.",
};

delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_JUDGE_MODEL;
delete process.env.OPENAI_JUDGE_PROVIDER;
delete process.env.JUDGE_PROVIDER;
delete process.env.GROQ_API_KEY;
delete process.env.GROQ_JUDGE_MODEL;
delete process.env.OLLAMA_JUDGE_MODEL;
delete process.env.OLLAMA_JUDGE_URL;

const response = createResponse();
await handler({ method: "POST", body: validPayload }, response);

assert(response.statusCode === 200, `Expected 200, received ${response.statusCode}`);
assert(response.payload.result.youWin === true, "Expected strong answer to win");
assert(response.payload.result.points === 18, "Expected ranked win to award 18 points");
assert(response.payload.result.judgeModel === "local-deterministic-v1", "Expected deterministic judge model");

const invalidResponse = createResponse();
await handler({ method: "POST", body: { ...validPayload, yourAnswer: "x".repeat(281) } }, invalidResponse);

assert(invalidResponse.statusCode === 400, `Expected 400, received ${invalidResponse.statusCode}`);

const methodResponse = createResponse();
await handler({ method: "GET", body: validPayload }, methodResponse);

assert(methodResponse.statusCode === 405, `Expected 405, received ${methodResponse.statusCode}`);
assert(methodResponse.headers.Allow === "POST", "Expected Allow header to be POST");

const localResult = judgeAnswers(validPayload);
assert(localResult.youWin === true, "Expected local judge engine to match API outcome");

const originalFetch = globalThis.fetch;
const originalWarn = console.warn;
process.env.OPENAI_API_KEY = "test-key";
process.env.OPENAI_JUDGE_MODEL = "gpt-test";
globalThis.fetch = async (url, options) => {
  assert(String(url).includes("/v1/responses"), "Expected OpenAI Responses API URL");
  const body = JSON.parse(options.body);
  assert(body.text.format.type === "json_schema", "Expected structured output json schema");
  return {
    ok: true,
    json: async () => ({
      output_text: JSON.stringify({
        winner: "opponent",
        reason: "Opponent wins because their response is clearer and more practical in the moment.",
      }),
    }),
  };
};

const aiResponse = createResponse();
await handler({ method: "POST", body: validPayload }, aiResponse);
assert(aiResponse.statusCode === 200, `Expected 200, received ${aiResponse.statusCode}`);
assert(aiResponse.payload.result.youWin === false, "Expected mocked AI judge to choose opponent");
assert(aiResponse.payload.result.points === -18, "Expected ranked AI loss to subtract points");
assert(aiResponse.payload.result.judgeModel === "openai:gpt-test", "Expected OpenAI judge model");

delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_JUDGE_MODEL;
process.env.JUDGE_PROVIDER = "groq";
process.env.GROQ_API_KEY = "groq-test-key";
process.env.GROQ_JUDGE_MODEL = "llama-test";
globalThis.fetch = async (url, options) => {
  assert(String(url).includes("api.groq.com/openai/v1/chat/completions"), "Expected Groq chat completions URL");
  const body = JSON.parse(options.body);
  assert(body.model === "llama-test", "Expected configured Groq model");
  assert(body.response_format.type === "json_object", "Expected Groq JSON object mode");
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              winner: "you",
              reason: "You win because the response keeps value intact while offering a practical next step.",
            }),
          },
        },
      ],
    }),
  };
};

const groqResponse = createResponse();
await handler({ method: "POST", body: validPayload }, groqResponse);
assert(groqResponse.statusCode === 200, `Expected 200, received ${groqResponse.statusCode}`);
assert(groqResponse.payload.result.youWin === true, "Expected mocked Groq judge to choose you");
assert(groqResponse.payload.result.points === 18, "Expected ranked Groq win to add points");
assert(groqResponse.payload.result.judgeModel === "groq:llama-test", "Expected Groq judge model");

delete process.env.JUDGE_PROVIDER;
delete process.env.GROQ_API_KEY;
delete process.env.GROQ_JUDGE_MODEL;
process.env.JUDGE_PROVIDER = "ollama";
process.env.OLLAMA_JUDGE_MODEL = "text-judge-test";
globalThis.fetch = async (url, options) => {
  assert(String(url).includes("11434/api/chat"), "Expected Ollama chat API URL");
  const body = JSON.parse(options.body);
  assert(body.model === "text-judge-test", "Expected configured Ollama model");
  assert(body.format.type === "object", "Expected Ollama structured output schema");
  return {
    ok: true,
    json: async () => ({
      message: {
        content: JSON.stringify({
          winner: "you",
          reason: "You win because the response protects value while keeping the conversation open.",
        }),
      },
    }),
  };
};

const ollamaResponse = createResponse();
await handler({ method: "POST", body: validPayload }, ollamaResponse);
assert(ollamaResponse.statusCode === 200, `Expected 200, received ${ollamaResponse.statusCode}`);
assert(ollamaResponse.payload.result.youWin === true, "Expected mocked Ollama judge to choose you");
assert(ollamaResponse.payload.result.points === 18, "Expected ranked Ollama win to add points");
assert(ollamaResponse.payload.result.judgeModel === "ollama:text-judge-test", "Expected Ollama judge model");

delete process.env.JUDGE_PROVIDER;
delete process.env.OLLAMA_JUDGE_MODEL;
process.env.OPENAI_API_KEY = "test-key";
process.env.OPENAI_JUDGE_MODEL = "gpt-test";
globalThis.fetch = async () => ({
  ok: false,
  status: 500,
  text: async () => "model unavailable",
});
console.warn = () => {};

const fallbackResponse = createResponse();
await handler({ method: "POST", body: validPayload }, fallbackResponse);
assert(fallbackResponse.statusCode === 200, `Expected 200, received ${fallbackResponse.statusCode}`);
assert(fallbackResponse.payload.result.youWin === true, "Expected failed AI judge to fall back to local winner");
assert(
  fallbackResponse.payload.result.judgeModel === "local-deterministic-v1:fallback",
  "Expected failed AI judge fallback model",
);

globalThis.fetch = originalFetch;
console.warn = originalWarn;
delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_JUDGE_MODEL;
delete process.env.JUDGE_PROVIDER;
delete process.env.GROQ_API_KEY;
delete process.env.GROQ_JUDGE_MODEL;
delete process.env.OLLAMA_JUDGE_MODEL;
delete process.env.OLLAMA_JUDGE_URL;

console.log("Judge API contract passed");
