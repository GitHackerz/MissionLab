import type { BranchComparison, MissionBranch, MissionSnapshot, MissionSummary } from './types';
import { getMissionConfig } from './config';

export function getMissionSummary(history: MissionSnapshot[]): MissionSummary {
  if (!history.length) throw new Error('Cannot generate summary from empty history.');
  const state = history.at(-1)!.state;
  const config = getMissionConfig(state);
  const minimum = (key: 'batteryKwh' | 'waterLiters' | 'oxygenKg') => Math.min(...history.map(s => s.state.resources[key]));
  const keyDecisions = history.filter(s => s.actionTaken && ['SET_ENABLED', 'REPAIR_WATER_RECYCLER'].includes(s.actionTaken.type))
    .map(s => ({ hour: s.hour, action: JSON.stringify(s.actionTaken),
      impact: s.state.events.at(-1)?.message ?? 'Recorded player decision.' }));
  const evidence = new Set(state.failure?.causeIds ?? []);
  const significantEvents = state.events.filter(e => e.severity !== 'info' || evidence.has(e.id)
    || ['MODULE_ENABLED', 'MODULE_SUSPENDED', 'REPAIR_COMMENCED', 'REPAIR_COMPLETED', 'MISSION_ACCOMPLISHED'].includes(e.type));
  const explanations: string[] = [];
  if (state.events.some(e => e.type === 'DUST_STORM_ARRIVAL')) {
    explanations.push(`Storm solar supply was ${config.stormSolarGenerationKw} kW. Stored energy buffers demand above generation; zero battery alone does not imply blackout.`);
  }
  if (state.failure?.kind === 'power') explanations.push('Recorded unserved essential demand exceeded available solar plus stored energy. Optional loads were allocated after essential loads.');
  if (state.events.some(e => e.type === 'PUMP_MECHANICAL_FAULT')) explanations.push(`The pump fault halted ${config.normalWaterRecoveryLitersPerHour} L/h recovery. Crew use continued at ${config.crewWaterUseLitersPerHour} L/h.`);
  if (state.failure?.kind === 'water') explanations.push(`Recorded water reserve crossed the terminal safety limit of ${config.waterSafetyThresholdLiters} L.`);
  if (state.failure?.kind === 'oxygen') explanations.push(`Recorded oxygen reserve crossed the terminal safety limit of ${config.oxygenSafetyThresholdKg} kg.`);
  explanations.push(`Fully powered operational life support produces up to ${config.normalOxygenGenKgPerHour} kg/h oxygen and consumes ${config.oxygenProcessWaterLitersPerKg ?? 1.125} L process water per kg, after crew hydration.`);
  return {
    scenarioId: state.scenarioId, branchId: state.branchId, finalHour: state.hour, durationHours: state.durationHours,
    status: state.status, finalResources: structuredClone(state.resources), minBatteryKwh: minimum('batteryKwh'),
    minWaterLiters: minimum('waterLiters'), minOxygenKg: minimum('oxygenKg'), scienceScore: state.scienceScore,
    // Safety termination does not constitute evidence that the crew died.
    crewSurviving: state.crewCount, failureReason: state.failureReason, keyDecisions,
    autopsyCauseChain: [...significantEvents.map(e => `[${e.id}; hour ${e.hour}] ${e.message}`), ...explanations],
    significantEvents: structuredClone(significantEvents), rootCause: structuredClone(state.failure),
    minimumMargins: { batteryKwh: minimum('batteryKwh') - config.batterySafetyThresholdKwh,
      waterLiters: minimum('waterLiters') - config.waterSafetyThresholdLiters,
      oxygenKg: minimum('oxygenKg') - config.oxygenSafetyThresholdKg },
    thresholds: { batteryWarningKwh: config.batterySafetyThresholdKwh, waterFailureLiters: config.waterSafetyThresholdLiters,
      oxygenFailureKg: config.oxygenSafetyThresholdKg },
  };
}

export function compareBranches(branchA: MissionBranch, branchB: MissionBranch): BranchComparison {
  const a = getMissionSummary(branchA.snapshots);
  const b = getMissionSummary(branchB.snapshots);
  let common = 0;
  while (common < a.keyDecisions.length && common < b.keyDecisions.length
    && a.keyDecisions[common].hour === b.keyDecisions[common].hour
    && a.keyDecisions[common].action === b.keyDecisions[common].action) common++;
  const differences = [
    ...a.keyDecisions.slice(common).map(d => `A hour ${d.hour}: ${d.action}`),
    ...b.keyDecisions.slice(common).map(d => `B hour ${d.hour}: ${d.action}`),
  ];
  return {
    branchA: a, branchB: b,
    resourceDelta: { batteryKwh: b.finalResources.batteryKwh - a.finalResources.batteryKwh,
      waterLiters: b.finalResources.waterLiters - a.finalResources.waterLiters,
      oxygenKg: b.finalResources.oxygenKg - a.finalResources.oxygenKg, scienceScore: b.scienceScore - a.scienceScore },
    divergenceHour: branchB.forkHour, keyDivergenceFactors: differences,
    outcomeDiffDescription: `A: ${a.status} at hour ${a.finalHour}${a.rootCause ? ` (${a.rootCause.kind})` : ''}; B: ${b.status} at hour ${b.finalHour}${b.rootCause ? ` (${b.rootCause.kind})` : ''}. Recorded decision differences: ${differences.join('; ') || 'none'}.`,
  };
}
