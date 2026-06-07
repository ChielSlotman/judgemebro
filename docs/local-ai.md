# Local AI Judge

This repo can use the local free Ollama model at `D:\LocalAI` for development judging before paying for a hosted API.

## Local Model

The configured local model is:

```text
text-judge
```

The helper scripts are:

```text
D:\LocalAI\start-ollama.cmd
D:\LocalAI\judge-text.cmd
```

## Start The Local Server

```powershell
D:\LocalAI\start-ollama.cmd
```

Verify it is available:

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

## Use It For The Judge API

Add these server-only values to `.env.local`:

```text
JUDGE_PROVIDER=ollama
OLLAMA_JUDGE_URL=http://127.0.0.1:11434/api/chat
OLLAMA_JUDGE_MODEL=text-judge
```

Then run the app through Vercel's local server so `api/judge.js` is available:

```powershell
npm exec vercel -- dev
```

The plain Vite dev server does not serve Vercel API functions, so it will still fall back to the deterministic client judge when `/api/judge` is unavailable.

## Production

Do not deploy `JUDGE_PROVIDER=ollama` to Vercel. A Vercel production function cannot reach the Ollama server running on this computer.

Use one of these production modes:

- `JUDGE_PROVIDER=local` or no AI env: deterministic fallback judge.
- `JUDGE_PROVIDER=openai` with `OPENAI_API_KEY`: hosted AI judge.
