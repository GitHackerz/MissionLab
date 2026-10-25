import { describe, expect, it } from 'vitest';
import { createRegisteredMission, advanceMission, applyMissionAction } from '../engine';
import { advanceEmergencySteps, applyEmergencyCommand, emergencyRules, FAULT_COMPONENT, pressureKpa, co2Ppm, totalMol, transferGas, takeGas, oxygenKpa, validateEmergencyRules, MISSIONS } from '../index';
import { createSnapshot, forkMission, recordMissionAction } from '../history';
import type { MissionState } from '../types';
import type { EmergencyCommand, FaultId, MissionId } from '../missions/types';
const P: MissionId = 'mission-02-pressure-drop', A: MissionId = 'mission-03-silent-air';
export function command(s: MissionState, c: EmergencyCommand): MissionState {
  const r = applyEmergencyCommand(s, c); if (!r.ok) throw new Error(r.reason); return r.state;
}
function diagnose(s: MissionState, fault: FaultId) {
  s = command(s, { kind: 'diagnostic', test: 'independent-analyzer' });
  return command(s, { kind: 'hypothesis', fault, evidenceIds: [s.emergency!.evidence[0].id] });
}
function repair(s: MissionState, component = FAULT_COMPONENT[s.emergency!.fault]) {
  s = command(s, { kind: 'begin-repair', component });
  for (let step = 0; step < 7; step++) s = command(s, { kind: 'procedure', step });
  return s;
}
export function correctPath(id: MissionId, fault?: FaultId) {
  let s = createRegisteredMission(id, fault);
  if (id === A) s = advanceEmergencySteps(s, 15).at(-1)!;
  s = diagnose(s, s.emergency!.fault);
  const component = FAULT_COMPONENT[s.emergency!.fault];
  if (component.endsWith('sensor')) s = command(s, { kind: 'calibrate', component });
  else {
    if (id === P) s = command(s, { kind: 'exchange', enabled: false });
    else { s = command(s, { kind: 'fan', enabled: false }); s = command(s, { kind: 'scrubber', enabled: false }); }
    s = repair(s);
    if (id === A) { s = command(s, { kind: 'fan', enabled: true }); s = command(s, { kind: 'scrubber', enabled: true }); }
  }
  s = command(s, { kind: 'verify' });
  return s.status === 'running' ? advanceMission(s, 1) : s;
}
describe('registered mission systems', () => {
  it('has unique stable IDs and initializes the correct hazard without a Red Storm event', () => {
    expect(new Set(MISSIONS.map(m => m.id)).size).toBe(3);
    for (const id of [P, A]) {
      const s = createRegisteredMission(id);
      expect(s.stormActive).toBe(false);
      expect(s.events.some(e => e.type === 'DUST_STORM_ARRIVAL')).toBe(false);
      expect(s.scenarioId).toBe(id);
      expect(s.missionVersion).toBe(1);
    }
  });
  it('conserves each gas during compartment transfers and proportional leaks', () => {
    const s = createRegisteredMission(P), a = s.emergency!.zones.hub, b = s.emergency!.zones.service;
    const sum = totalMol(a) + totalMol(b), oxygen = a.oxygenMol + b.oxygenMol;
    transferGas(a, b, 50);
    expect(totalMol(a) + totalMol(b)).toBeCloseTo(sum, 10);
    expect(a.oxygenMol + b.oxygenMol).toBeCloseTo(oxygen, 10);
    const ratio = b.oxygenMol / totalMol(b), before = totalMol(b);
    const lost = takeGas(b, 20);
    expect(lost.oxygenMol).toBeCloseTo(20 * ratio, 10);
    expect(totalMol(b)).toBeCloseTo(before - 20, 10);
  });
  it('accounts for all lost cabin oxygen separately from stored oxygen feed', () => {
    const s = createRegisteredMission(P), before = Object.values(s.emergency!.zones).reduce((n,z) => n + z.oxygenMol, 0);
    const next = advanceEmergencySteps(s, 20).at(-1)!, e = next.emergency!, r = emergencyRules(next);
    const after = Object.values(e.zones).reduce((n,z) => n + z.oxygenMol, 0);
    expect(after).toBeCloseTo(before - e.oxygenLostMol - 20 * r.crewOxygenMolPerMin + e.oxygenFedMol, 8);
    expect(next.resources.oxygenKg).toBeCloseTo(5 - e.oxygenFedMol * .032, 8);
  });
  it.each(['seal-leak', 'valve-stuck', 'pressure-sensor-drift'] as FaultId[])('Pressure Drop verifies actual recovery for %s', fault => {
    const s = correctPath(P, fault);
    expect(s.status).toBe('success'); expect(s.emergency!.verification!.passed).toBe(true);
    expect(pressureKpa(s.emergency!.zones.hub, emergencyRules(s).temperatureK)).toBeGreaterThan(90);
  });
  it('Pressure Drop ignored leak and wrong diagnosis produce measured consequences', () => {
    const ignored = advanceMission(createRegisteredMission(P), 3);
    expect(ignored.status).toBe('failed'); expect(['pressure','oxygen']).toContain(ignored.failure?.kind);
    expect(ignored.emergency!.gasLostMol).toBeGreaterThan(0);
    let wrong = diagnose(createRegisteredMission(P), 'pressure-sensor-drift');
    wrong = command(wrong, { kind: 'calibrate', component: 'pressure-sensor' });
    wrong = command(wrong, { kind: 'verify' });
    expect(wrong.emergency!.verification!.passed).toBe(false);
    expect(advanceMission(wrong, 3).status).toBe('failed');
  });
  it('stuck valve command is observably different from actual position; secondary isolation contains gas loss', () => {
    let s = createRegisteredMission(P, 'valve-stuck');
    s = command(s, { kind: 'valve', open: false });
    expect(s.emergency!.valveCommandOpen).toBe(false); expect(s.emergency!.valveActualOpen).toBe(true);
    s = command(s, { kind: 'exchange', enabled: false });
    const p = pressureKpa(s.emergency!.zones.hub, emergencyRules(s).temperatureK);
    s = advanceEmergencySteps(s, 10).at(-1)!;
    expect(pressureKpa(s.emergency!.zones.hub, emergencyRules(s).temperatureK)).toBeCloseTo(p, 1);
  });
  it('sensor-only pressure anomaly loses no physical gas and does not manufacture oxygen loss', () => {
    const s = advanceEmergencySteps(createRegisteredMission(P, 'pressure-sensor-drift'), 10).at(-1)!;
    expect(s.emergency!.gasLostMol).toBe(0); expect(s.emergency!.oxygenLostMol).toBe(0);
  });
  it.each(['fan-failure','media-exhausted','co2-sensor-drift'] as FaultId[])('Silent Air verifies %s using the corresponding intervention', fault => {
    const s = correctPath(A, fault);
    expect(s.status).toBe('success'); expect(s.emergency!.verification!.passed).toBe(true);
    expect(co2Ppm(s.emergency!.zones.hub)).toBeLessThan(emergencyRules(s).recoveryCo2Ppm);
  });
  it('Silent Air ignored failure is CO₂ accumulation while oxygen remains safe', () => {
    const s = advanceMission(createRegisteredMission(A), 12);
    expect(s.failure?.kind).toBe('co2'); expect(s.resources.oxygenKg).toBeGreaterThan(1.5);
    expect(oxygenKpa(s.emergency!.zones.hub, emergencyRules(s).temperatureK)).toBeGreaterThan(16);
  });
  it('wrong replacement consumes a spare and time, but does not restore exhausted media', () => {
    let s = advanceEmergencySteps(createRegisteredMission(A, 'media-exhausted'), 15).at(-1)!;
    s = diagnose(s, 'fan-failure'); s = command(s, { kind: 'fan', enabled: false }); s = command(s, { kind: 'scrubber', enabled: false });
    s = repair(s, 'fan'); s = command(s, { kind: 'fan', enabled: true }); s = command(s, { kind: 'scrubber', enabled: true }); s = command(s, { kind: 'verify' });
    expect(s.emergency!.spares.fan).toBe(0); expect(s.emergency!.verification!.passed).toBe(false);
    expect(advanceMission(s, 12).failure?.kind).toBe('co2');
  });
  it('sensor calibration does not remove physical CO₂ or spend a replacement cartridge', () => {
    let s = createRegisteredMission(A, 'co2-sensor-drift'); s = advanceEmergencySteps(s, 20).at(-1)!;
    const before = s.emergency!.co2RemovedMol;
    s = diagnose(s, 'co2-sensor-drift'); s = command(s, { kind: 'calibrate', component: 'co2-sensor' });
    expect(s.emergency!.spares['co2-sensor']).toBe(1);
    expect(s.emergency!.co2RemovedMol - before).toBeLessThanOrEqual(.12 * 6 + 1e-8);
  });
  it('rejects unsafe maintenance, invalid payloads and terminal actions without mutation', () => {
    const s = createRegisteredMission(P), copy = structuredClone(s);
    expect(applyEmergencyCommand(s, { kind: 'begin-repair', component: 'seal' }).ok).toBe(false);
    expect(applyEmergencyCommand(s, { kind: 'valve', open: 1 } as unknown as EmergencyCommand).ok).toBe(false);
    expect(s).toEqual(copy);
    for (const minutes of [NaN, Infinity, 0, -.1, 1.5]) expect(applyMissionAction(s,{ type: 'ADVANCE_MINUTES', minutes }).ok).toBe(false);
    const ended = correctPath(P);
    expect(applyEmergencyCommand(ended, { kind: 'diagnostic', test: 'leak-survey' }).ok).toBe(false);
  });
  it('rejects invalid model configurations', () => {
    for (const value of [NaN, Infinity, -1]) expect(() => validateEmergencyRules({ ...emergencyRules(createRegisteredMission(P)), crewCo2MolPerMin: value })).toThrow();
  });
  it('batch progression equals minute stepping, events occur once at the exact boundary', () => {
    const initial = createRegisteredMission(A);
    let step = initial;
    for (let n = 0; n < 20; n++) step = advanceEmergencySteps(step,1)[0];
    expect(step).toEqual(advanceEmergencySteps(initial,20).at(-1));
    expect(step.events.filter(e => e.type === 'ATMOSPHERE_WARNING')).toHaveLength(1);
    expect(step.events.find(e => e.type === 'ATMOSPHERE_WARNING')!.hour).toBe(.25);
    expect(initial.emergency!.minute).toBe(0);
  });
  it('minute history and independent terminal rewind preserve selected mission and original future', () => {
    const initial = createRegisteredMission(P);
    const run = recordMissionAction(initial,[createSnapshot(initial)],{ type: 'ADVANCE_MINUTES', minutes: 180 });
    expect(run.result.state.status).toBe('failed');
    const copy = structuredClone(run.history), branch = forkMission(run.history, run.history[0].snapshotId);
    let s = branch.snapshots.at(-1)!.state;
    s = diagnose(s,'seal-leak'); s = command(s,{kind:'valve',open:false}); s = command(s,{kind:'verify'});
    expect(s.status).toBe('success'); expect(s.scenarioId).toBe(P); expect(run.history).toEqual(copy);
    expect(run.history.some(x=>x.state.emergency!.minute===5)).toBe(true);
  });
});

it('CO₂ balance equals crew production minus actual removal and treatment needs actual electricity',()=>{
  const initial=createRegisteredMission(A), before=initial.emergency!.zones.hub.co2Mol;
  const next=advanceEmergencySteps(initial,20).at(-1)!, e=next.emergency!, r=emergencyRules(next);
  expect(e.zones.hub.co2Mol).toBeCloseTo(before+20*r.crewCo2MolPerMin-e.co2RemovedMol,10);
  const unpowered=createRegisteredMission(A);unpowered.config!.normalSolarGenerationKw=0;unpowered.resources.batteryKwh=0;
  const shortage=advanceEmergencySteps(unpowered,1)[0];
  expect(shortage.emergency!.co2RemovalMolPerMin).toBe(0);expect(shortage.failure!.kind).toBe('power');
});
it('backup treatment spends only the actual removed quantity and is bounded by its capacity',()=>{
  let s=createRegisteredMission(A);s.emergency!.backupRemainingMol=.01;
  s=command(s,{kind:'backup',enabled:true});
  expect(s.emergency!.backupRemainingMol).toBe(0);
  const removed=s.emergency!.co2RemovedMol;s=advanceEmergencySteps(s,1)[0];
  expect(s.emergency!.co2RemovedMol-removed).toBeLessThanOrEqual(emergencyRules(s).scrubberMolPerMin+1e-9);
});
it('Silent Air rewind preserves fault boundaries and original nested state',()=>{
  const start=createRegisteredMission(A);
  const history=[createSnapshot(start),...advanceEmergencySteps(start,260).map(s=>createSnapshot(s))];
  expect(history.at(-1)!.state.status).toBe('failed');
  const copy=structuredClone(history), target=history.find(s=>s.state.emergency!.minute===14)!;
  const branch=forkMission(history,target.snapshotId,'air-alternative');
  const replay=advanceEmergencySteps(branch.snapshots.at(-1)!.state,1)[0];
  expect(replay.emergency!.faultTriggered).toBe(true);
  expect(replay.events.filter(e=>e.type==='ATMOSPHERE_WARNING')).toHaveLength(1);
  branch.snapshots.at(-1)!.state.emergency!.backupRemainingMol=0;
  expect(history).toEqual(copy);
});
it('backup pressure regulation conserves reserve gas and its oxygen fraction',()=>{
  let s=createRegisteredMission(P);
  const totalBefore=Object.values(s.emergency!.zones).reduce((n,z)=>n+totalMol(z),0);
  const oxygenBefore=Object.values(s.emergency!.zones).reduce((n,z)=>n+z.oxygenMol,0);
  const reserve=s.emergency!.atmosphereReserveMol;
  s=command(s,{kind:'regulator',enabled:true});s=advanceEmergencySteps(s,4).at(-1)!;
  const e=s.emergency!,r=emergencyRules(s), injected=reserve-e.atmosphereReserveMol;
  expect(injected).toBeGreaterThan(0);
  expect(Object.values(e.zones).reduce((n,z)=>n+totalMol(z),0)).toBeCloseTo(totalBefore-e.gasLostMol+injected+5*r.crewCo2MolPerMin-e.co2RemovedMol-5*r.crewOxygenMolPerMin+e.oxygenFedMol,8);
  expect(Object.values(e.zones).reduce((n,z)=>n+z.oxygenMol,0)).toBeCloseTo(oxygenBefore-e.oxygenLostMol+injected*r.initialOxygenFraction-5*r.crewOxygenMolPerMin+e.oxygenFedMol,8);
});
it('does not declare Silent Air recovery from a pre-fault baseline test',()=>{
  let s=createRegisteredMission(A);
  s=command(s,{kind:'diagnostic',test:'independent-analyzer'});
  s=command(s,{kind:'hypothesis',fault:'fan-failure',evidenceIds:[s.emergency!.evidence[0].id]});
  const result=applyEmergencyCommand(s,{kind:'verify'});
  expect(result.ok).toBe(false);expect(result.state.status).toBe('running');
});
it('allows a genuinely effective backup treatment strategy without forcing the original-part replacement',()=>{
  let s=advanceEmergencySteps(createRegisteredMission(A),15).at(-1)!;
  s=command(s,{kind:'diagnostic',test:'fan-test'});
  s=command(s,{kind:'hypothesis',fault:'fan-failure',evidenceIds:[s.emergency!.evidence[0].id]});
  s=command(s,{kind:'backup',enabled:true});s=command(s,{kind:'verify'});
  expect(s.status).toBe('success');expect(s.emergency!.repairs).toHaveLength(0);
  expect(s.emergency!.backupRemainingMol).toBeLessThan(emergencyRules(s).backupCapacityMol);
});
it('does not ignore unsafe essential reserves during atmospheric verification',()=>{
  const s=createRegisteredMission(P);s.resources.waterLiters=14;
  expect(advanceEmergencySteps(s,1)[0].failure!.kind).toBe('water');
});
it('judges hypotheses from selected evidence without revealing the hidden answer',async()=>{
  const { atmosphericEvidenceSupport }=await import('../missions/emergency');
  const s=createRegisteredMission(P);
  const baseline=command(s,{kind:'diagnostic',test:'independent-analyzer'});
  expect(atmosphericEvidenceSupport('seal-leak',baseline.emergency!.evidence)).toBe('none');
  const survey=command(baseline,{kind:'diagnostic',test:'leak-survey'});
  expect(atmosphericEvidenceSupport('seal-leak',survey.emergency!.evidence)).toBe('strong');
  expect(atmosphericEvidenceSupport('valve-stuck',survey.emergency!.evidence)).toBe('none');
});
