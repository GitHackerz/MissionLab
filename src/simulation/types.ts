import type { EmergencyAction, EmergencyState } from './missions/types';
/**
 * MISSIONLAB - Shared Simulation Contracts
 *
 * This file is the single source of truth for TypeScript types used across:
 * - Simulation Engine (Kammoun)
 * - 3D Digital Twin (Habib)
 * - Mission Control UI & Debrief (Amina)
 */

import type { RecyclerComponentId, TrainingAction, TrainingFeedback, TrainingState } from './training/types';
export type { RecyclerComponentId, TrainingAction, TrainingFeedback, TrainingState };

export type ModuleId =
  | 'solar-array'
  | 'battery-bank'
  | 'life-support'
  | 'water-recycler'
  | 'greenhouse'
  | 'research-lab'
  | 'crew-habitat';

export const ALL_MODULE_IDS: ModuleId[] = [
  'solar-array',
  'battery-bank',
  'life-support',
  'water-recycler',
  'greenhouse',
  'research-lab',
  'crew-habitat',
];

export type ModuleStatus =
  | 'operational'
  | 'warning'
  | 'degraded'
  | 'offline'
  | 'repairing';

export interface ModuleState {
  id: ModuleId;
  name: string;
  status: ModuleStatus;
  enabled: boolean;
  health: number; // 0.0 to 1.0 (1.0 = 100% operational)
  powerDemandKw: number;
  suppliedPowerKw: number;
  repairHoursRemaining?: number;
  description: string;
}

export interface Resources {
  /** Current battery stored energy in kilowatt-hours (kWh) */
  batteryKwh: number;
  /** Maximum battery capacity in kilowatt-hours (kWh) */
  batteryCapacityKwh: number;
  /** Current available gaseous oxygen in kilograms (kg) */
  oxygenKg: number;
  /** Current potable/circulating water in liters (L) */
  waterLiters: number;
  /** Remaining packaged food rations in unit rations */
  foodRations: number;
  /** Available spare mechanical pump assemblies for repairs */
  sparePumps: number;
}

export type EventSeverity = 'info' | 'warning' | 'critical';

export interface MissionEvent {
  id: string;
  hour: number;
  type: string;
  severity: EventSeverity;
  moduleId?: ModuleId;
  message: string;
  causeIds?: string[];
}

export type MissionStatus = 'briefing' | 'running' | 'success' | 'failed';

export interface MissionState {
  scenarioId: string;
  branchId: string;
  hour: number;
  durationHours: number;
  status: MissionStatus;
  stormActive: boolean;
  crewCount: number;
  resources: Resources;
  modules: Record<ModuleId, ModuleState>;
  events: MissionEvent[];
  scienceScore: number;
  /** Embedded serializable scenario rules; optional for legacy UI fixtures. */
  config?: MissionConfig;
  power?: PowerTelemetry;
  flows?: ResourceFlows;
  failure?: MissionFailure;
  failureReason?: string;
  /** Component-level training model (docs/16). Absent in legacy fixtures. */
  training?: TrainingState;
  missionVersion?: number;
  emergency?: EmergencyState;
}

// Discriminated union of in-world player decisions
export type InWorldAction =
  | { type: 'SET_ENABLED'; moduleId: 'greenhouse' | 'research-lab'; enabled: boolean }
  | { type: 'REPAIR_WATER_RECYCLER' }
  | { type: 'ADVANCE_TIME'; hours: number };

// Session / replay controls (orchestration level)
export type SessionAction =
  | { type: 'REWIND_TO'; hour: number; branchFrom: string; snapshotId?: string }
  | { type: 'RESET_MISSION' };

export type MissionAction = InWorldAction | SessionAction | TrainingAction | EmergencyAction;

export type ActionResult =
  | { ok: true; state: MissionState; message?: string; feedback?: TrainingFeedback; decisionState?: MissionState; transitions?: MissionState[] }
  | { ok: false; reason: string; state: MissionState; feedback?: TrainingFeedback };

export interface AvailableAction {
  id: string;
  type: MissionAction['type'];
  label: string;
  description: string;
  enabled: boolean;
  disabledReason?: string;
  powerDeltaKw?: number;
  costSparePumps?: number;
  durationHours?: number;
  payload?: Partial<MissionAction>;
}

export interface MissionConfig {
  scenarioId: string;
  title: string;
  description: string;
  durationHours: number;
  crewCount: number;
  initialResources: Resources;
  stormSolarGenerationKw: number;
  normalSolarGenerationKw: number;
  batterySafetyThresholdKwh: number;
  waterSafetyThresholdLiters: number;
  oxygenSafetyThresholdKg: number;
  crewWaterUseLitersPerHour: number;
  normalWaterRecoveryLitersPerHour: number;
  crewOxygenUseKgPerHour: number;
  normalOxygenGenKgPerHour: number;
  waterRecyclerRepairDurationHours: number;
  oxygenProcessWaterLitersPerKg?: number;
}

export interface MissionSnapshot {
  snapshotId: string;
  branchId: string;
  hour: number;
  state: MissionState;
  actionTaken?: MissionAction;
  timestamp: number;
}

export interface MissionBranch {
  branchId: string;
  parentBranchId?: string;
  forkHour: number;
  snapshots: MissionSnapshot[];
  finalStatus: MissionStatus;
}

export interface MissionSummary {
  scenarioId: string;
  branchId: string;
  finalHour: number;
  durationHours: number;
  status: MissionStatus;
  finalResources: Resources;
  minBatteryKwh: number;
  minWaterLiters: number;
  minOxygenKg: number;
  scienceScore: number;
  crewSurviving: number;
  failureReason?: string;
  keyDecisions: { hour: number; action: string; impact: string }[];
  autopsyCauseChain: string[];
  significantEvents: MissionEvent[];
  rootCause?: MissionFailure;
  minimumMargins: { batteryKwh: number; waterLiters: number; oxygenKg: number };
  thresholds: { batteryWarningKwh: number; waterFailureLiters: number; oxygenFailureKg: number };
}

export interface BranchComparison {
  branchA: MissionSummary;
  branchB: MissionSummary;
  resourceDelta: {
    batteryKwh: number;
    waterLiters: number;
    oxygenKg: number;
    scienceScore: number;
  };
  divergenceHour: number;
  keyDivergenceFactors: string[];
  outcomeDiffDescription: string;
}

export interface HabitatSceneProps {
  missionState: MissionState;
  selectedModuleId: ModuleId | null;
  onSelectModule: (moduleId: ModuleId) => void;
  className?: string;
  /** 'service' zooms into the water recycler's detailed, interactive service view. Default 'colony'. */
  viewMode?: 'colony' | 'service';
  onViewModeChange?: (mode: 'colony' | 'service') => void;
  /** Receives typed interaction REQUESTS from the 3D equipment. The engine decides what happens. */
  onTrainingAction?: (action: MissionAction) => void;
  /** Component the learner is inspecting (highlighted in service view). */
  selectedComponentId?: RecyclerComponentId | null;
  onSelectComponent?: (id: RecyclerComponentId) => void;
}

export interface PowerTelemetry {
  solarGenerationKw: number;
  requestedPowerKw: number;
  availablePowerKw: number;
  suppliedPowerKw: number;
  unservedPowerKw: number;
}

export interface MissionFailure {
  kind: 'power' | 'water' | 'oxygen' | 'pressure' | 'co2' | 'deadline';
  hour: number;
  resources: Resources;
  causeIds: string[];
}

/** Rates actually integrated in the most recent one-hour interval. */
export interface ResourceFlows {
  waterRecoveryLitersPerHour: number;
  oxygenProductionKgPerHour: number;
  oxygenProcessWaterLitersPerHour: number;
  netWaterLitersPerHour: number;
  netOxygenKgPerHour: number;
}
