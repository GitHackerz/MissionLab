/**
 * Simplified educational water-recycler model.
 *
 * Wastewater tank -> pump cartridge -> filter cartridge -> treatment stage -> clean-water tank,
 * with a flow sensor on the output line. Every reading below is derived from ONE state:
 * which slots hold their original part, whether the unit is running, and the configured fault.
 */
import type { MissionState } from '../types';
import type {
  DiagnosticTestId,
  EvidenceRecord,
  Measurement,
  MeasurementId,
  RecyclerComponentId,
  RecyclerFaultKind,
  ReplaceableId,
} from './types';

export const NOMINAL_RECOVERY_LPH = 0.42;

/** Which replaceable part each fault lives in. */
export const FAULT_SLOT: Record<RecyclerFaultKind, ReplaceableId> = {
  'pump-seized': 'pump-cartridge',
  'filter-clogged': 'filter-cartridge',
  'sensor-drift': 'flow-sensor',
};

export const FAULT_LABEL: Record<RecyclerFaultKind, string> = {
  'pump-seized': 'Pump failure',
  'filter-clogged': 'Filter obstruction',
  'sensor-drift': 'Sensor malfunction',
};

export const PART_LABEL: Record<ReplaceableId, string> = {
  'pump-cartridge': 'Pump cartridge',
  'filter-cartridge': 'Filter cartridge',
  'flow-sensor': 'Flow sensor module',
};

/** Simulated minutes charged for each consequential action (educational durations). */
export const MINUTES = {
  INSPECT_COMPONENT: 2,
  RUN_DIAGNOSTIC: { 'read-flow-sensor': 5, 'check-pump': 5, 'read-pressure': 5, 'compare-output': 10, 'run-diagnostic-cycle': 30 } as Record<DiagnosticTestId, number>,
  RECORD_HYPOTHESIS: 5,
  IDENTIFY_EQUIPMENT: 2,
  REVIEW_ISOLATION: 5,
  ENTER_MAINTENANCE_MODE: 10,
  CONFIRM_INACTIVE: 5,
  SELECT_TOOL: 1,
  OPEN_HATCH: 5,
  LOCATE_COMPONENT: 3,
  RELEASE_RETAINERS: 5,
  REMOVE_COMPONENT: 10,
  TAKE_SPARE: 3,
  INSPECT_SPARE: 3,
  ROTATE_PART: 0,
  INSTALL_COMPONENT: 20,
  SECURE_COMPONENT: 5,
  CLOSE_HATCH: 5,
  RESTORE_TEST_READY: 10,
  RUN_STARTUP_TEST: 30,
  ABORT_PROCEDURE: 5,
} as const;

export interface RecyclerOperation {
  /** Is the unit processing water at all? */
  running: boolean;
  reason: 'running' | 'maintenance' | 'standby' | 'switched-off' | 'blackout';
  /** Fault currently affecting behaviour (fault exists and its original part is still installed). */
  activeFault: RecyclerFaultKind | null;
  /** True recovery into the clean-water tank. */
  recoveryLph: number;
}

function activeFaultOf(state: MissionState): RecyclerFaultKind | null {
  const r = state.training?.recycler;
  // A negative onset marks a forecast copy with no unforeseen faults (see power.ts).
  if (!r || r.faultOnsetHour === null || r.faultOnsetHour < 0) return null;
  return r.procedure.slots[FAULT_SLOT[r.faultKind]].occupant === 'original' ? r.faultKind : null;
}

/** Single source of truth for what the recycler is doing right now. */
export function getRecyclerOperation(state: MissionState): RecyclerOperation {
  const t = state.training;
  const recycler = state.modules['water-recycler'];
  const activeFault = activeFaultOf(state);
  if (!t) {
    const ok = recycler.status === 'operational' && recycler.enabled && recycler.suppliedPowerKw + 1e-9 >= recycler.powerDemandKw;
    return { running: ok, reason: ok ? 'running' : 'standby', activeFault: null, recoveryLph: ok ? NOMINAL_RECOVERY_LPH : 0 };
  }
  if (recycler.suppliedPowerKw + 1e-9 < recycler.powerDemandKw) return { running: false, reason: 'blackout', activeFault, recoveryLph: 0 };
  const p = t.recycler.procedure;
  if (!recycler.enabled) return { running: false, reason: 'switched-off', activeFault, recoveryLph: 0 };
  if (p.maintenanceMode) return { running: false, reason: 'maintenance', activeFault, recoveryLph: 0 };
  const slotEmpty = Object.values(p.slots).some((s) => s.occupant === 'empty');
  const spareUnsecured = Object.values(p.slots).some((s) => s.occupant === 'spare' && s.retainers === 'released');
  if (slotEmpty || spareUnsecured || p.hatchOpen) return { running: false, reason: 'standby', activeFault, recoveryLph: 0 };
  if (activeFault === 'pump-seized') return { running: true, reason: 'running', activeFault, recoveryLph: 0 };
  if (activeFault === 'filter-clogged') return { running: true, reason: 'running', activeFault, recoveryLph: NOMINAL_RECOVERY_LPH * 0.25 };
  return { running: true, reason: 'running', activeFault, recoveryLph: NOMINAL_RECOVERY_LPH };
}

export function getWaterRecoveryLph(state: MissionState): number {
  return getRecyclerOperation(state).recoveryLph;
}

type Raw = Record<MeasurementId, number>;

/** Measurements derived from the single recycler state. */
export function readRecycler(state: MissionState): Raw {
  const op = getRecyclerOperation(state);
  const fault = op.activeFault;
  if (!op.running) {
    return {
      'pump-rpm': 0,
      'pump-power-kw': op.reason === 'blackout' || op.reason === 'switched-off' ? 0 : 0.02,
      'circulation-flow-lph': 0,
      'pressure-in-kpa': 101,
      'pressure-out-kpa': 101,
      'sensor-reported-recovery-lph': 0,
      'clean-tank-inflow-lph': 0,
    };
  }
  switch (fault) {
    case 'pump-seized':
      // Seized rotor: draws locked-rotor power, no rotation, no circulation, no pressure rise.
      return { 'pump-rpm': 0, 'pump-power-kw': 0.9, 'circulation-flow-lph': 0, 'pressure-in-kpa': 101, 'pressure-out-kpa': 101, 'sensor-reported-recovery-lph': 0, 'clean-tank-inflow-lph': 0 };
    case 'filter-clogged':
      // Pump spins and builds pressure, but the blocked filter restricts flow: large pressure drop across it.
      return { 'pump-rpm': 3000, 'pump-power-kw': 0.62, 'circulation-flow-lph': 3, 'pressure-in-kpa': 320, 'pressure-out-kpa': 105, 'sensor-reported-recovery-lph': 0.105, 'clean-tank-inflow-lph': 0.105 };
    case 'sensor-drift':
      // Process is healthy; only the flow sensor under-reads. The clean tank still fills at the normal rate.
      return { 'pump-rpm': 3000, 'pump-power-kw': 0.55, 'circulation-flow-lph': 12, 'pressure-in-kpa': 180, 'pressure-out-kpa': 150, 'sensor-reported-recovery-lph': 0.1, 'clean-tank-inflow-lph': NOMINAL_RECOVERY_LPH };
    default:
      return { 'pump-rpm': 3000, 'pump-power-kw': 0.55, 'circulation-flow-lph': 12, 'pressure-in-kpa': 180, 'pressure-out-kpa': 150, 'sensor-reported-recovery-lph': NOMINAL_RECOVERY_LPH, 'clean-tank-inflow-lph': NOMINAL_RECOVERY_LPH };
  }
}

const SPEC: Record<MeasurementId, { label: string; unit: string; min: number; max: number }> = {
  'pump-rpm': { label: 'Pump speed', unit: 'rpm', min: 2800, max: 3200 },
  'pump-power-kw': { label: 'Pump power draw', unit: 'kW', min: 0.45, max: 0.65 },
  'circulation-flow-lph': { label: 'Circulation flow', unit: 'L/h', min: 10, max: 14 },
  'pressure-in-kpa': { label: 'Pressure before filter', unit: 'kPa', min: 160, max: 200 },
  'pressure-out-kpa': { label: 'Pressure after filter', unit: 'kPa', min: 130, max: 170 },
  'sensor-reported-recovery-lph': { label: 'Flow sensor: water recovery', unit: 'L/h', min: 0.38, max: 0.46 },
  'clean-tank-inflow-lph': { label: 'Clean tank inflow (independent)', unit: 'L/h', min: 0.38, max: 0.46 },
};

export function measure(id: MeasurementId, value: number): Measurement {
  const s = SPEC[id];
  return { id, label: s.label, value: Number(value.toFixed(3)), unit: s.unit, expectedMin: s.min, expectedMax: s.max, inRange: value >= s.min && value <= s.max };
}

const TEST_SETS: Record<DiagnosticTestId, { title: string; ids: MeasurementId[] }> = {
  'read-flow-sensor': { title: 'Read flow sensor', ids: ['sensor-reported-recovery-lph', 'circulation-flow-lph'] },
  'check-pump': { title: 'Check pump operation', ids: ['pump-rpm', 'pump-power-kw'] },
  'read-pressure': { title: 'Read pressure gauges', ids: ['pressure-in-kpa', 'pressure-out-kpa'] },
  'compare-output': { title: 'Compare sensor with clean-tank inflow', ids: ['sensor-reported-recovery-lph', 'clean-tank-inflow-lph'] },
  'run-diagnostic-cycle': {
    title: 'Run full diagnostic cycle',
    ids: ['pump-rpm', 'pump-power-kw', 'circulation-flow-lph', 'pressure-in-kpa', 'pressure-out-kpa', 'sensor-reported-recovery-lph', 'clean-tank-inflow-lph'],
  },
};

export const DIAGNOSTIC_TESTS = TEST_SETS;

export function runDiagnostic(state: MissionState, testId: DiagnosticTestId, minute: number): EvidenceRecord {
  const raw = readRecycler(state);
  const set = TEST_SETS[testId];
  return {
    id: `ev-${state.hour}-${minute}-${testId}`,
    hour: state.hour,
    minute,
    testId,
    title: set.title,
    readings: set.ids.map((id) => measure(id, raw[id])),
  };
}

/** Rule check: how consistent is this evidence with each fault? (Not the answer: it only compares evidence.) */
export function evidenceSupport(kind: RecyclerFaultKind, evidence: EvidenceRecord[]): 'strong' | 'partial' | 'none' {
  const readings = new Map<MeasurementId, Measurement>();
  evidence.forEach((e) => e.readings.forEach((r) => readings.set(r.id, r)));
  const v = (id: MeasurementId) => readings.get(id)?.value;
  const checks: boolean[] = [];
  if (kind === 'pump-seized') {
    const rpm = v('pump-rpm');
    const flow = v('circulation-flow-lph');
    const pin = v('pressure-in-kpa');
    const pout = v('pressure-out-kpa');
    if (rpm !== undefined) checks.push(rpm < 100);
    if (flow !== undefined) checks.push(flow < 1);
    if (pin !== undefined && pout !== undefined) checks.push(Math.abs(pin - pout) < 10);
  } else if (kind === 'filter-clogged') {
    const rpm = v('pump-rpm');
    const pin = v('pressure-in-kpa');
    const pout = v('pressure-out-kpa');
    if (rpm !== undefined) checks.push(rpm > 2500);
    if (pin !== undefined && pout !== undefined) checks.push(pin - pout > 100);
  } else {
    const rep = v('sensor-reported-recovery-lph');
    const tank = v('clean-tank-inflow-lph');
    if (rep !== undefined && tank !== undefined) checks.push(Math.abs(rep - tank) > 0.1 && tank >= 0.38);
  }
  if (checks.length === 0) return 'none';
  const hits = checks.filter(Boolean).length;
  if (hits === checks.length && checks.length >= (kind === 'sensor-drift' ? 1 : 2)) return 'strong';
  return hits > 0 ? 'partial' : 'none';
}

export interface ComponentInfo {
  id: RecyclerComponentId;
  name: string;
  purpose: string;
  observable: string[];
}

/** Descriptions never reveal which part is faulty. */
export const COMPONENT_INFO: Record<RecyclerComponentId, ComponentInfo> = {
  'wastewater-tank': { id: 'wastewater-tank', name: 'Wastewater input tank', purpose: 'Collects used water (washing, humidity condensate) before it is cleaned.', observable: ['Holds the water waiting to be processed'] },
  'pump-cartridge': { id: 'pump-cartridge', name: 'Pump cartridge', purpose: 'Pushes water through the filter and treatment stage. Without pressure, water would not move.', observable: ['Operating state', 'Pump speed (rpm)', 'Power draw (kW)', 'Flow it contributes'] },
  'filter-cartridge': { id: 'filter-cartridge', name: 'Filter cartridge', purpose: 'Traps particles and solids so only dissolved impurities reach the treatment stage.', observable: ['Pressure before and after the filter', 'Flow passing through'] },
  'treatment-stage': { id: 'treatment-stage', name: 'Treatment stage', purpose: 'Distills and purifies the filtered water so it is safe to drink again.', observable: ['Output passes to the clean tank'] },
  'flow-sensor': { id: 'flow-sensor', name: 'Flow sensor module', purpose: 'Measures how fast clean water leaves the system. The control panel uses it to report the recovery rate.', observable: ['Reported recovery rate (L/h)'] },
  'clean-tank': { id: 'clean-tank', name: 'Clean-water output tank', purpose: 'Stores recovered drinking water. Its inflow gives an independent check on the flow sensor.', observable: ['Inflow into the tank (L/h)'] },
  'service-hatch': { id: 'service-hatch', name: 'Service hatch', purpose: 'Gives access to the replaceable cartridges. Only open it after the unit is safely stopped.', observable: ['Open / closed'] },
  'control-panel': { id: 'control-panel', name: 'Control panel', purpose: 'Starts and stops the unit and puts it into maintenance mode.', observable: ['Maintenance mode', 'Test-ready state'] },
};
