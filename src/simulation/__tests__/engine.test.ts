import { describe, expect, it } from 'vitest';
import { advanceMission, advanceMissionSteps, applyMissionAction, createInitialMission } from '../engine';
import { conservePower, runRedStormPaths } from '../fixtures';
import { RED_STORM_CONFIG } from '../config';
import { MissionAction, MissionConfig, MissionState } from '../types';
import { createSnapshot, forkMission, recordMissionAction } from '../history';
import { compareBranches, getMissionSummary } from '../debrief';

function act(state: MissionState, action: MissionAction) {
  const result = applyMissionAction(state, action);
  expect(result.ok).toBe(true);
  return result.state;
}

function configured(patch: Partial<MissionConfig>) {
  return createInitialMission({ ...structuredClone(RED_STORM_CONFIG), ...patch });
}

describe('resource equations and supply accounting', () => {
  it('deducts process water exactly once and conserves energy', () => {
    const initial = createInitialMission();
    const original = structuredClone(initial);
    const s = advanceMission(initial, 1);
    expect(initial).toEqual(original);
    expect(s.resources.batteryKwh).toBeCloseTo(110 + 4 - 8.4, 10);
    expect(s.resources.waterLiters).toBeCloseTo(35 + .42 - .5 - .16 * 1.125, 10);
    expect(s.resources.oxygenKg).toBeCloseTo(5 + .16 - .14, 10);
    expect(s.power).toMatchObject({ requestedPowerKw: 8.4, suppliedPowerKw: 8.4, unservedPowerKw: 0 });
  });
  it('serves essential loads before optional loads and records exact shortfalls', () => {
    const initial = createInitialMission();
    initial.resources.batteryKwh = 1;
    const s = advanceMission(initial, 1);
    expect(s.resources.batteryKwh).toBe(0);
    expect(s.modules['life-support'].suppliedPowerKw).toBe(2);
    expect(s.modules['crew-habitat'].suppliedPowerKw).toBe(1.2);
    expect(s.modules['water-recycler'].suppliedPowerKw).toBeCloseTo(1.2);
    expect(s.modules.greenhouse.suppliedPowerKw).toBeCloseTo(.6);
    expect(s.modules['research-lab'].suppliedPowerKw).toBe(0);
    expect(s.power!.unservedPowerKw).toBeCloseTo(3.4);
    expect(s.events.some(e => e.type === 'POWER_SHORTAGE')).toBe(true);
    expect(s.status).toBe('running'); // Zero battery alone is not failure.
    expect(advanceMission(s, 1).failure?.kind).toBe('power');
  });
  it('clamps battery capacity and all resource lower bounds', () => {
    const full = configured({ stormSolarGenerationKw: 100 });
    expect(advanceMission(full, 1).resources.batteryKwh).toBe(150);
    const empty = createInitialMission();
    empty.resources.waterLiters = 0;
    empty.resources.oxygenKg = 0;
    empty.resources.batteryKwh = 0;
    empty.modules['life-support'].enabled = false;
    const s = advanceMission(empty, 1);
    expect(s.resources.waterLiters).toBeGreaterThanOrEqual(0);
    expect(s.resources.oxygenKg).toBe(0);
    expect(s.resources.batteryKwh).toBe(0);
    expect(s.resources.sparePumps).toBeGreaterThanOrEqual(0);
  });
  it('requires actual electricity, operational machinery, and process water for oxygen', () => {
    const s = createInitialMission();
    s.modules['life-support'].enabled = false;
    expect(advanceMission(s, 1).resources.oxygenKg).toBeCloseTo(4.86);
    const dry = configured({ normalWaterRecoveryLitersPerHour: 0 });
    dry.resources.waterLiters = .59;
    // .09 L after crew use produces .08 kg oxygen, rather than .16.
    expect(advanceMission(dry, 1).resources.oxygenKg).toBeCloseTo(5 + .08 - .14);
    const broken = createInitialMission();
    broken.modules['life-support'].status = 'degraded';
    broken.modules['life-support'].health = .2;
    expect(advanceMission(broken, 1).resources.oxygenKg).toBeCloseTo(4.86);
  });
  it.each(['durationHours', 'crewCount', 'waterRecyclerRepairDurationHours'] as const)('rejects invalid %s', key => {
    for (const value of [NaN, Infinity, -1, 0, .5]) expect(() => configured({ [key]: value })).toThrow();
  });
  it.each([NaN, Infinity, -1])('rejects invalid resource and generation parameters %s', value => {
    expect(() => configured({ stormSolarGenerationKw: value })).toThrow();
    expect(() => configured({ initialResources: { ...RED_STORM_CONFIG.initialResources, waterLiters: value } })).toThrow();
  });
});

describe('events, actions and repairs', () => {
  it('activates the storm before the first step and schedules fault once at boundary 30', () => {
    let s = conservePower();
    expect(s.hour).toBe(0);
    expect(s.stormActive).toBe(true);
    expect(s.modules['solar-array'].status).toBe('warning');
    s = advanceMission(s, 29);
    expect(s.modules['water-recycler'].status).toBe('operational');
    s = advanceMission(s, 1);
    expect(s.modules['water-recycler'].status).toBe('degraded');
    s = advanceMission(s, 2);
    expect(s.events.filter(e => e.type === 'DUST_STORM_ARRIVAL')).toHaveLength(1);
    expect(s.events.filter(e => e.type === 'PUMP_MECHANICAL_FAULT')).toHaveLength(1);
  });
  it('allows both directions of optional toggles', () => {
    for (const moduleId of ['greenhouse', 'research-lab'] as const) {
      const s = act(createInitialMission(), { type: 'SET_ENABLED', moduleId, enabled: false });
      expect(s.modules[moduleId].suppliedPowerKw).toBe(0);
      expect(act(s, { type: 'SET_ENABLED', moduleId, enabled: true }).modules[moduleId].enabled).toBe(true);
    }
  });
  it('rejects invalid module and boolean payloads without mutation', () => {
    const s = createInitialMission();
    for (const action of [ { type: 'SET_ENABLED', moduleId: 'life-support', enabled: false },
      { type: 'SET_ENABLED', moduleId: 'missing', enabled: true },
      { type: 'SET_ENABLED', moduleId: 'greenhouse', enabled: 1 } ]) {
      const result = applyMissionAction(s, action as MissionAction);
      expect(result.ok).toBe(false);
      expect(result.state).toBe(s);
      if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
    }
  });
  it.each([NaN, Infinity, -Infinity, 0, -1, .5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid advance %s', hours => {
    expect(applyMissionAction(createInitialMission(), { type: 'ADVANCE_TIME', hours }).ok).toBe(false);
    expect(() => advanceMission(createInitialMission(), hours)).toThrow(RangeError);
  });
  it('requires a fault and spare, rejects duplicate repair, and completes after four full intervals', () => {
    expect(applyMissionAction(createInitialMission(), { type: 'REPAIR_WATER_RECYCLER' }).ok).toBe(false);
    const fault = advanceMission(conservePower(), 30);
    const noSpare = structuredClone(fault);
    noSpare.resources.sparePumps = 0;
    expect(applyMissionAction(noSpare, { type: 'REPAIR_WATER_RECYCLER' }).ok).toBe(false);
    let s = act(fault, { type: 'REPAIR_WATER_RECYCLER' });
    expect(s.resources.sparePumps).toBe(0);
    expect(applyMissionAction(s, { type: 'REPAIR_WATER_RECYCLER' }).ok).toBe(false);
    s = advanceMission(s, 3);
    expect(s.modules['water-recycler'].repairHoursRemaining).toBe(1);
    s = advanceMission(s, 1);
    expect(s.hour).toBe(34);
    expect(s.modules['water-recycler'].status).toBe('operational');
    expect(s.resources.waterLiters).toBeCloseTo(35 - 30 * .26 - 4 * .68);
    s = advanceMission(s, 2);
    expect(s.events.filter(e => e.type === 'REPAIR_COMPLETED')).toHaveLength(1);
    expect(s.resources.waterLiters).toBeCloseTo(35 - 32 * .26 - 4 * .68);
  });
  it('uses embedded custom config for repairs, resources, duration and reset', () => {
    let s = configured({ durationHours: 40, waterRecyclerRepairDurationHours: 2,
      normalOxygenGenKgPerHour: .2, oxygenProcessWaterLitersPerKg: .1 });
    s = advanceMission(conservePower(s), 30);
    s = act(s, { type: 'REPAIR_WATER_RECYCLER' });
    expect(s.modules['water-recycler'].repairHoursRemaining).toBe(2);
    s = advanceMission(s, 10);
    expect(s.status).toBe('success');
    expect(s.hour).toBe(40);
    expect(act(s, { type: 'RESET_MISSION' }).durationHours).toBe(40);
  });
});

describe('complete outcomes', () => {
  it('computes all three canonical paths with independently derived resource totals', () => {
    const { energy, water, success } = runRedStormPaths();
    expect(energy.failure?.kind).toBe('power');
    expect(energy.hour).toBe(26);
    expect(energy.resources.batteryKwh).toBeCloseTo(0);
    expect(energy.resources.waterLiters).toBeCloseTo(35 - 25 * .26 - .68);
    expect(water.failure?.kind).toBe('water');
    expect(water.hour).toBe(50);
    expect(water.resources.waterLiters).toBeCloseTo(35 - 30 * .26 - 20 * .68);
    expect(water.resources.batteryKwh).toBeCloseTo(110 - 50 * .4);
    expect(success.status).toBe('success');
    expect(success.hour).toBe(72);
    expect(success.resources.batteryKwh).toBeCloseTo(110 - 72 * .4);
    expect(success.resources.waterLiters).toBeCloseTo(35 - 68 * .26 - 4 * .68);
    expect(success.resources.oxygenKg).toBeCloseTo(5 + 72 * .02);
    console.table(Object.entries({ energy, water, success }).map(([scenario, s]) => ({ scenario,
      status: s.status, hour: s.hour, batteryKwh: s.resources.batteryKwh,
      waterLiters: s.resources.waterLiters, oxygenKg: s.resources.oxygenKg })));
  });
  it('produces oxygen failure from a configured production deficit', () => {
    const s = advanceMission(conservePower(configured({ normalOxygenGenKgPerHour: 0 })), 72);
    expect(s.failure?.kind).toBe('oxygen');
    expect(s.hour).toBe(25);
    expect(s.resources.oxygenKg).toBeCloseTo(1.5);
  });
  it('fails at unsafe equality even at mission expiry', () => {
    const water = configured({ durationHours: 1, waterSafetyThresholdLiters: 34.74 });
    expect(advanceMission(water, 1).failure?.kind).toBe('water');
    const oxygen = configured({ durationHours: 1, oxygenSafetyThresholdKg: 5.02 });
    expect(advanceMission(oxygen, 1).failure?.kind).toBe('oxygen');
  });
  it('rejects physical actions after terminal status, but permits reset', () => {
    const terminal = runRedStormPaths().energy;
    for (const action of [{ type: 'ADVANCE_TIME', hours: 1 }, { type: 'SET_ENABLED', moduleId: 'greenhouse', enabled: false },
      { type: 'REPAIR_WATER_RECYCLER' }] as MissionAction[]) expect(applyMissionAction(terminal, action).ok).toBe(false);
    expect(advanceMission(terminal, 6)).toEqual(terminal);
    expect(applyMissionAction(terminal, { type: 'REWIND_TO', hour: 0, branchFrom: terminal.branchId }).ok).toBe(false);
    expect(act(terminal, { type: 'RESET_MISSION' }).hour).toBe(0);
  });
});

describe('deterministic history and autopsy', () => {
  it('replays identical states, events and snapshots; batch equals hourly stepping', () => {
    expect(runRedStormPaths()).toEqual(runRedStormPaths());
    const start = conservePower();
    const batch = advanceMission(start, 6);
    let single = start;
    for (let i = 0; i < 6; i++) single = advanceMission(single, 1);
    expect(single).toEqual(batch);
    expect(createSnapshot(single)).toEqual(createSnapshot(batch));
  });
  it('preserves every hour, same-hour actions, immutable prefix and independent futures', () => {
    let state = createInitialMission();
    let history = [createSnapshot(state)];
    for (const action of [{ type: 'SET_ENABLED', moduleId: 'greenhouse', enabled: false },
      { type: 'SET_ENABLED', moduleId: 'research-lab', enabled: false }, { type: 'ADVANCE_TIME', hours: 36 }] as MissionAction[]) {
      const record = recordMissionAction(state, history, action);
      state = record.result.state; history = record.history;
    }
    expect(new Set(history.map(s => s.snapshotId)).size).toBe(history.length);
    for (let hour = 0; hour <= 36; hour++) expect(history.some(s => s.hour === hour)).toBe(true);
    const original = structuredClone(history);
    const target = history.find(s => s.hour === 29)!;
    const branch = forkMission(history, target.snapshotId);
    const index = history.indexOf(target);
    expect(branch.snapshots.slice(0, index + 1)).toEqual(history.slice(0, index + 1));
    const next = advanceMission(branch.snapshots.at(-1)!.state, 1);
    expect(next.events.filter(e => e.type === 'PUMP_MECHANICAL_FAULT')).toHaveLength(1);
    expect(next.resources).toEqual(history.find(s => s.hour === 30)!.state.resources);
    branch.snapshots[0].state.resources.waterLiters = 1;
    expect(history).toEqual(original);
    expect(() => forkMission(history, 'missing')).toThrow();
    expect(() => forkMission([], 'missing')).toThrow();
  });
  it('explains an actual water failure and identifies the alternative repair decision', () => {
    const start = conservePower();
    const prefix = [createSnapshot(start), ...advanceMissionSteps(start, 30).map(s => createSnapshot(s))];
    const fault = prefix.at(-1)!.state;
    const historyA = [...prefix, ...advanceMissionSteps(fault, 42).map(s => createSnapshot(s))];
    const branchB = forkMission(prefix, prefix.at(-1)!.snapshotId);
    const transition = recordMissionAction(branchB.snapshots.at(-1)!.state, branchB.snapshots, { type: 'REPAIR_WATER_RECYCLER' });
    branchB.snapshots = [...transition.history, ...advanceMissionSteps(transition.result.state, 42).map(s => createSnapshot(s))];
    branchB.finalStatus = 'success';
    const comparison = compareBranches({ branchId: start.branchId, forkHour: 0, snapshots: historyA, finalStatus: 'failed' }, branchB);
    expect(comparison.branchA.rootCause?.kind).toBe('water');
    expect(comparison.branchB.status).toBe('success');
    expect(comparison.keyDivergenceFactors.join()).toContain('REPAIR_WATER_RECYCLER');
    expect(comparison.outcomeDiffDescription).not.toContain('blackout');
    expect(comparison.branchA.minimumMargins.waterLiters).toBeCloseTo(-.4);
    const summary = getMissionSummary(historyA);
    expect(summary.rootCause?.causeIds).toContain('evt-pump-fault');
    expect(summary.autopsyCauseChain.join()).toContain('0.42 L/h');
    expect(summary.minWaterLiters).toBeCloseTo(13.6);
    summary.finalResources.waterLiters = 0;
    expect(historyA.at(-1)!.state.resources.waterLiters).toBeCloseTo(13.6);
    expect(() => getMissionSummary([])).toThrow();
  });
});

it('conserves allocated power over a matrix of solar and battery supply', () => {
  for (const solar of [0, 1, 3.2, 4, 8.4, 20]) {
    for (const battery of [0, .1, 1, 15, 110, 150]) {
      const s = configured({ stormSolarGenerationKw: solar,
        initialResources: { ...RED_STORM_CONFIG.initialResources, batteryKwh: battery } });
      const result = advanceMission(s, 1);
      const p = result.power!;
      const total = Object.values(result.modules).reduce((sum, m) => sum + m.suppliedPowerKw, 0);
      expect(total).toBeCloseTo(p.suppliedPowerKw, 10);
      expect(p.suppliedPowerKw).toBeLessThanOrEqual(p.availablePowerKw + 1e-9);
      expect(p.requestedPowerKw).toBeCloseTo(p.suppliedPowerKw + p.unservedPowerKw, 10);
      expect(result.resources.batteryKwh).toBeCloseTo(Math.max(0, Math.min(150, battery + solar - total)), 10);
      for (const m of Object.values(result.modules)) {
        expect(m.suppliedPowerKw).toBeGreaterThanOrEqual(0);
        expect(m.suppliedPowerKw).toBeLessThanOrEqual(m.powerDemandKw);
      }
    }
  }
});

it('keeps physical trajectories identical until an alternative recorded decision', () => {
  const start = conservePower();
  const prefix = [createSnapshot(start), ...advanceMissionSteps(start, 29).map(s => createSnapshot(s))];
  const branch = forkMission(prefix, prefix.at(-1)!.snapshotId, 'alternative');
  const original = advanceMission(prefix.at(-1)!.state, 1);
  const replay = advanceMission(branch.snapshots.at(-1)!.state, 1);
  expect(replay.resources).toEqual(original.resources);
  expect(replay.modules).toEqual(original.modules);
  expect(replay.events).toEqual(original.events); // boundary fault has a stable scenario ID
  const alternative = act(replay, { type: 'REPAIR_WATER_RECYCLER' });
  expect(advanceMission(alternative, 4).resources.waterLiters).toEqual(advanceMission(original, 4).resources.waterLiters);
  expect(advanceMission(alternative, 5).resources.waterLiters).toBeGreaterThan(advanceMission(original, 5).resources.waterLiters);
  expect(original.modules['water-recycler'].status).toBe('degraded');
});
