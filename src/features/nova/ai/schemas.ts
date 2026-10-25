/**
 * Runtime validation for both directions. The request schema is strict, so any extra field
 * (for example a leaked fault id) is rejected. The response is checked field by field and
 * every id is resolved against the target/concept registries before NOVA acts on it.
 */
import { z } from 'zod';
import { canTarget, isConceptId } from '../targets';
import type { HintLevel, NovaIntent, NovaResponse } from '../types';

export const MAX_MESSAGE_CHARS = 280;
export const MAX_REPLY_CHARS = 420;
export const MAX_BODY_BYTES = 12_000;

const str = (n: number) => z.string().max(n);
const num = z.number().finite();

const reading = z.object({ label: str(80), value: num, unit: str(12), min: num, max: num, inRange: z.boolean() }).strict();

const atmosphere = z
  .object({
    metrics: z.array(z.object({ label: str(60), value: num.nullable(), unit: str(16), limit: str(80) }).strict()).max(8),
    tests: z.array(str(80)).max(8),
    evidence: z.array(z.object({ test: str(80), minute: num, readings: z.array(z.object({ label: str(80), value: num, unit: str(16) }).strict()).max(8) }).strict()).max(3),
    inspected: z.array(str(60)).max(8),
    procedureActive: z.boolean(),
    verification: z.enum(['none', 'running', 'passed', 'failed']),
  })
  .strict();

const context = z
  .object({
    missionId: str(60),
    missionTitle: str(60),
    concept: str(300),
    atmosphere: atmosphere.nullable(),
    mission: z.object({ hour: num, durationHours: num, status: str(16), stormActive: z.boolean(), crew: num }).strict(),
    stage: z.enum(['free', 'power-plan', 'monitor', 'diagnose-start', 'diagnose-conclude', 'plan-repair', 'repair', 'verify', 'retry', 'recovered', 'concluded']),
    objective: str(400),
    learningMode: z.enum(['cadet', 'engineer', 'commander']),
    location: str(40).nullable(),
    focus: str(60).nullable(),
    resources: z.object({ batteryKwh: num, batteryCapacityKwh: num, waterLiters: num, oxygenKg: num, foodRations: num }).strict(),
    power: z.object({ solarKw: num, requestedKw: num, suppliedKw: num, unservedKw: num }).strict().nullable(),
    modules: z.array(z.object({ name: str(60), status: str(20), enabled: z.boolean() }).strict()).max(10),
    recentEvents: z.array(z.object({ hour: num, severity: str(12), message: str(300) }).strict()).max(4),
    evidence: z.array(z.object({ title: str(80), hour: num, readings: z.array(reading).max(8) }).strict()).max(4),
    inspected: z.array(str(60)).max(10),
    diagnoses: z.array(str(40)).max(2),
    repair: z.object({ phase: str(30), stepsDone: num, verified: z.boolean().nullable() }).strict(),
    recentActions: z.array(z.object({ action: str(40), ok: z.boolean() }).strict()).max(5),
    nextProbe: z.object({ targetId: str(40), label: str(60), test: str(80) }).strict().nullable(),
    revealed: z.boolean(),
    debrief: z.object({ fault: str(60), outcome: str(200) }).strict().nullable(),
  })
  .strict();

export const novaRequestSchema = z
  .object({
    intent: z.enum(['ask', 'hint', 'explain', 'where', 'reflect', 'debrief']),
    message: str(MAX_MESSAGE_CHARS).optional(),
    hintLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    context,
    allowedTargets: z.array(str(40)).max(40),
  })
  .strict();

export type ValidatedNovaRequest = z.infer<typeof novaRequestSchema>;

/** Untrusted learner text: strip control characters, collapse whitespace, cap the length. */
export function cleanLearnerText(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE_CHARS);
}

const EMOTIONS = ['neutral', 'curious', 'encouraging', 'concerned'] as const;

/** Raw shape Gemini is asked to produce (flat, so it fits a simple response schema). */
export const modelOutputSchema = z.object({
  message: z.string().min(1),
  emotion: z.string(),
  hintLevel: z.number(),
  actionType: z.string(),
  targetId: z.string().optional().default(''),
  followUpQuestion: z.string().optional().default(''),
});

/**
 * Assertive statements about which part is broken, used only while the answer is not yet legitimately
 * known. Matching text is replaced by safe fallback guidance, so a lucky guess cannot spoil the diagnosis.
 */
const SPOILER = [
  /\b(pump|filter|sensor|cartridge)\b[^.?!]{0,40}\b(is|are|has|have|was|appears|seems|looks)\b[^.?!]{0,25}\b(seized|clogged|blocked|jammed|broken|faulty|failed|drifting|drifted|miscalibrated|stuck)\b/i,
  /\b(problem|fault|culprit|cause|answer|issue)\b[^.?!]{0,20}\b(is|was)\b[^.?!]{0,20}\b(the )?(pump|filter|sensor|cartridge)\b/i,
  /\b(replace|swap|change)\b[^.?!]{0,20}\bthe (pump|filter|sensor)\b/i,
];

export function leaksAnswer(text: string): boolean {
  return SPOILER.some((r) => r.test(text));
}

/**
 * Validates parsed model output against the request. Returns null when the text is unacceptable,
 * which makes the caller use deterministic fallback guidance.
 */
export function validateModelOutput(raw: unknown, req: { intent: NovaIntent; hintLevel: HintLevel; revealed: boolean; allowedTargets: readonly string[] }): NovaResponse | null {
  const parsed = modelOutputSchema.safeParse(raw);
  if (!parsed.success) return null;
  const o = parsed.data;
  const message = o.message.replace(/\s+/g, ' ').trim();
  if (!message || message.length > MAX_REPLY_CHARS) return null;
  if (!req.revealed && (leaksAnswer(message) || leaksAnswer(o.followUpQuestion))) return null;
  const emotion = (EMOTIONS as readonly string[]).includes(o.emotion) ? (o.emotion as NovaResponse['emotion']) : 'neutral';
  const hintLevel = Math.max(0, Math.min(req.hintLevel, Math.round(o.hintLevel))) as HintLevel;
  const follow = o.followUpQuestion.trim().slice(0, 160);

  // An action that is unknown, not allowed for this request, or gated is dropped; the (validated) message still stands.
  let visualAction: NovaResponse['visualAction'] = { type: 'none' };
  const id = o.targetId;
  if ((o.actionType === 'highlight' || o.actionType === 'point') && req.allowedTargets.includes(id) && canTarget(id, { hintLevel: req.hintLevel, intent: req.intent, revealed: req.revealed })) {
    visualAction = { type: o.actionType, targetId: id };
  } else if (o.actionType === 'show_concept' && isConceptId(id)) {
    visualAction = { type: 'show_concept', conceptId: id };
  }
  return { message, emotion, hintLevel, visualAction, ...(follow ? { followUpQuestion: follow } : {}) };
}

/** Client-side check of a server reply before it drives the scene (defence in depth). */
export function checkResponse(resp: NovaResponse, req: { intent: NovaIntent; hintLevel: HintLevel; revealed: boolean; allowedTargets: readonly string[] }): NovaResponse | null {
  const a = resp.visualAction;
  return validateModelOutput(
    { message: resp.message, emotion: resp.emotion, hintLevel: resp.hintLevel, actionType: a.type, targetId: 'targetId' in a ? a.targetId : 'conceptId' in a ? a.conceptId : '', followUpQuestion: resp.followUpQuestion ?? '' },
    req,
  );
}
