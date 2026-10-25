/**
 * Small in-memory limiter: a per-client sliding window plus a global daily budget.
 * Per-process only, which is fine for a single instance; a shared store would be needed to scale out.
 */
const WINDOW_MS = 60_000;
const DAY_MS = 86_400_000;

const clients = new Map<string, number[]>();
let day = { start: Date.now(), count: 0 };

export interface LimitConfig { perMinute: number; perDay: number }

export function defaultLimits(): LimitConfig {
  const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return { perMinute: n(process.env.NOVA_RATE_PER_MINUTE, 10), perDay: n(process.env.NOVA_DAILY_LIMIT, 1500) };
}

export type LimitResult = { ok: true } | { ok: false; reason: 'rate' | 'quota'; retryAfterSec: number };

export function checkLimit(key: string, cfg: LimitConfig = defaultLimits(), now = Date.now()): LimitResult {
  if (now - day.start >= DAY_MS) day = { start: now, count: 0 };
  if (day.count >= cfg.perDay) return { ok: false, reason: 'quota', retryAfterSec: Math.ceil((day.start + DAY_MS - now) / 1000) };
  const hits = (clients.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= cfg.perMinute) {
    clients.set(key, hits);
    return { ok: false, reason: 'rate', retryAfterSec: Math.max(1, Math.ceil((hits[0] + WINDOW_MS - now) / 1000)) };
  }
  hits.push(now);
  clients.set(key, hits);
  day.count += 1;
  if (clients.size > 2000) for (const [k, v] of clients) if (!v.some((t) => now - t < WINDOW_MS)) clients.delete(k);
  return { ok: true };
}

export function resetLimits(): void {
  clients.clear();
  day = { start: Date.now(), count: 0 };
}
