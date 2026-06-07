const MAX_TTS_CHARS = 900;
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_TTS_VOICE = "onyx";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    response.status(503).json({ error: "Hosted TTS is not configured" });
    return;
  }

  const input = typeof request.body?.input === "string" ? request.body.input.trim().slice(0, MAX_TTS_CHARS) : "";
  if (!input) {
    response.status(400).json({ error: "input required" });
    return;
  }

  try {
    const speechResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || DEFAULT_TTS_MODEL,
        voice: process.env.OPENAI_TTS_VOICE || DEFAULT_TTS_VOICE,
        input,
        response_format: "mp3",
        instructions:
          "Sound like a confident male esports commentator. Natural, warm, punchy, and clear. Do not sound robotic.",
      }),
    });

    if (!speechResponse.ok) {
      const errorText = await speechResponse.text();
      response.status(502).json({ error: `TTS provider failed: ${speechResponse.status}`, detail: errorText.slice(0, 240) });
      return;
    }

    const audio = Buffer.from(await speechResponse.arrayBuffer());
    response.setHeader("Content-Type", "audio/mpeg");
    response.setHeader("Cache-Control", "no-store");
    response.status(200).send(audio);
  } catch (error) {
    response.status(500).json({ error: "Could not create speech", detail: error.message });
  }
}
