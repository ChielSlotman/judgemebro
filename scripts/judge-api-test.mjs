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

const response = createResponse();
handler({ method: "POST", body: validPayload }, response);

assert(response.statusCode === 200, `Expected 200, received ${response.statusCode}`);
assert(response.payload.result.youWin === true, "Expected strong answer to win");
assert(response.payload.result.points === 18, "Expected ranked win to award 18 points");
assert(response.payload.result.judgeModel === "local-deterministic-v1", "Expected deterministic judge model");

const invalidResponse = createResponse();
handler({ method: "POST", body: { ...validPayload, yourAnswer: "x".repeat(281) } }, invalidResponse);

assert(invalidResponse.statusCode === 400, `Expected 400, received ${invalidResponse.statusCode}`);

const methodResponse = createResponse();
handler({ method: "GET", body: validPayload }, methodResponse);

assert(methodResponse.statusCode === 405, `Expected 405, received ${methodResponse.statusCode}`);
assert(methodResponse.headers.Allow === "POST", "Expected Allow header to be POST");

const localResult = judgeAnswers(validPayload);
assert(localResult.youWin === true, "Expected local judge engine to match API outcome");

console.log("Judge API contract passed");
