import { NextResponse } from 'next/server';
import { novaRequestSchema, validateModelOutput, MAX_BODY_BYTES } from '@/features/nova/ai/schemas';
import { GeminiError, askGemini, geminiConfigured, usage } from '@/server/nova/gemini';
import { checkLimit } from '@/server/nova/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fail = (error: string, status: number, headers?: Record<string, string>) => NextResponse.json({ error }, { status, headers });

/** Availability probe (no key material). `?metrics=1` returns counters in development only. */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'production' && new URL(request.url).searchParams.has('metrics')) return NextResponse.json({ usage });
  return NextResponse.json({ available: geminiConfigured() });
}

export async function POST(request: Request) {
  // Cost control: only our own pages may spend the key.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) return fail('forbidden', 403);
  if (!geminiConfigured()) return fail('ai-unavailable', 503);

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return fail('too-large', 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return fail('too-large', 413);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail('bad-request', 400);
  }
  const parsed = novaRequestSchema.safeParse(json);
  if (!parsed.success) return fail('bad-request', 400);

  const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const limit = checkLimit(client);
  if (!limit.ok) return fail(limit.reason === 'quota' ? 'quota' : 'rate-limited', 429, { 'Retry-After': String(limit.retryAfterSec) });

  const body = parsed.data;
  try {
    const raw = await askGemini(body, request.signal);
    const response = validateModelOutput(raw, { intent: body.intent, hintLevel: body.hintLevel, revealed: body.context.revealed, allowedTargets: body.allowedTargets });
    if (!response) {
      usage.invalid += 1;
      return fail('invalid-model-output', 502);
    }
    usage.ok += 1;
    return NextResponse.json({ response });
  } catch (e) {
    const kind = e instanceof GeminiError ? e.kind : 'failed';
    return fail(kind === 'quota' ? 'quota' : kind === 'timeout' ? 'timeout' : 'ai-failed', kind === 'quota' ? 429 : 502);
  }
}
