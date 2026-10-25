import { describe, expect, it } from 'vitest';
import {
  advanceMission,
  applyMissionAction,
  assessLearning,
  createInitialMission,
  forecastPlan,
  getGuidance,
  getRecyclerOperation,
  getWaterRecoveryLph,
  type MissionAction,
  type MissionState,
  type RecyclerFaultKind,
  type ReplaceableId,
  type TrainingStepAction,
} from '../index';

const step = (s: TrainingStepAction): MissionAction => ({ type: 'TRAINING_STEP', step: s });
const SHED = { greenhouse: false, 'research-lab': false } as const;

function run(state: MissionState, action: MissionAction) {
  const r = applyMissionAction(state, action);
  return r;
}
function must(state: MissionState, action: MissionAction): MissionState {
  const r = run(state, action);
  if (!r.ok) throw new Error(`rejected ${JSON.stringify(action)}: ${r.reason}`);
  return r.state;
}
function mission(fault: RecyclerFaultKind = 'pump-seized'): MissionState {
  const s = createInitialMission();
  s.training!.recycler.faultKind = fault;
  return s;
}
/** Plan applied at hour 0, then time advanced to the fault. */
function atFault(fault: RecyclerFaultKind = 'pump-seized'): MissionState {
  let s = must(mission(fault), { type: 'APPLY_POWER_PLAN', loads: SHED });
  s = advanceMission(s, 30);
  return s;
}
function diagnoseAll(s: MissionState): MissionState {
  return must(s, { type: 'RUN_DIAGNOSTIC', testId: 'run-diagnostic-cycle' });
}
function recordCorrect(s: MissionState, kind: RecyclerFaultKind): MissionState {
  const ids = s.training!.evidence.map((e) => e.id);
  return must(s, { type: 'RECORD_HYPOTHESIS', kind, evidenceIds: ids });
}
function prepare(s: MissionState): MissionState {
  s = must(s, step({ step: 'IDENTIFY_EQUIPMENT', moduleId: 'water-recycler' }));
  s = must(s, step({ step: 'REVIEW_ISOLATION' }));
  s = must(s, step({ step: 'ENTER_MAINTENANCE_MODE' }));
  s = must(s, step({ step: 'CONFIRM_INACTIVE' }));
  s = must(s, step({ step: 'SELECT_TOOL', tool: 'hatch-key' }));
  s = must(s, step({ step: 'OPEN_HATCH' }));
  return s;
}
function swap(s: MissionState, slot: ReplaceableId, part: ReplaceableId = slot): MissionState {
  s = must(s, step({ step: 'SELECT_TOOL', tool: 'retainer-driver' }));
  s = must(s, step({ step: 'LOCATE_COMPONENT', slot }));
  s = must(s, step({ step: 'RELEASE_RETAINERS', slot }));
  s = must(s, step({ step: 'REMOVE_COMPONENT', slot }));
  s = must(s, step({ step: 'TAKE_SPARE', part }));
  s = must(s, step({ step: 'INSPECT_SPARE' }));
  for (let i = 0; i < 2; i++) s = must(s, step({ step: 'ROTATE_PART' }));
  s = must(s, step({ step: 'INSTALL_COMPONENT', slot }));
  s = must(s, step({ step: 'SECURE_COMPONENT', slot }));
  return s;
}
function finish(s: MissionState): MissionState {
  s = must(s, step({ step: 'CLOSE_HATCH' }));
  s = must(s, step({ step: 'RESTORE_TEST_READY' }));
  return must(s, step({ step: 'RUN_STARTUP_TEST' }));
}

describe('fault model and sensor consistency', () => {
  it('reports only the symptom when the fault occurs', () => {
    const s = atFault();
    const evt = s.events.find((e) => e.type === 'WATER_RECOVERY_LOW');
    expect(evt).toBeDefined();
    expect(evt!.message.toLowerCase()).not.toContain('pump');
    expect(getWaterRecoveryLph(s)).toBe(0);
  });

  it('gives distinguishable, internally consistent evidence for each fault', () => {
    const read = (kind: RecyclerFaultKind) => {
      const s = diagnoseAll(atFault(kind));
      const m = Object.fromEntries(s.training!.evidence[0].readings.map((r) => [r.id, r.value]));
      return m as Record<string, number>;
    };
    const pump = read('pump-seized');
    expect(pump['pump-rpm']).toBe(0);
    expect(pump['pump-power-kw']).toBeGreaterThan(0.8); // locked rotor draws power but does not turn
    expect(pump['circulation-flow-lph']).toBe(0);
    expect(Math.abs(pump['pressure-in-kpa'] - pump['pressure-out-kpa'])).toBeLessThan(10);

    const filter = read('filter-clogged');
    expect(filter['pump-rpm']).toBe(3000);
    expect(filter['circulation-flow-lph']).toBeLessThan(5);
    expect(filter['pressure-in-kpa'] - filter['pressure-out-kpa']).toBeGreaterThan(150);

    const sensor = read('sensor-drift');
    expect(sensor['pump-rpm']).toBe(3000);
    expect(sensor['sensor-reported-recovery-lph']).toBeLessThan(0.2);
    expect(sensor['clean-tank-inflow-lph']).toBeCloseTo(0.42);
  });

  it('a sensor fault does not actually reduce water recovery', () => {
    const s = atFault('sensor-drift');
    expect(getWaterRecoveryLph(s)).toBeCloseTo(0.42);
    expect(getRecyclerOperation(s).activeFault).toBe('sensor-drift');
  });

  it('is deterministic', () => {
    expect(JSON.stringify(atFault())).toEqual(JSON.stringify(atFault()));
  });

  it('rates how well evidence supports a hypothesis without revealing the answer', () => {
    let s = atFault('filter-clogged');
    s = must(s, { type: 'RUN_DIAGNOSTIC', testId: 'check-pump' });
    s = must(s, { type: 'RUN_DIAGNOSTIC', testId: 'read-pressure' });
    const ids = s.training!.evidence.map((e) => e.id);
    s = must(s, { type: 'RECORD_HYPOTHESIS', kind: 'filter-clogged', evidenceIds: ids });
    s = must(s, { type: 'RECORD_HYPOTHESIS', kind: 'pump-seized', evidenceIds: ids });
    expect(s.training!.hypotheses.map((h) => h.support)).toEqual(['strong', 'none']);
  });
});

describe('procedure validation', () => {
  it('requires a recorded diagnosis, isolation review and maintenance mode before servicing', () => {
    let s = atFault();
    expect(run(s, step({ step: 'ENTER_MAINTENANCE_MODE' })).ok).toBe(false);
    s = recordCorrect(diagnoseAll(s), 'pump-seized');
    const r = run(s, step({ step: 'ENTER_MAINTENANCE_MODE' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/isolation/i);
    expect(run(s, step({ step: 'OPEN_HATCH' })).ok).toBe(false);
  });

  it('enforces tool, order, compatibility and orientation, and never consumes a spare on rejection', () => {
    let s = recordCorrect(diagnoseAll(atFault()), 'pump-seized');
    s = prepare(s);
    // wrong tool
    expect(run(s, step({ step: 'RELEASE_RETAINERS', slot: 'pump-cartridge' })).ok).toBe(false);
    s = must(s, step({ step: 'SELECT_TOOL', tool: 'retainer-driver' }));
    // retainers still locked
    expect(run(s, step({ step: 'REMOVE_COMPONENT', slot: 'pump-cartridge' })).ok).toBe(false);
    s = must(s, step({ step: 'RELEASE_RETAINERS', slot: 'pump-cartridge' }));
    s = must(s, step({ step: 'REMOVE_COMPONENT', slot: 'pump-cartridge' }));
    // incompatible part
    s = must(s, step({ step: 'TAKE_SPARE', part: 'filter-cartridge' }));
    s = must(s, step({ step: 'INSPECT_SPARE' }));
    s = must(s, step({ step: 'ROTATE_PART' }));
    s = must(s, step({ step: 'ROTATE_PART' }));
    const bad = run(s, step({ step: 'INSTALL_COMPONENT', slot: 'pump-cartridge' }));
    expect(bad.ok).toBe(false);
    expect(s.training!.inventory.filterCartridges).toBe(1);
    // cannot close with an empty bay
    expect(run(s, step({ step: 'CLOSE_HATCH' })).ok).toBe(false);
    // wrong orientation for a compatible part
    let t = recordCorrect(diagnoseAll(atFault()), 'pump-seized');
    t = prepare(t);
    t = must(t, step({ step: 'SELECT_TOOL', tool: 'retainer-driver' }));
    t = must(t, step({ step: 'RELEASE_RETAINERS', slot: 'pump-cartridge' }));
    t = must(t, step({ step: 'REMOVE_COMPONENT', slot: 'pump-cartridge' }));
    t = must(t, step({ step: 'TAKE_SPARE', part: 'pump-cartridge' }));
    expect(run(t, step({ step: 'INSTALL_COMPONENT', slot: 'pump-cartridge' })).ok).toBe(false); // not inspected
    t = must(t, step({ step: 'INSPECT_SPARE' }));
    const misaligned = run(t, step({ step: 'INSTALL_COMPONENT', slot: 'pump-cartridge' }));
    expect(misaligned.ok).toBe(false);
    expect(t.resources.sparePumps).toBe(1);
  });

  it('cannot take a spare that does not exist', () => {
    let s = recordCorrect(diagnoseAll(atFault()), 'pump-seized');
    s = prepare(s);
    s.resources.sparePumps = 0;
    const r = run(s, step({ step: 'TAKE_SPARE', part: 'pump-cartridge' }));
    expect(r.ok).toBe(false);
  });

  it('cannot close the hatch with an unsecured cartridge, and supports interruption and retry', () => {
    let s = recordCorrect(diagnoseAll(atFault()), 'pump-seized');
    s = prepare(s);
    s = must(s, step({ step: 'SELECT_TOOL', tool: 'retainer-driver' }));
    s = must(s, step({ step: 'RELEASE_RETAINERS', slot: 'pump-cartridge' }));
    s = must(s, step({ step: 'REMOVE_COMPONENT', slot: 'pump-cartridge' }));
    s = must(s, step({ step: 'TAKE_SPARE', part: 'pump-cartridge' }));
    s = must(s, step({ step: 'INSPECT_SPARE' }));
    s = must(s, step({ step: 'ROTATE_PART' }));
    s = must(s, step({ step: 'ROTATE_PART' }));
    s = must(s, step({ step: 'INSTALL_COMPONENT', slot: 'pump-cartridge' }));
    expect(run(s, step({ step: 'CLOSE_HATCH' })).ok).toBe(false);
    s = must(s, step({ step: 'SECURE_COMPONENT', slot: 'pump-cartridge' }));
    // interruption: hatch open, all bays filled
    const aborted = must(s, step({ step: 'ABORT_PROCEDURE' }));
    expect(aborted.training!.recycler.procedure.maintenanceMode).toBe(false);
    expect(aborted.training!.recycler.procedure.hatchOpen).toBe(false);
    // retry the procedure from scratch is allowed
    const again = must(aborted, step({ step: 'ENTER_MAINTENANCE_MODE' }));
    expect(again.training!.recycler.procedure.maintenanceMode).toBe(true);
  });
});

describe('repair outcomes', () => {
  it('correct pump replacement restores recovery, consumes the spare, costs time and is verified from engine state', () => {
    let s = recordCorrect(diagnoseAll(atFault()), 'pump-seized');
    const waterBefore = s.resources.waterLiters;
    const hourBefore = s.hour;
    s = prepare(s);
    s = swap(s, 'pump-cartridge');
    expect(getWaterRecoveryLph(s)).toBe(0); // maintenance: recovery is paused while the unit is open
    s = finish(s);
    const p = s.training!.recycler.procedure;
    expect(p.verification?.passed).toBe(true);
    expect(p.phase).toBe('completed');
    expect(s.resources.sparePumps).toBe(0);
    expect(getWaterRecoveryLph(s)).toBeCloseTo(0.42);
    expect(s.modules['water-recycler'].status).toBe('operational');
    expect(s.hour).toBeGreaterThan(hourBefore);
    expect(s.resources.waterLiters).toBeLessThan(waterBefore); // reserves kept dropping during the work
  });

  it('wrong replacement does not fix the fault, consumes a spare and fails verification', () => {
    let s = recordCorrect(diagnoseAll(atFault('filter-clogged')), 'pump-seized');
    s = prepare(s);
    s = must(s, step({ step: 'SELECT_TOOL', tool: 'retainer-driver' }));
    s.resources.sparePumps = 1;
    s = swap(s, 'pump-cartridge');
    s = finish(s);
    const p = s.training!.recycler.procedure;
    expect(p.verification?.passed).toBe(false);
    expect(p.phase).toBe('failed-verification');
    expect(s.resources.sparePumps).toBe(0);
    expect(getRecyclerOperation(s).activeFault).toBe('filter-clogged');
    expect(getWaterRecoveryLph(s)).toBeLessThan(0.42);
    // Root cause stays hidden while the mission is still running...
    expect(assessLearning(s)!.causalChain.join(' ')).not.toMatch(/blocked filter/i);
    // ...and is explained from the recorded evidence once the mission has concluded.
    const ended = advanceMission(s, 72);
    expect(ended.status).not.toBe('running');
    const a = assessLearning(ended)!;
    expect(a.causalChain.join(' ')).toMatch(/blocked filter/i);
    expect(a.dimensions.find((d) => d.id === 'fault-diagnosis')!.explanation).toMatch(/filter/i);
  });

  it('replacing the filter or the sensor resolves those faults', () => {
    for (const [fault, slot] of [['filter-clogged', 'filter-cartridge'], ['sensor-drift', 'flow-sensor']] as const) {
      let s = recordCorrect(diagnoseAll(atFault(fault)), fault);
      s = prepare(s);
      s = swap(s, slot);
      s = finish(s);
      expect(s.training!.recycler.procedure.verification?.passed).toBe(true);
    }
  });

  it('retry after a failed verification can succeed', () => {
    let s = recordCorrect(diagnoseAll(atFault('filter-clogged')), 'filter-clogged');
    s = prepare(s);
    s = swap(s, 'pump-cartridge');
    s = finish(s);
    expect(s.training!.recycler.procedure.verification?.passed).toBe(false);
    s = must(s, step({ step: 'ENTER_MAINTENANCE_MODE' }));
    s = must(s, step({ step: 'CONFIRM_INACTIVE' }));
    s = must(s, step({ step: 'SELECT_TOOL', tool: 'hatch-key' }));
    s = must(s, step({ step: 'OPEN_HATCH' }));
    s = swap(s, 'filter-cartridge');
    s = finish(s);
    expect(s.training!.recycler.procedure.verification?.passed).toBe(true);
    expect(s.resources.sparePumps).toBe(0);
    expect(s.training!.inventory.filterCartridges).toBe(0);
  });

  it('rejects the legacy one-click repair when the training model is active', () => {
    const s = atFault();
    expect(run(s, { type: 'REPAIR_WATER_RECYCLER' }).ok).toBe(false);
  });
});

describe('mission outcomes, power and replay', () => {
  it('all loads on in the storm fails; shedding optional loads survives the power crisis', () => {
    let reckless = createInitialMission();
    reckless = advanceMission(reckless, 72);
    expect(reckless.status).toBe('failed');
    expect(reckless.failureReason).toMatch(/power/i);

    const f = forecastPlan(createInitialMission(), SHED);
    expect(f.minBatteryKwh).toBeGreaterThan(15);
  });

  it('forecast agrees with the real engine and flags unsafe plans', () => {
    const s = createInitialMission();
    const forecast = forecastPlan(s, SHED);
    const real = advanceMission(applyMissionAction(s, { type: 'APPLY_POWER_PLAN', loads: SHED }).state, 10);
    expect(forecast.samples[10].batteryKwh).toBeCloseTo(real.resources.batteryKwh, 6);

    const unsafe = forecastPlan(s, { ...SHED, 'life-support': false });
    expect(unsafe.risks.some((r) => r.severity === 'critical')).toBe(true);
    expect(unsafe.outcome).toBe('failed');
  });

  it('unrepaired fault ends the mission below the water safety threshold; repair succeeds', () => {
    const ignored = advanceMission(atFault(), 42);
    expect(ignored.status).toBe('failed');
    expect(ignored.failureReason).toMatch(/water/i);

    let s = recordCorrect(diagnoseAll(atFault()), 'pump-seized');
    s = finish(swap(prepare(s), 'pump-cartridge'));
    const done = advanceMission(s, 72);
    expect(done.status).toBe('success');
    expect(done.resources.foodRations).toBeGreaterThan(0);
  });

  it('greenhouse trade-off: lit crops grow food, a dark greenhouse does not', () => {
    const lit = advanceMission(createInitialMission(), 10);
    const dark = advanceMission(applyMissionAction(createInitialMission(), { type: 'APPLY_POWER_PLAN', loads: { greenhouse: false } }).state!, 10);
    expect(lit.training!.cropGrowthHours).toBe(10);
    expect(dark.training!.cropGrowthHours).toBe(0);
    expect(lit.resources.foodRations).toBeGreaterThan(dark.resources.foodRations);
  });

  it('snapshots restore spares, procedure progress and recovery exactly', () => {
    let s = recordCorrect(diagnoseAll(atFault()), 'pump-seized');
    const snapshot = JSON.parse(JSON.stringify(s)) as MissionState;
    s = finish(swap(prepare(s), 'pump-cartridge'));
    expect(s.resources.sparePumps).toBe(0);
    const replay = finish(swap(prepare(snapshot), 'pump-cartridge'));
    expect(JSON.stringify(replay)).toEqual(JSON.stringify(s));
    expect(snapshot.resources.sparePumps).toBe(1);
    expect(snapshot.training!.recycler.procedure.phase).toBe('diagnosis-recorded');
  });

  it('guidance tracks the stage and hides hints outside Cadet mode', () => {
    const s0 = createInitialMission();
    expect(getGuidance(s0).stage).toBe('power-plan');
    expect(getGuidance(s0).hint).toBeDefined();
    const commander = must(s0, { type: 'SET_LEARNING_MODE', mode: 'commander' });
    expect(getGuidance(commander).hint).toBeUndefined();
    expect(getGuidance(atFault()).stage).toBe('diagnose-start');
  });

  it('records rejected actions as learning evidence', () => {
    const s = atFault();
    const r = run(s, step({ step: 'OPEN_HATCH' }));
    expect(r.ok).toBe(false);
    expect(r.state.training!.log.some((l) => !l.ok && l.action === 'OPEN_HATCH')).toBe(true);
  });
});
