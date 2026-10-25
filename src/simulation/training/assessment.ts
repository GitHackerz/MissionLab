import type { MissionState } from '../types';
import { FAULT_LABEL, FAULT_SLOT, NOMINAL_RECOVERY_LPH, PART_LABEL } from './recycler';
import type { EvidenceRecord, RecyclerFaultKind, ReplaceableId } from './types';

export type Rating = 'not-demonstrated' | 'developing' | 'proficient';

export interface LearningDimension {
  id: 'system-understanding' | 'scientific-reasoning' | 'fault-diagnosis' | 'engineering-planning' | 'procedure-execution' | 'result-verification' | 'tradeoff-awareness';
  label: string;
  rating: Rating;
  explanation: string;
}

export interface LearningAssessment {
  dimensions: LearningDimension[];
  /** Ordered, evidence-based story of what happened and why. */
  causalChain: string[];
  consequences: string[];
}

function readingText(evidence: EvidenceRecord[], testIds: string[], ids: string[]): string | null {
  for (let i = evidence.length - 1; i >= 0; i--) {
    const e = evidence[i];
    if (!testIds.includes(e.testId)) continue;
    const parts = e.readings.filter((r) => ids.includes(r.id)).map((r) => `${r.label.toLowerCase()} ${r.value} ${r.unit}`);
    if (parts.length) return parts.join(', ');
  }
  return null;
}

function whyNot(truth: RecyclerFaultKind, replaced: ReplaceableId, evidence: EvidenceRecord[]): string {
  const pump = readingText(evidence, ['check-pump', 'run-diagnostic-cycle'], ['pump-rpm', 'pump-power-kw']);
  const pressure = readingText(evidence, ['read-pressure', 'run-diagnostic-cycle'], ['pressure-in-kpa', 'pressure-out-kpa']);
  const compare = readingText(evidence, ['compare-output', 'run-diagnostic-cycle'], ['sensor-reported-recovery-lph', 'clean-tank-inflow-lph']);
  if (truth === 'filter-clogged') {
    return `The pump was turning${pump ? ` (${pump})` : ''} but flow stayed low and the pressure fell sharply across the filter${pressure ? ` (${pressure})` : ''}. A blocked filter fit that evidence better than a failed pump. You replaced the ${PART_LABEL[replaced].toLowerCase()}, so the restriction remained.`;
  }
  if (truth === 'pump-seized') {
    return `The pump was not turning${pump ? ` (${pump})` : ''} and no pressure was building${pressure ? ` (${pressure})` : ''}. That pointed to the pump cartridge. You replaced the ${PART_LABEL[replaced].toLowerCase()}, so the pump stayed seized.`;
  }
  return `The recycler was actually producing water; only the sensor disagreed${compare ? ` (${compare})` : ''}. When two independent measurements conflict, check the instrument before the process. You replaced the ${PART_LABEL[replaced].toLowerCase()} instead.`;
}

function rate(score: number, developing: number, proficient: number): Rating {
  return score >= proficient ? 'proficient' : score >= developing ? 'developing' : 'not-demonstrated';
}

/** Rule-based, deterministic assessment. Every sentence is derived from recorded state. */
export function assessLearning(state: MissionState): LearningAssessment | null {
  const t = state.training;
  if (!t) return null;
  const truth = t.recycler.faultKind;
  const truthSlot = FAULT_SLOT[truth];
  const onset = t.recycler.faultOnsetHour;
  const p = t.recycler.procedure;
  const installedSlots = t.log.filter((l) => l.ok && l.action.startsWith('INSTALL_COMPONENT:')).map((l) => l.action.split(':')[1] as ReplaceableId);
  const wrongInstalls = installedSlots.filter((s) => s !== truthSlot);
  const rejected = t.log.filter((l) => !l.ok);
  const distinctTests = new Set(t.evidence.map((e) => e.testId)).size;
  const lastHyp = t.hypotheses[t.hypotheses.length - 1];
  const startupRuns = t.log.filter((l) => l.ok && l.action === 'RUN_STARTUP_TEST');
  const verified = p.verification?.passed === true;
  // Root causes stay hidden while the learner can still diagnose; they are revealed once the mission ends or the repair is proven.
  const revealed = state.status !== 'running' || p.phase === 'completed';

  const dims: LearningDimension[] = [];

  dims.push({
    id: 'system-understanding',
    label: 'System understanding',
    rating: rate(t.inspectedComponents.length, 2, 5),
    explanation: t.inspectedComponents.length === 0
      ? 'No components were inspected, so how water moves through the recycler was never explored.'
      : `You inspected ${t.inspectedComponents.length} of 8 recycler parts. ${t.inspectedComponents.length >= 5 ? 'That covers most of the water path from tank to tank.' : 'Tracing the whole path (wastewater tank, pump, filter, treatment, sensor, clean tank) makes faults easier to place.'}`,
  });

  dims.push({
    id: 'scientific-reasoning',
    label: 'Scientific reasoning',
    rating: rate(distinctTests, 1, 3),
    explanation: distinctTests === 0
      ? 'No measurements were collected before acting.'
      : `You ran ${distinctTests} different kind${distinctTests > 1 ? 's' : ''} of measurement (${t.evidence.length} total). ${distinctTests >= 3 ? 'Comparing independent readings lets you tell similar faults apart.' : 'One or two readings can fit more than one fault; add an independent check.'}`,
  });

  if (!lastHyp) {
    dims.push({ id: 'fault-diagnosis', label: 'Fault diagnosis', rating: 'not-demonstrated', explanation: onset === null ? 'No fault has occurred yet.' : 'No diagnosis was recorded.' });
  } else if (!revealed) {
    dims.push({ id: 'fault-diagnosis', label: 'Fault diagnosis', rating: 'developing', explanation: `You recorded ${FAULT_LABEL[lastHyp.kind].toLowerCase()} (evidence fit: ${lastHyp.support}). Whether it was right is confirmed by the startup test, and explained here once the mission ends.` });
  } else if (lastHyp.kind === truth) {
    dims.push({ id: 'fault-diagnosis', label: 'Fault diagnosis', rating: lastHyp.support === 'strong' ? 'proficient' : 'developing', explanation: `You diagnosed ${FAULT_LABEL[truth].toLowerCase()}, which matches the real cause, with ${lastHyp.support} supporting evidence.` });
  } else {
    dims.push({ id: 'fault-diagnosis', label: 'Fault diagnosis', rating: 'developing', explanation: `You diagnosed ${FAULT_LABEL[lastHyp.kind].toLowerCase()}, but the real cause was ${FAULT_LABEL[truth].toLowerCase()}. ${whyNot(truth, FAULT_SLOT[lastHyp.kind], t.evidence)}` });
  }

  const planExplain: string[] = [];
  if (t.powerPlanAppliedHour === null) planExplain.push('No power plan was applied.');
  else planExplain.push(`A power plan was applied at hour ${t.powerPlanAppliedHour}.`);
  if (wrongInstalls.length && revealed) planExplain.push(`${wrongInstalls.length} replacement${wrongInstalls.length > 1 ? 's' : ''} did not match the real fault, using spare parts and time.`);
  else if (installedSlots.length) planExplain.push(`${installedSlots.length} part${installedSlots.length > 1 ? 's were' : ' was'} replaced, using spares and time.`);
  dims.push({
    id: 'engineering-planning',
    label: 'Engineering planning',
    rating: t.powerPlanAppliedHour !== null && (!revealed || wrongInstalls.length === 0) && !(p.verification && !p.verification.passed) ? 'proficient' : t.powerPlanAppliedHour !== null || installedSlots.length ? 'developing' : 'not-demonstrated',
    explanation: planExplain.join(' '),
  });

  dims.push({
    id: 'procedure-execution',
    label: 'Procedure execution',
    rating: p.completedSteps.includes('startup-test') ? (rejected.length <= 3 ? 'proficient' : 'developing') : p.completedSteps.length ? 'developing' : 'not-demonstrated',
    explanation: p.completedSteps.length === 0
      ? 'No maintenance procedure was attempted.'
      : `${p.completedSteps.length} of 16 procedure steps were completed. ${rejected.length ? `${rejected.length} action${rejected.length > 1 ? 's were' : ' was'} rejected (for example: ${[...new Set(rejected.map((r) => r.detail))].slice(0, 3).join('; ')}).` : 'No actions were rejected.'}`,
  });

  dims.push({
    id: 'result-verification',
    label: 'Result verification',
    rating: verified ? 'proficient' : startupRuns.length ? 'developing' : 'not-demonstrated',
    explanation: verified
      ? 'You ran the startup test and the readings came back in range, so the repair is proven by measurement.'
      : startupRuns.length
      ? `The startup test failed: ${p.verification?.remainingIssues.join(' ') ?? ''}`
      : 'No startup test was run, so nothing proves the water recycler works.',
  });

  const r = state.resources;
  dims.push({
    id: 'tradeoff-awareness',
    label: 'Mission trade-offs',
    rating: state.status === 'success' ? 'proficient' : t.powerPlanAppliedHour !== null ? 'developing' : 'not-demonstrated',
    explanation: `Final state: battery ${r.batteryKwh.toFixed(1)} kWh, water ${r.waterLiters.toFixed(1)} L, food ${r.foodRations.toFixed(1)} rations, science ${state.scienceScore}. The greenhouse was lit for ${t.cropGrowthHours} hours; every hour in the dark saved power but grew no food.`,
  });

  const chain: string[] = [];
  if (state.stormActive) chain.push('Dust storm: solar generation fell from 10.0 to 4.0 kW.');
  if (t.powerPlanAppliedHour !== null) chain.push(`Hour ${t.powerPlanAppliedHour}: power plan applied.`);
  if (onset !== null) chain.push(revealed ? `Hour ${onset}: water recovery dropped below range (root cause: ${FAULT_LABEL[truth].toLowerCase()}, unknown to the crew at the time).` : `Hour ${onset}: water recovery dropped below the expected range.`);
  t.evidence.forEach((e) => chain.push(`Hour ${e.hour}: ${e.title.toLowerCase()} - ${e.readings.map((x) => `${x.label} ${x.value} ${x.unit}`).join(', ')}.`));
  t.hypotheses.forEach((h) => chain.push(`Hour ${h.hour}: diagnosis recorded: ${FAULT_LABEL[h.kind].toLowerCase()} (${h.support} support).`));
  t.log.filter((l) => l.ok && (l.action.startsWith('INSTALL_COMPONENT') || l.action === 'RUN_STARTUP_TEST')).forEach((l) => chain.push(`Hour ${l.hour}: ${l.detail}.`));
  if (revealed) wrongInstalls.forEach((s) => chain.push(whyNot(truth, s, t.evidence)));

  const consequences: string[] = [];
  const endHour = verified && p.verification ? p.verification.hour : state.hour;
  if (onset !== null) {
    const down = Math.max(0, endHour - onset);
    consequences.push(`Water recovery was impaired for about ${down} simulated hour${down === 1 ? '' : 's'} (${(down * NOMINAL_RECOVERY_LPH).toFixed(1)} L of recovery lost versus normal).`);
  }
  const sparesUsed = installedSlots.length;
  if (sparesUsed) consequences.push(`${sparesUsed} spare part${sparesUsed > 1 ? 's' : ''} consumed. Pump cartridges left: ${state.resources.sparePumps}; filters: ${t.inventory.filterCartridges}; sensors: ${t.inventory.flowSensors}.`);
  if (state.status === 'failed' && state.failureReason) consequences.push(`Mission failed: ${state.failureReason}`);
  if (state.status === 'success') consequences.push('Mission succeeded: all crew survived the full 72 hours.');

  return { dimensions: dims, causalChain: chain, consequences };
}
