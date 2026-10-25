/**
 * Validated training transitions. The 3D scene and UI only REQUEST these actions;
 * this module decides whether they are legal, what they cost in simulated time,
 * and how the authoritative state changes.
 */
import type { MissionState } from '../types';
import {
  COMPONENT_INFO,
  FAULT_LABEL,
  FAULT_SLOT,
  MINUTES,
  PART_LABEL,
  evidenceSupport,
  getRecyclerOperation,
  readRecycler,
  measure,
  runDiagnostic,
  NOMINAL_RECOVERY_LPH,
} from './recycler';
import type {
  LearningMode,
  Orientation,
  ProcedureState,
  ProcedureStepId,
  RecyclerFaultKind,
  ReplaceableId,
  TrainingAction,
  TrainingFeedback,
  TrainingState,
  TrainingStepAction,
  VerificationResult,
} from './types';
import { REPLACEABLE_IDS } from './types';

export type AdvanceFn = (state: MissionState, hours: number) => MissionState;

export interface TrainingOutcome {
  ok: boolean;
  state: MissionState;
  feedback: TrainingFeedback;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function createInitialProcedure(): ProcedureState {
  const slot = () => ({ occupant: 'original' as const, retainers: 'locked' as const });
  return {
    phase: 'available',
    isolationReviewed: false,
    maintenanceMode: false,
    inactiveConfirmed: false,
    tool: null,
    hatchOpen: false,
    testReady: false,
    slots: { 'pump-cartridge': slot(), 'filter-cartridge': slot(), 'flow-sensor': slot() },
    held: null,
    completedSteps: [],
    verification: null,
  };
}

export function createInitialTraining(
  faultKind: RecyclerFaultKind = 'pump-seized',
  mode: LearningMode = 'cadet',
): TrainingState {
  return {
    mode,
    minuteOfHour: 0,
    recycler: { faultKind, faultOnsetHour: null, procedure: createInitialProcedure() },
    inventory: { filterCartridges: 1, flowSensors: 1 },
    evidence: [],
    hypotheses: [],
    inspectedComponents: [],
    powerPlanAppliedHour: null,
    cropGrowthHours: 0,
    log: [],
  };
}

const info = (title: string, body: string): TrainingFeedback => ({ kind: 'info', title, body });
const ok = (title: string, body: string): TrainingFeedback => ({ kind: 'success', title, body });
const warn = (title: string, body: string): TrainingFeedback => ({ kind: 'warning', title, body });
const reject = (title: string, body: string): TrainingFeedback => ({ kind: 'rejected', title, body });

function spareCount(state: MissionState, part: ReplaceableId): number {
  if (part === 'pump-cartridge') return state.resources.sparePumps;
  const t = state.training!;
  return part === 'filter-cartridge' ? t.inventory.filterCartridges : t.inventory.flowSensors;
}

function consumeSpare(state: MissionState, part: ReplaceableId) {
  const t = state.training!;
  if (part === 'pump-cartridge') state.resources.sparePumps -= 1;
  else if (part === 'filter-cartridge') t.inventory.filterCartridges -= 1;
  else t.inventory.flowSensors -= 1;
}

function markStep(p: ProcedureState, step: ProcedureStepId) {
  if (!p.completedSteps.includes(step)) p.completedSteps.push(step);
}

export function minutesFor(action: TrainingAction): number {
  switch (action.type) {
    case 'INSPECT_COMPONENT': return MINUTES.INSPECT_COMPONENT;
    case 'RUN_DIAGNOSTIC': return MINUTES.RUN_DIAGNOSTIC[action.testId];
    case 'RECORD_HYPOTHESIS': return MINUTES.RECORD_HYPOTHESIS;
    case 'TRAINING_STEP': {
      const key = action.step.step;
      return MINUTES[key as keyof typeof MINUTES] as number;
    }
    default: return 0;
  }
}

interface Check { valid: true }
interface Fail { valid: false; feedback: TrainingFeedback }

function checkStep(state: MissionState, step: TrainingStepAction): Check | Fail {
  const t = state.training!;
  const p = t.recycler.procedure;
  const fail = (title: string, body: string): Fail => ({ valid: false, feedback: reject(title, body) });
  const needMaintenance = () =>
    !p.maintenanceMode ? fail('Unit is still running', 'Put the water recycler into maintenance mode first. Servicing a running unit would be unsafe, and the control panel is where you stop it.') : null;

  switch (step.step) {
    case 'IDENTIFY_EQUIPMENT':
      return step.moduleId === 'water-recycler'
        ? { valid: true }
        : fail('Wrong equipment', 'The symptom is a drop in water recovery. Look at the system that cleans and recycles water.');
    case 'REVIEW_ISOLATION':
      return { valid: true };
    case 'ENTER_MAINTENANCE_MODE':
      if (p.maintenanceMode) return fail('Already in maintenance mode', 'The unit is already stopped for service.');
      if (t.hypotheses.length === 0) return fail('Record your diagnosis first', 'Before stopping a life-support system, write down which part you think has failed and which readings support it. This avoids stopping the unit without a plan.');
      if (!p.isolationReviewed) return fail('Review isolation first', 'Read the isolation checklist before maintenance mode: stop the unit, confirm it is inactive, then open the hatch.');
      return { valid: true };
    case 'CONFIRM_INACTIVE':
      return needMaintenance() ?? { valid: true };
    case 'SELECT_TOOL':
      return { valid: true };
    case 'OPEN_HATCH':
      if (p.hatchOpen) return fail('Hatch already open', 'The service hatch is open.');
      if (!p.maintenanceMode) return needMaintenance()!;
      if (!p.inactiveConfirmed) return fail('Confirm the unit is inactive', 'Check that the pump has stopped (0 rpm) before opening the hatch.');
      if (p.tool !== 'hatch-key') return fail('Wrong tool', 'The service hatch needs the hatch key. Select it from the tool rack.');
      return { valid: true };
    case 'LOCATE_COMPONENT':
      return p.hatchOpen ? { valid: true } : fail('Hatch is closed', 'Open the service hatch to see the cartridges.');
    case 'RELEASE_RETAINERS': {
      const s = p.slots[step.slot];
      if (!p.hatchOpen) return fail('Hatch is closed', 'Open the service hatch first.');
      if (p.tool !== 'retainer-driver') return fail('Wrong tool', 'The retaining clips need the retainer driver.');
      if (s.occupant === 'empty') return fail('Nothing to release', 'This bay is empty.');
      if (s.retainers === 'released') return fail('Already released', 'The retainers on this bay are already released.');
      return { valid: true };
    }
    case 'REMOVE_COMPONENT': {
      const s = p.slots[step.slot];
      if (!p.hatchOpen) return fail('Hatch is closed', 'Open the service hatch first.');
      if (s.occupant === 'empty') return fail('Bay is empty', 'There is nothing in this bay to remove.');
      if (s.retainers === 'locked') return fail('Retainers still locked', 'The cartridge is held by clips. Release the retainers with the retainer driver before pulling it out.');
      return { valid: true };
    }
    case 'TAKE_SPARE':
      if (!p.maintenanceMode) return needMaintenance()!;
      if (p.held) return fail('Hands full', 'You are already holding a part. Install it or put it back by aborting the procedure.');
      if (spareCount(state, step.part) <= 0) return fail('No spare available', `There is no spare ${PART_LABEL[step.part].toLowerCase()} left in the inventory.`);
      return { valid: true };
    case 'INSPECT_SPARE':
      return p.held ? { valid: true } : fail('No part in hand', 'Take a spare from the parts tray first.');
    case 'ROTATE_PART':
      return p.held ? { valid: true } : fail('No part in hand', 'Take a spare from the parts tray first.');
    case 'INSTALL_COMPONENT': {
      const s = p.slots[step.slot];
      if (!p.held) return fail('No part in hand', 'Take a spare from the parts tray first.');
      if (!p.hatchOpen) return fail('Hatch is closed', 'Open the service hatch first.');
      if (s.occupant !== 'empty') return fail('Bay is occupied', 'Remove the old cartridge before installing the new one.');
      if (p.held.part !== step.slot) return fail('Incompatible part', `A ${PART_LABEL[p.held.part].toLowerCase()} does not fit the ${PART_LABEL[step.slot].toLowerCase()} bay. Check the part label and the bay keying.`);
      if (!p.held.inspected) return fail('Inspect the part first', 'Check the part label and the keying notch before fitting it.');
      if (p.held.orientation !== 0) return fail('Keying notch misaligned', 'The part is rotated and will not seat. Rotate it until the notch lines up with the bay key.');
      return { valid: true };
    }
    case 'SECURE_COMPONENT': {
      const s = p.slots[step.slot];
      if (s.occupant === 'empty') return fail('Bay is empty', 'Install a cartridge before securing it.');
      if (p.tool !== 'retainer-driver') return fail('Wrong tool', 'The retaining clips need the retainer driver.');
      if (s.retainers === 'locked') return fail('Already secured', 'This cartridge is already locked in.');
      return { valid: true };
    }
    case 'CLOSE_HATCH': {
      if (!p.hatchOpen) return fail('Hatch already closed', 'The service hatch is closed.');
      const empty = REPLACEABLE_IDS.find((id) => p.slots[id].occupant === 'empty');
      if (empty) return fail('A bay is empty', `The ${PART_LABEL[empty].toLowerCase()} bay is empty. Install a cartridge before closing.`);
      const loose = REPLACEABLE_IDS.find((id) => p.slots[id].retainers === 'released');
      if (loose) return fail('A cartridge is not secured', `Secure the ${PART_LABEL[loose].toLowerCase()} with the retainer driver before closing the hatch.`);
      if (p.held) return fail('Still holding a part', 'Do not leave a loose part inside the unit. Install it or abort the procedure.');
      return { valid: true };
    }
    case 'RESTORE_TEST_READY':
      if (!p.maintenanceMode) return fail('Not in maintenance mode', 'The unit is not stopped for service.');
      if (p.hatchOpen) return fail('Hatch is open', 'Close the service hatch before restoring the unit.');
      return { valid: true };
    case 'RUN_STARTUP_TEST':
      return p.testReady ? { valid: true } : fail('Unit is not test-ready', 'Restore the unit to its test-ready state from the control panel first.');
    case 'ABORT_PROCEDURE': {
      if (!p.maintenanceMode && !p.hatchOpen && !p.held) return fail('Nothing to abort', 'No maintenance is in progress.');
      const empty = REPLACEABLE_IDS.find((id) => p.slots[id].occupant === 'empty');
      if (empty) return fail('A bay is empty', `Put a cartridge back in the ${PART_LABEL[empty].toLowerCase()} bay before stopping.`);
      return { valid: true };
    }
  }
}

export function validateTrainingAction(state: MissionState, action: TrainingAction): Check | Fail {
  if (!state.training) return { valid: false, feedback: reject('Training not available', 'This mission state has no training model.') };
  if (state.status === 'success' || state.status === 'failed') {
    return { valid: false, feedback: reject('Mission concluded', 'Rewind to an earlier decision to try another approach.') };
  }
  switch (action.type) {
    case 'RUN_DIAGNOSTIC':
      return { valid: true };
    case 'RECORD_HYPOTHESIS': {
      const known = new Set(state.training.evidence.map((e) => e.id));
      if (action.evidenceIds.length === 0) return { valid: false, feedback: reject('Select evidence', 'A diagnosis needs at least one measurement that supports it. Run a diagnostic test first.') };
      if (action.evidenceIds.some((id) => !known.has(id))) return { valid: false, feedback: reject('Unknown evidence', 'That evidence was not collected in this mission.') };
      return { valid: true };
    }
    case 'TRAINING_STEP':
      return checkStep(state, action.step);
    default:
      return { valid: true };
  }
}

function isFaultPresent(state: MissionState): boolean {
  const onset = state.training!.recycler.faultOnsetHour;
  return onset !== null && onset >= 0;
}

/** Keep the shared ModuleState consistent with the recycler model (single source of truth). */
export function syncRecyclerModule(state: MissionState): void {
  const t = state.training;
  if (!t) return;
  const m = state.modules['water-recycler'];
  const op = getRecyclerOperation(state);
  if (!m.enabled) {
    m.status = 'offline';
    return;
  }
  if (t.recycler.procedure.maintenanceMode || t.recycler.procedure.hatchOpen) {
    m.status = 'repairing';
    delete m.repairHoursRemaining;
    return;
  }
  delete m.repairHoursRemaining;
  if (op.activeFault === 'pump-seized') { m.status = 'degraded'; m.health = 0.35; }
  else if (op.activeFault === 'filter-clogged') { m.status = 'degraded'; m.health = 0.55; }
  else if (op.activeFault === 'sensor-drift') { m.status = 'degraded'; m.health = 0.8; }
  else { m.status = 'operational'; m.health = isFaultPresent(state) ? 0.95 : Math.max(m.health, 1); }
}

function logEntry(state: MissionState, action: string, okFlag: boolean, detail: string) {
  const t = state.training!;
  t.log.push({ hour: state.hour, minute: t.minuteOfHour, action, ok: okFlag, detail });
}

function describeStep(a: TrainingAction): string {
  if (a.type === 'TRAINING_STEP') {
    const s = a.step;
    const extra = 'slot' in s ? `:${s.slot}` : 'part' in s ? `:${s.part}` : 'tool' in s ? `:${s.tool}` : '';
    return `${s.step}${extra}`;
  }
  if (a.type === 'RUN_DIAGNOSTIC') return `${a.type}:${a.testId}`;
  if (a.type === 'INSPECT_COMPONENT') return `${a.type}:${a.componentId}`;
  if (a.type === 'RECORD_HYPOTHESIS') return `${a.type}:${a.kind}`;
  return a.type;
}

function runStartupTest(state: MissionState): VerificationResult {
  const raw = readRecycler(state);
  const ids = ['pump-rpm', 'pump-power-kw', 'circulation-flow-lph', 'pressure-in-kpa', 'pressure-out-kpa', 'sensor-reported-recovery-lph', 'clean-tank-inflow-lph'] as const;
  const readings = ids.map((id) => measure(id, raw[id]));
  const remaining: string[] = [];
  const fault = getRecyclerOperation(state).activeFault;
  // The unit must be running in its normal state for the readings to count.
  const bad = readings.filter((r) => !r.inRange);
  if (fault === 'pump-seized') remaining.push('Pump is not turning: no circulation and no pressure rise.');
  else if (fault === 'filter-clogged') remaining.push('Pump runs, but flow is low and the pressure drop across the filter is still large.');
  else if (fault === 'sensor-drift') remaining.push('Flow sensor still disagrees with the clean-tank inflow.');
  else if (bad.length) remaining.push('Some readings are outside the expected range.');
  return { hour: state.hour, passed: remaining.length === 0, readings, remainingIssues: remaining };
}

function stepEffect(state: MissionState, step: TrainingStepAction): TrainingFeedback {
  const t = state.training!;
  const p = t.recycler.procedure;
  switch (step.step) {
    case 'IDENTIFY_EQUIPMENT':
      markStep(p, 'identify-equipment');
      if (p.phase === 'available' || p.phase === 'investigating' || p.phase === 'diagnosis-recorded') p.phase = t.hypotheses.length ? 'diagnosis-recorded' : 'investigating';
      return info('Equipment identified', 'Water recycler selected. Check the diagnostic evidence before deciding what to service.');
    case 'REVIEW_ISOLATION':
      p.isolationReviewed = true;
      markStep(p, 'review-isolation');
      return info('Isolation checklist (training version)', '1) Stop the unit in maintenance mode. 2) Confirm the pump reads 0 rpm. 3) Pick the right tool. 4) Open the hatch. This is a simplified classroom procedure, not a real aerospace instruction.');
    case 'ENTER_MAINTENANCE_MODE':
      p.maintenanceMode = true;
      p.testReady = false;
      p.phase = 'preparing';
      p.verification = null;
      // A new service attempt starts a fresh checklist (the log keeps the history).
      p.completedSteps = p.completedSteps.filter((x) => x === 'identify-equipment' || x === 'review-isolation');
      markStep(p, 'maintenance-mode');
      return warn('Maintenance mode on', 'The recycler is stopped. Water recovery is 0 L/h until it is restored, so the clock matters.');
    case 'CONFIRM_INACTIVE': {
      p.inactiveConfirmed = true;
      markStep(p, 'confirm-inactive');
      return ok('Unit inactive', 'Pump speed reads 0 rpm and the power draw is minimal. It is safe to open the hatch in this training procedure.');
    }
    case 'SELECT_TOOL':
      p.tool = step.tool;
      markStep(p, 'select-tool');
      return info('Tool selected', step.tool === 'hatch-key' ? 'Hatch key: opens the service hatch.' : step.tool === 'retainer-driver' ? 'Retainer driver: releases and locks cartridge clips.' : 'Sample kit: collects water samples. It does not open or release anything.');
    case 'OPEN_HATCH':
      p.hatchOpen = true;
      p.phase = 'intervention';
      markStep(p, 'open-hatch');
      return ok('Hatch open', 'Three bays are visible: pump, filter and flow sensor. Which one needs service depends on your evidence.');
    case 'LOCATE_COMPONENT':
      markStep(p, 'locate-component');
      return info(PART_LABEL[step.slot], COMPONENT_INFO[step.slot].purpose);
    case 'RELEASE_RETAINERS':
      p.slots[step.slot].retainers = 'released';
      markStep(p, 'release-retainers');
      return ok('Retainers released', `The ${PART_LABEL[step.slot].toLowerCase()} is free to slide out.`);
    case 'REMOVE_COMPONENT': {
      const s = p.slots[step.slot];
      const wasOriginal = s.occupant === 'original';
      s.occupant = 'empty';
      markStep(p, 'remove-component');
      return ok(`${PART_LABEL[step.slot]} removed`, wasOriginal ? 'Removed the original cartridge. Take a compatible spare from the parts tray.' : 'Removed the installed cartridge.');
    }
    case 'TAKE_SPARE':
      p.held = { part: step.part, orientation: 180, inspected: false };
      markStep(p, 'retrieve-spare');
      return info('Spare in hand', `${PART_LABEL[step.part]} taken from the tray. Inspect it and line up the keying notch.`);
    case 'INSPECT_SPARE':
      p.held!.inspected = true;
      return info(`${PART_LABEL[p.held!.part]} label`, `Part fits the ${PART_LABEL[p.held!.part].toLowerCase()} bay. Keying notch is currently at ${p.held!.orientation}°; it must be at 0° to seat.`);
    case 'ROTATE_PART': {
      p.held!.orientation = ((p.held!.orientation + 90) % 360) as Orientation;
      if (p.held!.inspected && p.held!.orientation === 0) markStep(p, 'inspect-orient-spare');
      return info('Part rotated', `Keying notch at ${p.held!.orientation}°.`);
    }
    case 'INSTALL_COMPONENT': {
      const held = p.held!;
      consumeSpare(state, held.part);
      p.slots[step.slot] = { occupant: 'spare', retainers: 'released' };
      p.held = null;
      markStep(p, 'inspect-orient-spare');
      markStep(p, 'install-component');
      return ok(`${PART_LABEL[step.slot]} installed`, 'The new cartridge is seated but not locked. Secure it with the retainer driver.');
    }
    case 'SECURE_COMPONENT':
      p.slots[step.slot].retainers = 'locked';
      markStep(p, 'secure-component');
      return ok('Cartridge secured', 'Retaining clips are locked.');
    case 'CLOSE_HATCH':
      p.hatchOpen = false;
      markStep(p, 'close-hatch');
      return ok('Hatch closed', 'All bays are filled and secured. Restore the unit to its test-ready state.');
    case 'RESTORE_TEST_READY':
      p.maintenanceMode = false;
      p.inactiveConfirmed = false;
      p.testReady = true;
      p.phase = 'verifying';
      markStep(p, 'restore-test-ready');
      return ok('Test-ready', 'The unit is restarting. Run the startup test and compare the readings with the expected ranges.');
    case 'RUN_STARTUP_TEST': {
      p.testReady = false;
      const result = runStartupTest(state);
      p.verification = result;
      markStep(p, 'startup-test');
      if (result.passed) {
        p.phase = 'completed';
        return ok('Startup test passed', `Flow, pressure and pump readings are inside the expected ranges. Water recovery is back to ${NOMINAL_RECOVERY_LPH} L/h.`);
      }
      p.phase = 'failed-verification';
      return warn('Startup test failed', `${result.remainingIssues.join(' ')} Re-examine your evidence: the original fault is still there.`);
    }
    case 'ABORT_PROCEDURE':
      p.maintenanceMode = false;
      p.inactiveConfirmed = false;
      p.hatchOpen = false;
      p.held = null;
      p.phase = 'investigating';
      return warn('Procedure stopped', 'The unit was returned to service without completing a repair. Any held part goes back to the tray.');
  }
}

export function applyTrainingAction(state: MissionState, action: TrainingAction, advance: AdvanceFn): TrainingOutcome {
  const v = validateTrainingAction(state, action);
  if (!v.valid) {
    if (!state.training) return { ok: false, state, feedback: v.feedback };
    const next = clone(state);
    logEntry(next, describeStep(action), false, v.feedback.title);
    return { ok: false, state: next, feedback: v.feedback };
  }

  let next = clone(state);
  const t = next.training!;
  let feedback: TrainingFeedback;

  switch (action.type) {
    case 'INSPECT_COMPONENT': {
      if (!t.inspectedComponents.includes(action.componentId)) t.inspectedComponents.push(action.componentId);
      const c = COMPONENT_INFO[action.componentId];
      feedback = info(c.name, `${c.purpose}  Observable: ${c.observable.join('; ')}.`);
      break;
    }
    case 'RUN_DIAGNOSTIC': {
      const rec = runDiagnostic(next, action.testId, t.minuteOfHour);
      t.evidence.push(rec);
      if (t.recycler.procedure.phase === 'available') t.recycler.procedure.phase = 'investigating';
      feedback = info(rec.title, rec.readings.map((r) => `${r.label}: ${r.value} ${r.unit} (expected ${r.expectedMin}–${r.expectedMax})`).join('\n'));
      break;
    }
    case 'RECORD_HYPOTHESIS': {
      const chosen = t.evidence.filter((e) => action.evidenceIds.includes(e.id));
      const support = evidenceSupport(action.kind, chosen);
      t.hypotheses.push({ id: `hyp-${next.hour}-${t.hypotheses.length}`, hour: next.hour, kind: action.kind, evidenceIds: action.evidenceIds, support });
      if (['available', 'investigating'].includes(t.recycler.procedure.phase)) t.recycler.procedure.phase = 'diagnosis-recorded';
      feedback = support === 'strong'
        ? ok('Diagnosis recorded', `Your evidence is consistent with: ${FAULT_LABEL[action.kind]}. Plan the repair and check what spares you have.`)
        : support === 'partial'
        ? warn('Diagnosis recorded', `Only part of your evidence fits ${FAULT_LABEL[action.kind]}. Other readings could point elsewhere. Consider more tests before servicing.`)
        : warn('Diagnosis recorded', `The evidence you selected does not clearly support ${FAULT_LABEL[action.kind]}. Compare the readings again.`);
      break;
    }
    case 'TRAINING_STEP':
      feedback = stepEffect(next, action.step);
      break;
    case 'SET_LEARNING_MODE':
      t.mode = action.mode;
      feedback = info('Learning mode', `Mode set to ${action.mode}. Equipment behaves the same; only guidance changes.`);
      break;
    case 'APPLY_POWER_PLAN':
      // Handled by the power module through the engine; kept here so the union stays closed.
      feedback = info('Power plan', 'Applied.');
      break;
  }

  logEntry(next, describeStep(action), true, feedback.title);
  syncRecyclerModule(next);

  // Time passes deterministically with the task; resources keep flowing while the unit is stopped.
  const minutes = minutesFor(action);
  t.minuteOfHour += minutes;
  const hours = Math.floor(t.minuteOfHour / 60);
  t.minuteOfHour -= hours * 60;
  if (hours > 0) {
    const before = next.hour;
    const savedMinutes = t.minuteOfHour;
    next = advance(next, hours);
    if (next.training) next.training.minuteOfHour = savedMinutes;
    if (next.hour > before && next.status === 'failed') feedback = { ...feedback, body: `${feedback.body}\n\nThe mission ended while this task was under way.` };
    syncRecyclerModule(next);
  }
  return { ok: true, state: next, feedback };
}

export { FAULT_SLOT };
