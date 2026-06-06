import { judgeAnswers } from "../src/lib/judgeEngine.js";

const MAX_CHARS = 280;

export default function handler(request, response) {
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

  const result = judgeAnswers(payload);
  response.status(200).json({ result });
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
