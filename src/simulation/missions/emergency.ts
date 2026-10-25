import type { ActionResult, MissionState, ModuleId } from '../types';
import { recordEvent } from '../events';
import { getMission } from './registry';
import { co2Ppm, GAS_CONSTANT, OXYGEN_KG_PER_MOL, oxygenKpa, pressureKpa, takeGas, transferGas } from './gas';
import type { ComponentId, DiagnosticRecord, EmergencyCommand, EmergencyRules, FaultId, GasZone, Reading, TestId } from './types';

export const COMPONENT_LABELS: Record<ComponentId, string> = { seal: 'Hatch seal', valve: 'Isolation valve', 'pressure-sensor': 'Pressure sensor', fan: 'Circulation fan', scrubber: 'Scrubber cartridge', 'co2-sensor': 'CO₂ sensor' };
export const FAULT_COMPONENT: Record<FaultId, ComponentId> = { 'seal-leak': 'seal', 'valve-stuck': 'valve', 'pressure-sensor-drift': 'pressure-sensor', 'fan-failure': 'fan', 'media-exhausted': 'scrubber', 'co2-sensor-drift': 'co2-sensor' };
export const TEST_LABELS: Record<TestId, string> = { 'zone-survey': 'Compare compartment gauges', 'independent-analyzer': 'Independent gas analyzer', 'valve-test': 'Command / position comparison', 'leak-survey': 'Hatch leak survey', 'fan-test': 'Fan speed and power test', 'scrubber-test': 'Scrubber inlet / outlet test' };
export const PROCEDURE_STEPS = [
  { label: 'Review isolation and confirm safe access', minutes: 1 },
  { label: 'Select compatible service tool', minutes: 1 },
  { label: 'Open service cover', minutes: 1 },
  { label: 'Remove the selected component', minutes: 2 },
  { label: 'Inspect and seat a compatible spare', minutes: 3 },
  { label: 'Secure component and close cover', minutes: 1 },
  { label: 'Restore the equipment to service', minutes: 1 },
];
export function emergencyRules(s: MissionState): EmergencyRules { return getMission(s.scenarioId).emergency!; }
export function activeFault(s: MissionState): FaultId | null {
  const e = s.emergency!;
  return e.faultTriggered && !e.repairs.includes(FAULT_COMPONENT[e.fault]) ? e.fault : null;
}
function newZone(volumeM3: number, r: EmergencyRules): GasZone {
  const n = r.initialPressureKpa * volumeM3 / (GAS_CONSTANT * r.temperatureK);
  return { volumeM3, oxygenMol: n * r.initialOxygenFraction, co2Mol: n * r.initialCo2Ppm / 1e6,
    inertMol: n * (1 - r.initialOxygenFraction - r.initialCo2Ppm / 1e6) };
}
export function initializeEmergency(base: MissionState, fault?: FaultId): MissionState {
  const s = structuredClone(base), def = getMission(s.scenarioId), r = def.emergency!;
  validateEmergencyRules(r);
  const selected = fault ?? r.defaultFault;
  if (!def.components.includes(FAULT_COMPONENT[selected])) throw new RangeError('Fault is not supported by this mission.');
  s.missionVersion = def.version;
  s.emergency = { kind: def.id === 'mission-02-pressure-drop' ? 'pressure' : 'air', minute: 0, sequence: 0, mode: 'cadet', fault: selected, faultTriggered: false,
    zones: { hub: newZone(r.hubVolumeM3, r), service: newZone(r.serviceVolumeM3, r) }, crewZone: 'hub',
    valveCommandOpen: true, valveActualOpen: true, exchangeEnabled: true, regulatorEnabled: false,
    fanEnabled: true, scrubberEnabled: true, backupEnabled: false, atmosphereReserveMol: r.atmosphereReserveMol,
    scrubberRemainingMol: r.scrubberCapacityMol, backupRemainingMol: r.backupCapacityMol,
    gasLostMol: 0, oxygenLostMol: 0, oxygenFedMol: 0, co2RemovedMol: 0, leakMolPerMin: 0, co2RemovalMolPerMin: 0,
    pressureTrendKpaPerMin: 0, co2TrendPpmPerMin: 0, equipmentSupplyKw: 0, equipmentDemandKw: 0,
    inspected: [], evidence: [], hypotheses: [], repairs: [], spares: { seal: 1, valve: 1, 'pressure-sensor': 1, fan: 1, scrubber: 1, 'co2-sensor': 1 },
    procedure: null, verification: null, stableMinutes: 0, lastFeedback: 'Compare instruments before deciding which component to service.' };
  // Optional loads start suspended in a focused engineering emergency, but remain controllable.
  for (const id of ['greenhouse', 'research-lab'] as const) { s.modules[id].enabled = false; s.modules[id].suppliedPowerKw = 0; s.modules[id].status = 'offline'; }
  trigger(s);
  allocate(s, false);
  return s;
}
export function validateEmergencyRules(r: EmergencyRules): void {
  for (const [key, value] of Object.entries(r)) if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) throw new RangeError(`${key} must be finite and nonnegative.`);
  for (const value of [r.temperatureK, r.hubVolumeM3, r.initialPressureKpa]) if (value <= 0) throw new RangeError('Temperature, occupied volume and initial pressure must be positive.');
  for (const value of [r.faultMinute, r.durationMinutes, r.verificationMinutes]) if (!Number.isSafeInteger(value)) throw new RangeError('Scheduled times must be integer minutes.');
  if (r.durationMinutes <= 0 || r.verificationMinutes <= 0 || r.initialOxygenFraction <= 0 || r.initialOxygenFraction + r.initialCo2Ppm / 1e6 >= 1) throw new RangeError('Invalid time or atmospheric composition.');
}
function trigger(s: MissionState): void {
  const e = s.emergency!, r = emergencyRules(s);
  if (!e.faultTriggered && e.minute >= r.faultMinute) {
    e.faultTriggered = true;
    if (e.fault === 'media-exhausted') e.scrubberRemainingMol = 0;
    recordEvent(s, { type: 'ATMOSPHERE_WARNING', severity: 'warning', moduleId: 'life-support',
      message: e.kind === 'pressure' ? 'A compartment gauge reports a pressure anomaly. Compare independent readings.' : 'The CO₂ monitor reports an abnormal trend. Investigate circulation and gas treatment.' });
  }
}
/** Full supply is required for fans, scrubbers and regulators; optional loads are served last. */
function allocate(s: MissionState, consume: boolean): boolean {
  const e = s.emergency!, r = emergencyRules(s);
  const extra = (e.fanEnabled ? r.fanKw : 0) + (e.scrubberEnabled ? r.scrubberKw : 0)
    + (e.regulatorEnabled ? r.regulatorKw : 0) + (e.backupEnabled ? r.backupKw : 0);
  s.modules['life-support'].powerDemandKw = 2 + extra;
  const solar = s.modules['solar-array'].enabled ? s.config!.normalSolarGenerationKw : 0;
  const available = solar + s.resources.batteryKwh * 60;
  let budget = available, demand = 0, served = 0;
  for (const id of ['life-support', 'crew-habitat', 'water-recycler', 'greenhouse', 'research-lab'] as ModuleId[]) {
    const m = s.modules[id], requested = m.enabled ? m.powerDemandKw : 0;
    m.suppliedPowerKw = Math.min(requested, Math.max(0, budget)); budget -= m.suppliedPowerKw;
    demand += requested; served += m.suppliedPowerKw;
    m.status = !m.enabled || m.suppliedPowerKw === 0 ? 'offline' : m.suppliedPowerKw + 1e-9 < requested ? 'warning' : 'operational';
  }
  s.power = { solarGenerationKw: solar, requestedPowerKw: demand, availablePowerKw: available, suppliedPowerKw: served, unservedPowerKw: Math.max(0, demand - served) };
  if (consume) s.resources.batteryKwh = Math.max(0, Math.min(s.resources.batteryCapacityKwh, s.resources.batteryKwh + (solar - served) / 60));
  const life = s.modules['life-support'];
  const powered = life.enabled && life.suppliedPowerKw + 1e-9 >= life.powerDemandKw;
  e.equipmentDemandKw = extra; e.equipmentSupplyKw = powered ? extra : 0;
  if (activeFault(s)) {
    const affected=s.modules[e.kind==='pressure'?'crew-habitat':'life-support'];
    if(affected.status==='operational') affected.status='warning';
  }
  return powered;
}
export function emergencyReadings(s: MissionState, test: TestId): Reading[] {
  const e = s.emergency!, r = emergencyRules(s), fault = activeFault(s), z = e.zones[e.crewZone];
  const p = pressureKpa(z, r.temperatureK), ppm = co2Ppm(z);
  switch (test) {
    case 'zone-survey': return [
      { label: 'Hub panel pressure', value: pressureKpa(e.zones.hub, r.temperatureK) - (fault === 'pressure-sensor-drift' ? 18 : 0), unit: 'kPa' },
      { label: 'Service pressure', value: pressureKpa(e.zones.service, r.temperatureK), unit: 'kPa' },
      { label: 'Occupied-zone pressure trend', value: e.pressureTrendKpaPerMin, unit: 'kPa/min' }];
    case 'independent-analyzer': return [{ label: 'Independent pressure', value: p, unit: 'kPa' }, { label: 'Oxygen partial pressure', value: oxygenKpa(z, r.temperatureK), unit: 'kPa' },
      { label: 'Independent CO₂', value: ppm, unit: 'ppm' }, { label: 'Panel CO₂', value: ppm + (fault === 'co2-sensor-drift' ? 2200 : 0), unit: 'ppm' }, { label:'Panel pressure',value:p-(fault==='pressure-sensor-drift'?18:0),unit:'kPa' }];
    case 'valve-test': return [{ label: 'Valve commanded open', value: Number(e.valveCommandOpen), unit: '0/1' }, { label: 'Valve actually open', value: Number(e.valveActualOpen), unit: '0/1' }];
    case 'leak-survey': return [{ label: 'Hatch acoustic leak signal', value: fault === 'seal-leak' ? 1 : 0, unit: '0/1' }, { label: 'Service vent gas loss', value: e.leakMolPerMin, unit: 'mol/min' }];
    case 'fan-test': return [{ label: 'Fan speed', value: e.fanEnabled && e.equipmentSupplyKw >= e.equipmentDemandKw && fault !== 'fan-failure' && !e.procedure ? 3000 : 0, unit: 'rpm' },
      { label: 'Fan supplied power', value: e.fanEnabled && e.equipmentSupplyKw >= e.equipmentDemandKw ? r.fanKw : 0, unit: 'kW' }];
    case 'scrubber-test': return [{ label: 'CO₂ removal', value: e.co2RemovalMolPerMin, unit: 'mol/min' },
      { label: 'Media capacity', value: fault === 'media-exhausted' ? 0 : e.scrubberRemainingMol, unit: 'mol CO₂' }, { label: 'Independent cabin CO₂', value: ppm, unit: 'ppm' }];
  }
}
/** Support is inferred from the learner's selected measurements, never from hidden fault truth. */
export function atmosphericEvidenceSupport(fault:FaultId, records:DiagnosticRecord[]): 'strong'|'partial'|'none' {
  const read=(label:string)=>records.flatMap(record=>record.readings).filter(x=>x.label===label).at(-1)?.value;
  const independentPressure=read('Independent pressure'), panelPressure=read('Panel pressure');
  const independentCo2=read('Independent CO₂'), panelCo2=read('Panel CO₂');
  switch(fault) {
    case 'seal-leak': return read('Hatch acoustic leak signal')===1?'strong':(read('Occupied-zone pressure trend')??0)<-.03?'partial':'none';
    case 'valve-stuck': return read('Valve commanded open')===0&&read('Valve actually open')===1?'strong':'none';
    case 'pressure-sensor-drift': return independentPressure!==undefined&&panelPressure!==undefined&&Math.abs(independentPressure-panelPressure)>5?'strong':'none';
    case 'fan-failure': return read('Fan speed')===0&&(read('Fan supplied power')??0)>0?'strong':'none';
    case 'media-exhausted': return read('Media capacity')===0&&read('CO₂ removal')===0?'strong':'none';
    case 'co2-sensor-drift': return independentCo2!==undefined&&panelCo2!==undefined&&Math.abs(independentCo2-panelCo2)>500?'strong':'none';
  }
}
function fail(s: MissionState, kind: 'pressure' | 'oxygen' | 'co2' | 'power' | 'water' | 'deadline', message: string): void {
  s.status = 'failed'; s.failureReason = message;
  const causes = s.events.filter(x => x.type === 'ATMOSPHERE_WARNING' || x.type.startsWith('EMERGENCY_')).map(x => x.id);
  s.failure = { kind, hour: s.hour, resources: structuredClone(s.resources), causeIds: causes };
  recordEvent(s, { type: `MISSION_FAILED_${kind.toUpperCase()}`, severity: 'critical', message, causeIds: causes });
}
export function emergencySafe(s: MissionState): boolean {
  const e = s.emergency!, r = emergencyRules(s), z = e.zones[e.crewZone];
  return pressureKpa(z, r.temperatureK) > r.minimumPressureKpa && oxygenKpa(z, r.temperatureK) > r.minimumOxygenKpa && co2Ppm(z) < r.maximumCo2Ppm;
}
function verificationCondition(s: MissionState): boolean {
  const e = s.emergency!, r = emergencyRules(s), fault = activeFault(s);
  const backupContains = e.kind === 'air' && fault !== 'co2-sensor-drift' && e.backupEnabled && e.backupRemainingMol >= r.crewCo2MolPerMin * r.verificationMinutes;
  const faultHandled = !fault || backupContains || (e.kind === 'pressure' && fault !== 'pressure-sensor-drift' && e.crewZone === 'hub' && (!e.valveActualOpen || !e.exchangeEnabled));
  return e.faultTriggered && faultHandled && !e.procedure && emergencySafe(s) && e.equipmentSupplyKw + 1e-9 >= e.equipmentDemandKw
    && s.resources.oxygenKg > s.config!.oxygenSafetyThresholdKg && s.resources.waterLiters > s.config!.waterSafetyThresholdLiters
    && (e.kind === 'pressure' ? pressureKpa(e.zones[e.crewZone], r.temperatureK) >= r.minimumVerifiedPressureKpa && Math.abs(e.pressureTrendKpaPerMin) < .03
      : co2Ppm(e.zones.hub) <= r.recoveryCo2Ppm && e.co2TrendPpmPerMin <= .1 && e.co2RemovalMolPerMin >= r.crewCo2MolPerMin - 1e-9);
}
/** One-minute Euler balance. Transfers and leaks remove each gas species in donor proportions. */
export function advanceEmergencySteps(state: MissionState, minutes: number): MissionState[] {
  if (!Number.isSafeInteger(minutes) || minutes <= 0) throw new RangeError('Advance requires positive integer minutes.');
  const result: MissionState[] = [];
  let current = state;
  for (let i = 0; i < minutes && current.status === 'running'; i++) {
    const s = structuredClone(current), e = s.emergency!, r = emergencyRules(s);
    trigger(s);
    const powered = allocate(s, true), fault = activeFault(s);
    e.valveActualOpen = fault === 'valve-stuck' ? true : e.valveCommandOpen;
    const occupied = e.zones[e.crewZone], beforeP = pressureKpa(occupied, r.temperatureK), beforeCo2 = co2Ppm(occupied);
    if (e.kind === 'pressure' && e.exchangeEnabled && e.valveActualOpen) {
      const delta = pressureKpa(e.zones.hub, r.temperatureK) - pressureKpa(e.zones.service, r.temperatureK);
      const equilibrium = Math.abs(delta) / (GAS_CONSTANT * r.temperatureK * (1 / r.hubVolumeM3 + 1 / r.serviceVolumeM3));
      transferGas(delta >= 0 ? e.zones.hub : e.zones.service, delta >= 0 ? e.zones.service : e.zones.hub,
        Math.min(equilibrium, Math.abs(delta) * r.exchangeConductanceMolPerMinKpa));
    }
    e.leakMolPerMin = 0;
    if (e.kind === 'pressure' && (fault === 'seal-leak' || fault === 'valve-stuck')) {
      const lost = takeGas(e.zones.service, Math.max(0, pressureKpa(e.zones.service, r.temperatureK) - .6) * r.leakConductanceMolPerMinKpa);
      e.leakMolPerMin = lost.inertMol + lost.oxygenMol + lost.co2Mol;
      e.gasLostMol += e.leakMolPerMin; e.oxygenLostMol += lost.oxygenMol;
    }
    // Metabolic oxygen consumption and CO₂ production are independently configured flows.
    occupied.oxygenMol = Math.max(0, occupied.oxygenMol - r.crewOxygenMolPerMin);
    occupied.co2Mol += r.crewCo2MolPerMin;
    const feed = powered ? Math.min(r.oxygenFeedMolPerMin, s.resources.oxygenKg / OXYGEN_KG_PER_MOL) : 0;
    s.resources.oxygenKg = Math.max(0, s.resources.oxygenKg - feed * OXYGEN_KG_PER_MOL);
    occupied.oxygenMol += feed; e.oxygenFedMol += feed;
    if (powered && e.regulatorEnabled && e.atmosphereReserveMol > 0) {
      const needed = Math.max(0, (r.initialPressureKpa - pressureKpa(occupied, r.temperatureK)) * occupied.volumeM3 / (GAS_CONSTANT * r.temperatureK));
      const added = Math.min(needed, r.regulatorMolPerMin, e.atmosphereReserveMol);
      e.atmosphereReserveMol -= added; occupied.oxygenMol += added * r.initialOxygenFraction; occupied.inertMol += added * (1-r.initialOxygenFraction);
    }
    const fanRunning = e.fanEnabled && powered && fault !== 'fan-failure' && !(e.procedure?.component === 'fan');
    const mediaAvailable = fault !== 'media-exhausted' && !(e.procedure?.component === 'scrubber');
    const nominal = fanRunning && e.scrubberEnabled && mediaAvailable ? Math.min(r.scrubberMolPerMin, e.scrubberRemainingMol) : 0;
    const removed = Math.min(occupied.co2Mol, nominal);
    occupied.co2Mol -= removed; e.scrubberRemainingMol -= removed;
    const backup = e.backupEnabled && powered ? Math.min(occupied.co2Mol, r.backupRemovalMolPerMin, e.backupRemainingMol) : 0;
    occupied.co2Mol -= backup; e.backupRemainingMol -= backup;
    e.co2RemovalMolPerMin = removed + backup; e.co2RemovedMol += removed + backup;
    e.pressureTrendKpaPerMin = pressureKpa(occupied, r.temperatureK) - beforeP;
    e.co2TrendPpmPerMin = co2Ppm(occupied) - beforeCo2;
    s.resources.waterLiters = Math.max(0, s.resources.waterLiters + (s.config!.normalWaterRecoveryLitersPerHour - s.config!.crewWaterUseLitersPerHour) / 60 - feed * OXYGEN_KG_PER_MOL * (s.config!.oxygenProcessWaterLitersPerKg ?? 1.125));
    s.resources.foodRations = Math.max(0, s.resources.foodRations - .25 / 60);
    if (s.modules['research-lab'].enabled && e.minute % 60 === 59) s.scienceScore++;
    e.minute++; s.hour = e.minute / 60;
    trigger(s);
    if (!powered) fail(s, 'power', 'Atmospheric support has insufficient actual electrical supply.');
    else if (pressureKpa(occupied, r.temperatureK) <= r.minimumPressureKpa) fail(s, 'pressure', 'Occupied compartment pressure reached the configured unsafe limit.');
    else if (oxygenKpa(occupied, r.temperatureK) <= r.minimumOxygenKpa || s.resources.oxygenKg <= s.config!.oxygenSafetyThresholdKg) fail(s, 'oxygen', 'Occupied-zone oxygen partial pressure or stored oxygen is unsafe.');
    else if (s.resources.waterLiters <= s.config!.waterSafetyThresholdLiters) fail(s, 'water', 'Stored water reached its configured unsafe threshold.');
    else if (co2Ppm(occupied) >= r.maximumCo2Ppm) fail(s, 'co2', 'Cabin CO₂ reached the configured unsafe limit despite the separate oxygen reserve.');
    if (s.status === 'running' && e.verification) {
      e.stableMinutes = verificationCondition(s) ? e.stableMinutes + 1 : 0;
      if (e.stableMinutes >= r.verificationMinutes) {
        e.verification.passed = true; e.verification.completedMinute = e.minute; e.verification.reason = 'Independent measurements remained within the recovery limits throughout the verification window.';
        s.status = 'success'; recordEvent(s, { type: 'MISSION_ACCOMPLISHED', severity: 'info', message: `${getMission(s.scenarioId).title}: ${e.stableMinutes} consecutive safe verification minutes.`, causeIds: s.events.filter(x => x.type === 'EMERGENCY_INTERVENTION').map(x => x.id) });
      } else if (e.minute - e.verification.requestedMinute >= r.verificationMinutes) {
        e.verification.reason = 'Verification is not yet passing: inspect pressure/CO₂ trend, unresolved faults, power and occupied-zone limits.';
      }
    }
    if (s.status === 'running' && e.minute >= r.durationMinutes) fail(s, 'deadline', 'Stabilization deadline passed without a verified safe recovery.');
    result.push(s); current = s;
  }
  return result;
}

export function applyEmergencyCommand(state: MissionState, command: EmergencyCommand): ActionResult {
  const reject = (reason: string): ActionResult => ({ ok: false, state, reason, feedback: { kind: 'rejected', title: 'Check the equipment state', body: reason } });
  if (!state.emergency) return reject('This action requires an atmospheric mission.');
  if (state.status !== 'running') return reject('Mission concluded. Rewind to an earlier point or start again.');
  const def = getMission(state.scenarioId), r = emergencyRules(state);
  if (!command || typeof command !== 'object') return reject('Choose a supported equipment action.');
  if (!def.playerActions.includes(command.kind)) return reject('This equipment command is not available in the selected mission.');
  if ('enabled' in command && typeof command.enabled !== 'boolean') return reject('Equipment switch must be true or false.');
  if ('component' in command && !def.components.includes(command.component)) return reject('This component is not available in the selected mission.');
  let cost = 1, message = '', type = 'EMERGENCY_INTERVENTION';
  const next = structuredClone(state), e = next.emergency!;
  switch (command.kind) {
    case 'inspect':
      if (!e.inspected.includes(command.component)) e.inspected.push(command.component);
      message = `${COMPONENT_LABELS[command.component]} inspected. Compare measurements before choosing a replacement.`; type = 'EMERGENCY_INSPECTION'; break;
    case 'diagnostic': {
      if (!def.diagnosticTests.includes(command.test)) return reject('Choose a diagnostic supported by this mission.');
      const readings = emergencyReadings(next, command.test);
      e.evidence.push({ id: `${state.branchId}:evidence:${e.sequence}`, minute: e.minute, test: command.test, readings });
      cost = 2; type = 'EMERGENCY_DIAGNOSTIC';
      message = `${TEST_LABELS[command.test]}: ${readings.map(x => `${x.label} ${x.value.toFixed(3)} ${x.unit}`).join('; ')}.`; break;
    }
    case 'hypothesis':
      if (!def.components.includes(FAULT_COMPONENT[command.fault]) || !Array.isArray(command.evidenceIds) || !command.evidenceIds.length
        || command.evidenceIds.some(id => !e.evidence.some(x => x.id === id))) return reject('Select at least one measurement collected in this mission and a compatible hypothesis.');
      e.hypotheses.push({ minute: e.minute, fault: command.fault, evidenceIds: [...command.evidenceIds] });
      message = `Hypothesis recorded: ${command.fault}. Evidence fit: ${atmosphericEvidenceSupport(command.fault,e.evidence.filter(record=>command.evidenceIds.includes(record.id)))}. Only a physical recovery test can establish whether the intervention worked.`; type = 'EMERGENCY_HYPOTHESIS'; break;
    case 'valve':
      if (e.kind !== 'pressure' || typeof command.open !== 'boolean') return reject('Valve commands require a boolean position in Pressure Drop.');
      if (!command.open && e.crewZone === 'service') return reject('Move the crew to the hub before isolating the service compartment.');
      if (command.open && Math.abs(pressureKpa(e.zones.hub, r.temperatureK) - pressureKpa(e.zones.service, r.temperatureK)) > 5) return reject('Pressure difference exceeds the 5 kPa reopening limit. Keep the zone isolated; equalization operations are outside this exercise.');
      e.valveCommandOpen = command.open; e.valveActualOpen = activeFault(next) === 'valve-stuck' ? true : command.open;
      message = `Isolation valve commanded ${command.open ? 'open' : 'closed'}; position indicator is ${e.valveActualOpen ? 'open' : 'closed'}.`; break;
    case 'exchange':
      if (e.kind !== 'pressure') return reject('Compartment exchange controls are only available in Pressure Drop.');
      if (!command.enabled && e.crewZone !== 'hub') return reject('Relocate the crew to the hub before isolating this flow path.');
      if (command.enabled && Math.abs(pressureKpa(e.zones.hub, r.temperatureK) - pressureKpa(e.zones.service, r.temperatureK)) > 5) return reject('Keep unequal-pressure compartments isolated.');
      e.exchangeEnabled = command.enabled; message = `Secondary air-exchange path ${command.enabled ? 'enabled' : 'isolated'}. This is independent of the main valve.`; break;
    case 'crew': {
      if (e.kind !== 'pressure' || !['hub', 'service'].includes(command.zone)) return reject('Select an available compartment.');
      const zone = e.zones[command.zone];
      if (pressureKpa(zone, r.temperatureK) <= r.minimumPressureKpa || oxygenKpa(zone, r.temperatureK) <= r.minimumOxygenKpa
        || Math.abs(pressureKpa(e.zones.hub, r.temperatureK) - pressureKpa(e.zones.service, r.temperatureK)) > 5
        || !e.valveActualOpen || !e.exchangeEnabled) return reject('Crew transfer requires a connected, pressure-matched safe compartment.');
      e.crewZone = command.zone; message = `Four crew relocated to ${command.zone}.`; break;
    }
    case 'regulator': case 'fan': case 'scrubber': case 'backup':
      if (command.kind === 'regulator' && e.kind !== 'pressure') return reject('Pressure regulation is available in Pressure Drop.');
      if (command.kind !== 'regulator' && e.kind !== 'air') return reject('Treatment controls are available in Silent Air.');
      if (command.kind === 'regulator') e.regulatorEnabled = command.enabled;
      if (command.kind === 'fan') e.fanEnabled = command.enabled;
      if (command.kind === 'scrubber') e.scrubberEnabled = command.enabled;
      if (command.kind === 'backup') e.backupEnabled = command.enabled;
      message = `${command.kind} ${command.enabled ? 'enabled' : 'disabled'}. Supply and consumable effects are calculated each minute.`; break;
    case 'begin-repair':
      if (e.procedure) return reject('Finish the current service procedure before opening another unit.');
      if (!e.hypotheses.length) return reject('Collect evidence and record a hypothesis before committing a spare.');
      if (command.component.endsWith('sensor')) return reject('Use independent-reference calibration for a sensor; no component swap is required.');
      if (e.spares[command.component] < 1) return reject('No compatible spare remains. Rewind before the replacement to try another diagnosis.');
      e.procedure = { component: command.component, step: 0, coverOpen: false, removed: false, tool: false };
      e.verification = null; e.stableMinutes = 0;
      message = `Service selected for ${COMPONENT_LABELS[command.component]}. Review safe access before opening the cover.`; break;
    case 'procedure': {
      const p = e.procedure;
      if (!p || !Number.isSafeInteger(command.step) || command.step !== p.step || !PROCEDURE_STEPS[command.step]) return reject('Use the next incomplete service step. Repeated or out-of-order steps are rejected.');
      if (p.step === 0 && (e.kind === 'pressure' ? e.crewZone !== 'hub' || e.valveActualOpen && e.exchangeEnabled : e.fanEnabled || e.scrubberEnabled)) {
        return reject(e.kind === 'pressure' ? 'Keep crew in the hub and isolate the service zone with the main valve or secondary path. The fictional sealed maintenance port allows remote servicing.' : 'Stop both the fan and scrubber using their switches before servicing. Keep habitat life support powered.');
      }
      if (p.step > 0 && (e.kind === 'pressure' ? e.valveActualOpen && e.exchangeEnabled : e.fanEnabled || e.scrubberEnabled)) return reject('Isolation changed during maintenance. Stop and re-establish safe isolation.');
      if (p.step === 1) p.tool = true;
      if (p.step === 2) { if (!p.tool) return reject('Select the compatible service tool first.'); p.coverOpen = true; }
      if (p.step === 3) { if (!p.coverOpen) return reject('Open the service cover first.'); p.removed = true; }
      if (p.step === 4) {
        if (!p.removed || e.spares[p.component] < 1) return reject('An empty bay and a compatible spare are required.');
        e.spares[p.component]--; p.removed = false;
        if (!e.repairs.includes(p.component)) e.repairs.push(p.component);
        if (p.component === 'scrubber') e.scrubberRemainingMol = r.scrubberCapacityMol;
      }
      if (p.step === 5) p.coverOpen = false;
      cost = PROCEDURE_STEPS[p.step].minutes; message = `${COMPONENT_LABELS[p.component]}: ${PROCEDURE_STEPS[p.step].label}.`;
      p.step++;
      if (p.step === PROCEDURE_STEPS.length) e.procedure = null;
      break;
    }
    case 'calibrate':
      if (!command.component.endsWith('sensor') || !e.evidence.some(x => x.test === 'independent-analyzer')) return reject('Sensor calibration requires an independent analyzer reading first.');
      if (!e.repairs.includes(command.component)) e.repairs.push(command.component);
      cost = 3; message = `${COMPONENT_LABELS[command.component]} calibrated against the independent reference. Calibration changes instrument bias, not cabin gas inventory.`; break;
    case 'verify':
      if (!e.faultTriggered) return reject('No emergency has been recorded yet. Collect baseline readings and monitor the atmosphere before requesting recovery verification.');
      if (e.procedure) return reject('Finish service and close the cover before verification.');
      if (!e.evidence.length || !e.hypotheses.length) return reject('Collect evidence and record a diagnosis before beginning an independent recovery test.');
      e.verification = { requestedMinute: e.minute, passed: false, reason: 'Monitoring actual conditions; this request does not guarantee success.' };
      e.stableMinutes = 0; cost = r.verificationMinutes; message = `Monitoring for ${r.verificationMinutes} consecutive safe minutes. Failed conditions reset the hold counter.`; type = 'EMERGENCY_VERIFICATION'; break;
    case 'guidance':
      if (!['cadet', 'engineer', 'commander'].includes(command.mode)) return reject('Choose Cadet, Engineer or Commander.');
      e.mode = command.mode; cost = 0; message = `Guidance: ${command.mode}. Physics and limits are unchanged.`; type = 'GUIDANCE_CHANGED'; break;
    default: return reject('Unrecognized equipment action.');
  }
  e.sequence++; e.lastFeedback = `${message} Time cost: ${cost} min.`;
  recordEvent(next, { type, severity: 'info', moduleId: 'life-support', message: e.lastFeedback,
    causeIds: e.evidence.map(x => x.id) });
  allocate(next, false);
  const decisionState = structuredClone(next);
  const transitions = cost ? advanceEmergencySteps(next, cost) : [];
  const advanced = transitions.at(-1) ?? next;
  return { ok: true, state: advanced, decisionState, transitions, message: e.lastFeedback,
    feedback: { kind: advanced.status === 'failed' ? 'warning' : 'info', title: 'Equipment response', body: e.lastFeedback } };
}
