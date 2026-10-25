/**
 * MISSIONLAB - Training & Procedure Contracts (additive to ../types.ts)
 *
 * Simplified educational models. Nothing here is a real aerospace procedure,
 * and the numbers are teaching approximations, not NASA hardware data.
 */
import type { ModuleId } from '../types';

/** Replaceable cartridges/modules in the water recycler service bay. */
export type ReplaceableId = 'pump-cartridge' | 'filter-cartridge' | 'flow-sensor';

export const REPLACEABLE_IDS: ReplaceableId[] = ['pump-cartridge', 'filter-cartridge', 'flow-sensor'];

/** Every part of the simplified water-recycler model that the learner can inspect. */
export type RecyclerComponentId =
  | 'wastewater-tank'
  | 'pump-cartridge'
  | 'filter-cartridge'
  | 'treatment-stage'
  | 'flow-sensor'
  | 'clean-tank'
  | 'service-hatch'
  | 'control-panel';

export type RecyclerFaultKind = 'pump-seized' | 'filter-clogged' | 'sensor-drift';

export type MeasurementId =
  | 'pump-rpm'
  | 'pump-power-kw'
  | 'circulation-flow-lph'
  | 'pressure-in-kpa'
  | 'pressure-out-kpa'
  | 'sensor-reported-recovery-lph'
  | 'clean-tank-inflow-lph';

export type DiagnosticTestId =
  | 'read-flow-sensor'
  | 'check-pump'
  | 'read-pressure'
  | 'compare-output'
  | 'run-diagnostic-cycle';

export type ToolId = 'hatch-key' | 'retainer-driver' | 'sample-kit';

export type Orientation = 0 | 90 | 180 | 270;

export type LearningMode = 'cadet' | 'engineer' | 'commander';

export interface Measurement {
  id: MeasurementId;
  label: string;
  value: number;
  unit: string;
  expectedMin: number;
  expectedMax: number;
  inRange: boolean;
}

export interface EvidenceRecord {
  id: string;
  hour: number;
  minute: number;
  testId: DiagnosticTestId;
  title: string;
  readings: Measurement[];
}

export interface Hypothesis {
  id: string;
  hour: number;
  kind: RecyclerFaultKind;
  evidenceIds: string[];
  /** How well the selected evidence is consistent with the hypothesis (a rule check, not the answer). */
  support: 'strong' | 'partial' | 'none';
}

export type SlotOccupant = 'original' | 'spare' | 'empty';

export interface SlotState {
  occupant: SlotOccupant;
  retainers: 'locked' | 'released';
}

export interface HeldPart {
  part: ReplaceableId;
  orientation: Orientation;
  inspected: boolean;
}

export type ProcedurePhase =
  | 'available'
  | 'investigating'
  | 'diagnosis-recorded'
  | 'preparing'
  | 'intervention'
  | 'verifying'
  | 'completed'
  | 'failed-verification';

export type ProcedureStepId =
  | 'identify-equipment'
  | 'review-isolation'
  | 'maintenance-mode'
  | 'confirm-inactive'
  | 'select-tool'
  | 'open-hatch'
  | 'locate-component'
  | 'release-retainers'
  | 'remove-component'
  | 'retrieve-spare'
  | 'inspect-orient-spare'
  | 'install-component'
  | 'secure-component'
  | 'close-hatch'
  | 'restore-test-ready'
  | 'startup-test';

export interface VerificationResult {
  hour: number;
  passed: boolean;
  readings: Measurement[];
  remainingIssues: string[];
}

export interface ProcedureState {
  phase: ProcedurePhase;
  isolationReviewed: boolean;
  maintenanceMode: boolean;
  inactiveConfirmed: boolean;
  tool: ToolId | null;
  hatchOpen: boolean;
  testReady: boolean;
  slots: Record<ReplaceableId, SlotState>;
  held: HeldPart | null;
  completedSteps: ProcedureStepId[];
  verification: VerificationResult | null;
}

export interface RecyclerTrainingState {
  /** Configured root cause for this mission. Never shown to the learner. */
  faultKind: RecyclerFaultKind;
  /** Hour the fault actually occurred; null before onset. */
  faultOnsetHour: number | null;
  procedure: ProcedureState;
}

export interface TrainingLogEntry {
  hour: number;
  minute: number;
  action: string;
  ok: boolean;
  detail: string;
}

export interface TrainingState {
  mode: LearningMode;
  /** Minutes already elapsed inside the current simulation hour (0..59). */
  minuteOfHour: number;
  recycler: RecyclerTrainingState;
  /** Spares other than pump cartridges, which use `resources.sparePumps`. */
  inventory: { filterCartridges: number; flowSensors: number };
  evidence: EvidenceRecord[];
  hypotheses: Hypothesis[];
  inspectedComponents: RecyclerComponentId[];
  powerPlanAppliedHour: number | null;
  /** Hours the greenhouse was lit, driving crop output (see engine food model). */
  cropGrowthHours: number;
  log: TrainingLogEntry[];
}

export type PlanLoadId = 'greenhouse' | 'research-lab' | 'water-recycler' | 'life-support';

export type TrainingStepAction =
  | { step: 'IDENTIFY_EQUIPMENT'; moduleId: ModuleId }
  | { step: 'REVIEW_ISOLATION' }
  | { step: 'ENTER_MAINTENANCE_MODE' }
  | { step: 'CONFIRM_INACTIVE' }
  | { step: 'SELECT_TOOL'; tool: ToolId }
  | { step: 'OPEN_HATCH' }
  | { step: 'LOCATE_COMPONENT'; slot: ReplaceableId }
  | { step: 'RELEASE_RETAINERS'; slot: ReplaceableId }
  | { step: 'REMOVE_COMPONENT'; slot: ReplaceableId }
  | { step: 'TAKE_SPARE'; part: ReplaceableId }
  | { step: 'INSPECT_SPARE' }
  | { step: 'ROTATE_PART' }
  | { step: 'INSTALL_COMPONENT'; slot: ReplaceableId }
  | { step: 'SECURE_COMPONENT'; slot: ReplaceableId }
  | { step: 'CLOSE_HATCH' }
  | { step: 'RESTORE_TEST_READY' }
  | { step: 'RUN_STARTUP_TEST' }
  | { step: 'ABORT_PROCEDURE' };

export type TrainingAction =
  | { type: 'INSPECT_COMPONENT'; componentId: RecyclerComponentId }
  | { type: 'RUN_DIAGNOSTIC'; testId: DiagnosticTestId }
  | { type: 'RECORD_HYPOTHESIS'; kind: RecyclerFaultKind; evidenceIds: string[] }
  | { type: 'TRAINING_STEP'; step: TrainingStepAction }
  | { type: 'APPLY_POWER_PLAN'; loads: Partial<Record<PlanLoadId, boolean>> }
  | { type: 'SET_LEARNING_MODE'; mode: LearningMode };

export interface TrainingFeedback {
  kind: 'info' | 'success' | 'warning' | 'rejected';
  title: string;
  body: string;
}
