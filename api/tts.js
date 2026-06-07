const MAX_OPENAI_TTS_CHARS = 900;
const MAX_GROQ_TTS_CHARS = 190;
const DEFAULT_OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_OPENAI_TTS_VOICE = "onyx";
const DEFAULT_GROQ_TTS_MODEL = "canopylabs/orpheus-v1-english";
const DEFAULT_GROQ_TTS_VOICE = "troy";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
    response.status(503).json({ error: "Hosted TTS is not configured" });
    return;
  }

  const input = typeof request.body?.input === "string" ? request.body.input.trim() : "";
  if (!input) {
    response.status(400).json({ error: "input required" });
    return;
  }

  try {
    const providerResults = await createSpeech(input);
    const { speechResponse, contentType, provider } = providerResults;

    if (!speechResponse.ok) {
      const errorText = await speechResponse.text();
      response.status(502).json({
        error: `TTS provider failed: ${speechResponse.status}`,
        provider,
        detail: errorText.slice(0, 500),
      });
      return;
    }

    const audio = Buffer.from(await speechResponse.arrayBuffer());
    response.setHeader("Content-Type", contentType);
    response.setHeader("Cache-Control", "no-store");
    response.status(200).send(audio);
  } catch (error) {
    response.status(500).json({ error: "Could not create speech", detail: error.message });
  }
}

async function createSpeech(input) {
  const providerOrder = [];
  if (process.env.GROQ_API_KEY) providerOrder.push(["groq", createGroqSpeech]);
  if (process.env.OPENAI_API_KEY) providerOrder.push(["openai", createOpenAiSpeech]);

  let lastResult = null;
  for (const [provider, createProviderSpeech] of providerOrder) {
    const result = await createProviderSpeech(input);
    lastResult = { ...result, provider };
    if (result.speechResponse.ok) return lastResult;
  }

  return lastResult;
}

async function createOpenAiSpeech(input) {
  const speechResponse = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || DEFAULT_OPENAI_TTS_MODEL,
      voice: process.env.OPENAI_TTS_VOICE || DEFAULT_OPENAI_TTS_VOICE,
      input: input.slice(0, MAX_OPENAI_TTS_CHARS),
      response_format: "mp3",
      instructions:
        "Sound like a confident male esports commentator. Natural, warm, punchy, and clear. Do not sound robotic.",
    }),
  });

  return { speechResponse, contentType: "audio/mpeg" };
}

async function createGroqSpeech(input) {
  const speechResponse = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_TTS_MODEL || DEFAULT_GROQ_TTS_MODEL,
      voice: process.env.GROQ_TTS_VOICE || DEFAULT_GROQ_TTS_VOICE,
      input: `[playful, cheeky, slightly funny commentator] ${input}`.slice(0, MAX_GROQ_TTS_CHARS),
      response_format: "wav",
    }),
  });

  return { speechResponse, contentType: "audio/wav" };
}
