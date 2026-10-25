/**
 * Deterministic, rule-based tutor. Used when Gemini is unavailable, slow, over quota, or its
 * output fails validation. It reads the same learner-visible context as the model, so it can
 * never reveal anything the learner is not allowed to know yet.
 */
import { COMPONENT_INFO } from '@/simulation/training/recycler';
import type { RecyclerComponentId } from '@/simulation/training/types';
import { canTarget, getTarget } from '../targets';
import type { HintLevel, NovaResponse } from '../types';
import type { LearnerContext, NovaRequestBody } from './context';

export const NOVA_INTRO: NovaResponse = {
  message: "Welcome to MissionLab. I'm NOVA, your onboard training assistant. Ready to explore the habitat?",
  emotion: 'encouraging',
  hintLevel: 0,
  visualAction: { type: 'none' },
};

const reply = (message: string, extra: Partial<NovaResponse> = {}): NovaResponse => ({ message, emotion: 'neutral', hintLevel: 0, visualAction: { type: 'none' }, ...extra });

const concept = (conceptId: string): NovaResponse['visualAction'] => ({ type: 'show_concept', conceptId });
const point = (targetId: string): NovaResponse['visualAction'] => ({ type: 'point', targetId });

/** Objective-level destination for the current stage. */
export function destinationFor(stage: LearnerContext['stage']): string | null {
  switch (stage) {
    case 'power-plan': return 'station:power-console';
    case 'diagnose-start': case 'diagnose-conclude': case 'plan-repair': case 'repair': case 'verify': case 'retry': return 'station:water-recycler';
    case 'recovered': case 'concluded': return 'station:mission-console';
    default: return null;
  }
}

function outOfRange(ctx: LearnerContext): string[] {
  const seen = new Map<string, boolean>();
  for (const e of ctx.evidence) for (const r of e.readings) seen.set(r.label, r.inRange);
  return [...seen].filter(([, ok]) => !ok).map(([label]) => label.toLowerCase());
}

function powerLine(ctx: LearnerContext): string {
  const p = ctx.power;
  const b = ctx.resources;
  if (!p) return `The battery holds ${b.batteryKwh} of ${b.batteryCapacityKwh} kWh.`;
  const net = p.solarKw - p.suppliedKw;
  return `Solar makes ${p.solarKw} kW and the habitat is using ${p.suppliedKw} kW, so the ${b.batteryKwh} kWh battery is ${net >= 0 ? 'charging' : 'draining'} by about ${Math.abs(net).toFixed(1)} kW.`;
}

function hintFor(req: NovaRequestBody, level: HintLevel): NovaResponse {
  const ctx = req.context;
  const dest = destinationFor(ctx.stage);
  const probe = ctx.nextProbe;
  const base = { hintLevel: level, emotion: 'curious' as const };
  const dir = (id: string | null, text: string): NovaResponse =>
    id && getTarget(id) && canTarget(id, { hintLevel: level, intent: req.intent, revealed: ctx.revealed })
      ? reply(text, { ...base, visualAction: point(id) })
      : reply(text, base);

  switch (ctx.stage) {
    case 'power-plan':
      if (level <= 1) return reply(`Batteries only store energy the panels already made. ${powerLine(ctx)} Which systems keep people alive, and which only help the mission goals?`, { ...base, visualAction: concept('battery-balance'), followUpQuestion: 'Which loads could wait?' });
      if (level === 2) return reply(`Compare what the habitat asks for (${ctx.power?.requestedKw ?? '?'} kW) with what the panels make (${ctx.power?.solarKw ?? '?'} kW). The distribution board lets you see that trade-off.`, { ...base, visualAction: concept('power-priority') });
      return dir('station:power-console', 'The Power Distribution Board is in the Power Room, east of the hub. I marked it. Walk there and press E.');
    case 'monitor':
      return reply('Power plan applied. Use Wait to let time pass, then compare the battery trend with your forecast. A new warning may appear.', { ...base, visualAction: concept('battery-balance') });
    case 'diagnose-start':
      if (level <= 1) return reply('Low water recovery is a symptom, and several different causes can produce it. Evidence is how we tell them apart without guessing.', { ...base, visualAction: concept('water-loop'), followUpQuestion: 'What could you measure first?' });
      if (level === 2) return reply(probe ? `Try the "${probe.test}" diagnostic. Each test costs simulated time, so think about what you expect it to show.` : 'Run a diagnostic test at the recycler and look at which readings leave their expected range.', base);
      return dir(probe?.targetId ?? dest, probe ? `I marked the ${probe.label.toLowerCase()}. What does it measure, and what would a healthy value look like?` : 'The Water Recycler is in Life Support, west of the hub. I marked it. Run a diagnostic there.');
    case 'diagnose-conclude': {
      const bad = outOfRange(ctx);
      if (level <= 1) return reply(`A good diagnosis fits every measurement, not just one.${bad.length ? ` So far outside their range: ${bad.slice(0, 3).join(', ')}.` : ''}`, { ...base, visualAction: concept('sensor-vs-reality'), followUpQuestion: 'Which single cause explains all of them?' });
      if (level === 2) return reply(probe ? `You have not used "${probe.test}" yet. Compare it with what you already know.` : 'Look for readings that disagree. Does something spin but not push water? Does the sensor agree with the clean tank?', base);
      return dir(probe?.targetId ?? dest, probe ? `Take a look at the ${probe.label.toLowerCase()}. I marked it. What would it add to your evidence?` : 'You have the main readings. Compare them again at the recycler before you record a diagnosis.');
    }
    case 'plan-repair':
      if (level <= 1) return reply('Planning compares the cost of acting with the cost of waiting. Servicing stops recovery for a while.', { ...base, visualAction: concept('water-loop') });
      if (level === 2) return reply('Check the spare parts you hold and what the repair costs in hours and water before you open the unit.', base);
      return dir(dest, 'The procedure runs at the Water Recycler. I marked it. The control panel starts the safe-shutdown steps.');
    case 'repair':
      if (level <= 1) return reply('Equipment is stopped and confirmed inactive before anyone opens it. The clock still runs, so recovery is zero while the unit is down.', base);
      if (level === 2) return reply('The checklist shows what is done. Some steps need a specific tool, so check what the step asks for.', base);
      return dir(dest, 'Stay at the Water Recycler and follow the checklist. I cannot do the steps for you, but I marked where to work.');
    case 'verify':
      if (level <= 1) return reply('A repair is finished only when measurements return to their expected ranges.', { ...base, visualAction: concept('verify-with-measurement') });
      if (level === 2) return reply('Run the startup test and compare each reading with its expected range.', base);
      return dir('part:control-panel', 'The startup test runs from the control panel. I marked it.');
    case 'retry':
      if (level <= 1) return reply('If a measurement is still wrong after a repair, the root cause was not fixed.', { ...base, visualAction: concept('verify-with-measurement') });
      if (level === 2) return reply('Compare each reading with its expected range. Is the part you replaced the one your evidence pointed to?', base);
      return dir(probe?.targetId ?? dest, 'Re-examine the evidence at the recycler. I marked a place to start.');
    case 'recovered': case 'concluded':
      return reply('The hard part is done. Open Mission Autopsy to trace which of your decisions mattered.', { ...base, emotion: 'encouraging', visualAction: point('station:mission-console') });
    default:
      return reply(ctx.objective, base);
  }
}

function explainPart(id: RecyclerComponentId, extra?: string): NovaResponse {
  const info = COMPONENT_INFO[id];
  return reply(`${info.name}: ${info.purpose}${extra ? ` ${extra}` : ''}`, { emotion: 'curious', visualAction: point(`part:${id}`), followUpQuestion: 'What would change if this stopped working?' });
}

const KEYWORDS: [RegExp, (ctx: LearnerContext) => NovaResponse][] = [
  [/\b(answer|solution|solve it|what('?s| is) wrong|broken|faulty|which part|tell me what|just tell)\b/i, (ctx) => reply('I will not hand over the answer, because working it out is the training. Tell me what the readings show so far and we will reason through it together.', { emotion: 'encouraging', followUpQuestion: ctx.evidence.length ? 'Which reading looks wrong to you?' : 'What could you measure first?' })],
  [/\b(pump)\b/i, () => explainPart('pump-cartridge', 'It pushes water through; its speed and power draw can be measured.')],
  [/\b(filter)\b/i, () => explainPart('filter-cartridge', 'Pressure before and after it shows how freely water passes.')],
  [/\b(pressure|gauge)\b/i, () => reply('Pressure gauges show how hard the pump pushes and where flow is held back. A big drop across one part means resistance there.', { emotion: 'curious', visualAction: point('part:pressure-gauges') })],
  [/\b(sensor)\b/i, () => explainPart('flow-sensor', 'It is a measurement, so compare it with an independent reading.')],
  [/\b(clean tank|clean-tank|output tank)\b/i, () => explainPart('clean-tank')],
  [/\b(battery|batteries|power|electric\w*|energy|solar|drain\w*|watt|kw)\b/i, (ctx) => reply(`${powerLine(ctx)} A battery only stores what panels already made, so when demand beats generation it drains.`, { emotion: 'curious', visualAction: concept('battery-balance') })],
  [/\b(oxygen|air|breath\w*)\b/i, (ctx) => reply(`Oxygen reserve is ${ctx.resources.oxygenKg} kg. Making it takes electricity, so protecting life-support power protects the crew's air.`, { emotion: 'curious', visualAction: concept('oxygen-energy') })],
  [/\b(greenhouse|dark|plant\w*|crop\w*|food|lamp\w*)\b/i, (ctx) => {
    const g = ctx.modules.find((m) => m.name.toLowerCase().includes('greenhouse'));
    return reply(`${g && !g.enabled ? 'The greenhouse is switched off to save power, so its lamps are dark.' : 'Greenhouse lamps use electricity.'} Light grows food, but it competes with the battery.`, { emotion: 'curious', visualAction: concept('greenhouse-light') });
  }],
  [/\b(water|recycl\w*|drink\w*)\b/i, (ctx) => reply(`Recycling returns used water to the clean tank. Water reserve: ${ctx.resources.waterLiters} L.`, { emotion: 'curious', visualAction: concept('water-loop') })],
];

/** Offline / fallback reply for any request. */
export function offlineReply(req: NovaRequestBody): NovaResponse {
  const ctx = req.context;
  const level = req.hintLevel;
  if (req.intent === 'hint') return hintFor(req, Math.max(1, level) as HintLevel);
  if (req.intent === 'where') {
    const dest = destinationFor(ctx.stage);
    const t = dest ? getTarget(dest) : null;
    return reply(t ? `${ctx.objective} I marked the ${t.label}. You walk there.` : ctx.objective, { emotion: 'curious', hintLevel: 0, visualAction: dest && t ? point(dest) : { type: 'none' } });
  }
  if (req.intent === 'reflect' || req.intent === 'debrief') {
    if (ctx.debrief) return reply(`${ctx.debrief.outcome}. The fault was the ${ctx.debrief.fault.toLowerCase()}. Open Mission Autopsy to trace which of your decisions led here.`, { emotion: 'encouraging', visualAction: concept('verify-with-measurement') });
    return reply('Good work so far. Keep collecting evidence and checking it against what you expected.', { emotion: 'encouraging' });
  }
  if (req.intent === 'explain') {
    const focus = ctx.focus;
    if (focus) return reply(`${focus}: ${focusBlurb(focus)}`, { emotion: 'curious' });
  }
  const text = req.message ?? '';
  for (const [re, make] of KEYWORDS) if (re.test(text)) return make(ctx);
  if (/\b(hint|help|stuck|confus\w*)\b/i.test(text)) return hintFor(req, Math.max(1, level) as HintLevel);
  const dest = destinationFor(ctx.stage);
  return reply(`${ctx.objective}`, { visualAction: dest ? point(dest) : { type: 'none' }, followUpQuestion: 'What are you trying to find out?' });
}

function focusBlurb(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('power')) return 'it shows solar input, battery storage and which loads run. Energy in has to match energy out.';
  if (l.includes('water')) return 'it recovers drinking water from used water so the crew does not run out.';
  if (l.includes('air')) return 'it removes carbon dioxide and makes oxygen, which takes electricity.';
  if (l.includes('mission')) return 'objectives, events, forecasts and documentation live here.';
  if (l.includes('green')) return 'crops grow under lamps, which draw power. Food and energy trade off.';
  return 'it reports air, water, food and power reserves for the crew.';
}
