/**
 * Client entry point for NOVA's intelligence. Always resolves with a usable reply:
 * Gemini through our server route when reachable, otherwise the deterministic offline tutor.
 */
import type { HintLevel, NovaIntent, NovaReply } from '../types';
import { allowedTargetsFor, type LearnerContext, type NovaRequestBody } from './context';
import { offlineReply } from './fallback';
import { checkResponse, cleanLearnerText } from './schemas';

const TIMEOUT_MS = 10_000;
const CACHE_MAX = 24;

export interface TutorStatus {
  /** Server says Gemini is configured. Null until probed. */
  aiConfigured: boolean | null;
  /** Do not call Gemini again before this time (quota or repeated failures). */
  coolDownUntil: number;
}

const status: TutorStatus = { aiConfigured: null, coolDownUntil: 0 };
const cache = new Map<string, NovaReply>();

export function getTutorStatus(): Readonly<TutorStatus> {
  return status;
}

export function resetTutorForTests(): void {
  status.aiConfigured = null;
  status.coolDownUntil = 0;
  cache.clear();
}

/** Asks the server whether Gemini is configured. Never throws. */
export async function probeAi(fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetcher('/api/nova', { method: 'GET', cache: 'no-store' });
    const json = (await res.json()) as { available?: boolean };
    status.aiConfigured = res.ok && json.available === true;
  } catch {
    status.aiConfigured = false;
  }
  return status.aiConfigured;
}

export function buildRequest(intent: NovaIntent, context: LearnerContext, hintLevel: HintLevel, message?: string): NovaRequestBody {
  const text = message ? cleanLearnerText(message) : undefined;
  return { intent, hintLevel, context, allowedTargets: allowedTargetsFor(context, intent, hintLevel), ...(text ? { message: text } : {}) };
}

export interface AskOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  now?: () => number;
  online?: boolean;
}

export async function askNova(req: NovaRequestBody, opts: AskOptions = {}): Promise<NovaReply> {
  const now = opts.now ?? Date.now;
  const online = opts.online ?? (typeof navigator === 'undefined' ? true : navigator.onLine);
  const offline = (): NovaReply => ({ ...offlineReply(req), source: 'offline' });

  if (!online || status.aiConfigured === false || now() < status.coolDownUntil) return offline();

  const key = JSON.stringify(req);
  const hit = cache.get(key);
  if (hit) return hit;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const onAbort = () => ctl.abort();
  opts.signal?.addEventListener('abort', onAbort);
  try {
    const res = await (opts.fetcher ?? fetch)('/api/nova', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctl.signal,
    });
    if (res.status === 503) status.aiConfigured = false;
    if (res.status === 429) status.coolDownUntil = now() + 60_000;
    if (!res.ok) return offline();
    const json = (await res.json()) as { response?: unknown };
    const checked = json.response ? checkResponse(json.response as NovaReply, { intent: req.intent, hintLevel: req.hintLevel, revealed: req.context.revealed, allowedTargets: req.allowedTargets }) : null;
    if (!checked) return offline();
    const reply: NovaReply = { ...checked, source: 'gemini' };
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, reply);
    return reply;
  } catch {
    // A caller-initiated abort must not look like an outage; anything else cools Gemini down briefly.
    if (!opts.signal?.aborted) status.coolDownUntil = now() + 15_000;
    return offline();
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}
