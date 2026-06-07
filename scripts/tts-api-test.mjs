import handler from "../api/tts.js";

function createResponse() {
  return {
    statusCode: null,
    headers: {},
    payload: null,
    body: null,
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
    send(body) {
      this.body = body;
      return this;
    },
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

process.env.TTS_PROVIDER = "groq";
process.env.GROQ_API_KEY = "groq-test-key";
process.env.GROQ_TTS_MODEL = "canopylabs/orpheus-v1-english";
process.env.GROQ_TTS_VOICE = "troy";
delete process.env.OPENAI_API_KEY;

globalThis.fetch = async (url, options) => {
  assert(String(url).includes("api.groq.com/openai/v1/audio/speech"), "Expected Groq speech endpoint");
  const body = JSON.parse(options.body);
  assert(body.model === "canopylabs/orpheus-v1-english", "Expected Orpheus model");
  assert(body.voice === "troy", "Expected Troy voice");
  assert(body.input.includes("light funny accent"), "Expected commentator accent style");
  assert(body.response_format === "wav", "Expected Groq wav response");
  return {
    ok: true,
    arrayBuffer: async () => new Uint8Array([82, 73, 70, 70]).buffer,
  };
};

const response = createResponse();
await handler({ method: "POST", body: { input: "You win. Plus 18 points. Better answer." } }, response);

assert(response.statusCode === 200, `Expected 200, received ${response.statusCode}`);
assert(response.headers["Content-Type"] === "audio/wav", "Expected wav content type");
assert(Buffer.isBuffer(response.body), "Expected binary audio response");

delete process.env.GROQ_API_KEY;
process.env.OPENAI_API_KEY = "openai-test-key";

const noGroqResponse = createResponse();
await handler({ method: "POST", body: { input: "Do not fall back." } }, noGroqResponse);

assert(noGroqResponse.statusCode === 500, "Expected no OpenAI fallback when Groq TTS is configured");

globalThis.fetch = originalFetch;
process.env = originalEnv;

console.log("TTS API contract passed");
