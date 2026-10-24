import { BranchComparison, MissionBranch, MissionSnapshot, MissionSummary } from './types';

export function getMissionSummary(history: MissionSnapshot[]): MissionSummary {
  if (history.length === 0) {
    throw new Error('Cannot generate summary from empty history.');
  }

  const lastSnapshot = history[history.length - 1];
  const state = lastSnapshot.state;

  let minBattery = state.resources.batteryCapacityKwh;
  let minWater = 999;
  let minOxygen = 999;

  for (const snap of history) {
    if (snap.state.resources.batteryKwh < minBattery) {
      minBattery = snap.state.resources.batteryKwh;
    }
    if (snap.state.resources.waterLiters < minWater) {
      minWater = snap.state.resources.waterLiters;
    }
    if (snap.state.resources.oxygenKg < minOxygen) {
      minOxygen = snap.state.resources.oxygenKg;
    }
  }

  const keyDecisions = history
    .filter((s) => s.actionTaken && s.actionTaken.type !== 'ADVANCE_TIME')
    .map((s) => ({
      hour: s.hour,
      action: s.actionTaken?.type ?? 'UNKNOWN',
      impact: `Applied at Hour ${s.hour} on ${s.branchId}`,
    }));

  const autopsyCauseChain = state.events
    .filter((e) => e.severity === 'critical' || e.severity === 'warning')
    .map((e) => `[Hour ${e.hour}] ${e.message}`);

  return {
    scenarioId: state.scenarioId,
    branchId: state.branchId,
    finalHour: state.hour,
    durationHours: state.durationHours,
    status: state.status,
    finalResources: { ...state.resources },
    minBatteryKwh: Number(minBattery.toFixed(1)),
    minWaterLiters: Number(minWater.toFixed(1)),
    minOxygenKg: Number(minOxygen.toFixed(2)),
    scienceScore: state.scienceScore,
    crewSurviving: state.status === 'failed' ? 0 : state.crewCount,
    failureReason: state.failureReason,
    keyDecisions,
    autopsyCauseChain,
  };
}

export function compareBranches(
  branchA: MissionBranch,
  branchB: MissionBranch
): BranchComparison {
  const summaryA = getMissionSummary(branchA.snapshots);
  const summaryB = getMissionSummary(branchB.snapshots);

  return {
    branchA: summaryA,
    branchB: summaryB,
    resourceDelta: {
      batteryKwh: Number((summaryB.finalResources.batteryKwh - summaryA.finalResources.batteryKwh).toFixed(1)),
      waterLiters: Number((summaryB.finalResources.waterLiters - summaryA.finalResources.waterLiters).toFixed(1)),
      oxygenKg: Number((summaryB.finalResources.oxygenKg - summaryA.finalResources.oxygenKg).toFixed(2)),
      scienceScore: summaryB.scienceScore - summaryA.scienceScore,
    },
    divergenceHour: branchB.forkHour,
    keyDivergenceFactors: [
      `Branch B diverged at Hour ${branchB.forkHour}`,
      `Status A: ${summaryA.status.toUpperCase()} vs Status B: ${summaryB.status.toUpperCase()}`,
    ],
    outcomeDiffDescription:
      summaryB.status === 'success' && summaryA.status === 'failed'
        ? 'Decision divergence successfully avoided life-support blackout and achieved mission survival.'
        : `Outcome comparison between ${summaryA.branchId} and ${summaryB.branchId}.`,
  };
}
