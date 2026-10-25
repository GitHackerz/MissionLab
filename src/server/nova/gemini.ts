import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { RESPONSE_JSON_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from '@/features/nova/ai/prompts';
import type { ValidatedNovaRequest } from '@/features/nova/ai/schemas';

/** Development-only counters (no message content). */
export const usage = { requests: 0, ok: 0, failed: 0, timeouts: 0, invalid: 0, quota: 0 };

/** `GEMINI_API_KEY` is canonical; `GEMINI_API` is accepted because that is what existing .env files use. */
function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GEMINI_API || undefined;
}

export function geminiConfigured(): boolean {
  return Boolean(geminiKey() && process.env.GEMINI_MODEL);
}

export class GeminiError extends Error {
  constructor(readonly kind: 'timeout' | 'quota' | 'failed' | 'bad-json') {
    super(kind);
  }
}

let client: GoogleGenAI | null = null;

/** Calls Gemini once (no retries: the offline tutor is the fallback) and returns the parsed JSON object. */
export async function askGemini(req: ValidatedNovaRequest, parentSignal?: AbortSignal): Promise<unknown> {
  const model = process.env.GEMINI_MODEL;
  const apiKey = geminiKey();
  if (!model || !apiKey) throw new GeminiError('failed');
  client ??= new GoogleGenAI({ apiKey });
  const timeoutMs = Math.min(Math.max(Number(process.env.NOVA_TIMEOUT_MS) || 8000, 1000), 20000);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const onParent = () => ctl.abort();
  parentSignal?.addEventListener('abort', onParent);
  usage.requests += 1;
  try {
    const res = await client.models.generateContent({
      model,
      contents: buildUserPrompt(req),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
        maxOutputTokens: 1024,
        temperature: 0.5,
        abortSignal: ctl.signal,
      },
    });
    try {
      return JSON.parse(res.text ?? '');
    } catch {
      usage.invalid += 1;
      throw new GeminiError('bad-json');
    }
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    if (ctl.signal.aborted) {
      usage.timeouts += 1;
      throw new GeminiError('timeout');
    }
    const status = (e as { status?: number }).status;
    if (status === 429) {
      usage.quota += 1;
      throw new GeminiError('quota');
    }
    usage.failed += 1;
    throw new GeminiError('failed');
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParent);
  }
}
