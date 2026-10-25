import type { MissionConfig } from '../types';
import type { LearningMode } from '../training/types';

export type MissionId = 'mission-01-red-storm' | 'mission-02-pressure-drop' | 'mission-03-silent-air';
export type EmergencyKind = 'pressure' | 'air';
export type FaultId = 'seal-leak' | 'valve-stuck' | 'pressure-sensor-drift' | 'fan-failure' | 'media-exhausted' | 'co2-sensor-drift';
export type ComponentId = 'seal' | 'valve' | 'pressure-sensor' | 'fan' | 'scrubber' | 'co2-sensor';
export type TestId = 'zone-survey' | 'independent-analyzer' | 'valve-test' | 'leak-survey' | 'fan-test' | 'scrubber-test';
export type ZoneId = 'hub' | 'service';
export interface GasZone { volumeM3: number; inertMol: number; oxygenMol: number; co2Mol: number }
export interface Reading { label: string; value: number; unit: string }
export interface DiagnosticRecord { id: string; minute: number; test: TestId; readings: Reading[] }
export interface EmergencyRules {
  temperatureK: number; initialPressureKpa: number; initialOxygenFraction: number; initialCo2Ppm: number;
  hubVolumeM3: number; serviceVolumeM3: number; minimumPressureKpa: number; minimumOxygenKpa: number;
  maximumCo2Ppm: number; recoveryCo2Ppm: number; minimumVerifiedPressureKpa: number;
  leakConductanceMolPerMinKpa: number; exchangeConductanceMolPerMinKpa: number;
  regulatorMolPerMin: number; atmosphereReserveMol: number;
  crewOxygenMolPerMin: number; crewCo2MolPerMin: number;
  oxygenFeedMolPerMin: number; scrubberMolPerMin: number; scrubberCapacityMol: number;
  backupRemovalMolPerMin: number; backupCapacityMol: number;
  fanKw: number; scrubberKw: number; regulatorKw: number; backupKw: number;
  faultMinute: number; durationMinutes: number; verificationMinutes: number;
  defaultFault: FaultId;
}
export interface MissionDefinition {
  id: MissionId; version: number; number: string; title: string; hazard: string; difficulty: string;
  briefing: string; objective: string; destination: string; concept: string;
  objectives: string[]; systems: string[]; playerActions: string[]; gradingRules: string[]; diagnosticTests: TestId[]; faultVariants: FaultId[]; components: ComponentId[];
  guidanceLevels: LearningMode[]; config: MissionConfig; emergency?: EmergencyRules;
  sourceUrls: string[]; assumptions: string[];
}
export interface EmergencyState {
  kind: EmergencyKind; minute: number; sequence: number; mode: LearningMode; fault: FaultId; faultTriggered: boolean;
  zones: Record<ZoneId, GasZone>; crewZone: ZoneId;
  valveCommandOpen: boolean; valveActualOpen: boolean; exchangeEnabled: boolean;
  regulatorEnabled: boolean; fanEnabled: boolean; scrubberEnabled: boolean; backupEnabled: boolean;
  atmosphereReserveMol: number; scrubberRemainingMol: number; backupRemainingMol: number;
  gasLostMol: number; oxygenLostMol: number; oxygenFedMol: number; co2RemovedMol: number;
  leakMolPerMin: number; co2RemovalMolPerMin: number; pressureTrendKpaPerMin: number; co2TrendPpmPerMin: number;
  equipmentSupplyKw: number; equipmentDemandKw: number;
  inspected: ComponentId[]; evidence: DiagnosticRecord[];
  hypotheses: { minute: number; fault: FaultId; evidenceIds: string[] }[];
  repairs: ComponentId[]; spares: Record<ComponentId, number>;
  procedure: { component: ComponentId; step: number; coverOpen: boolean; removed: boolean; tool: boolean } | null;
  verification: { requestedMinute: number; completedMinute?: number; passed: boolean; reason: string } | null;
  stableMinutes: number; lastFeedback: string;
}
export type EmergencyCommand =
  | { kind: 'inspect'; component: ComponentId }
  | { kind: 'diagnostic'; test: TestId }
  | { kind: 'hypothesis'; fault: FaultId; evidenceIds: string[] }
  | { kind: 'valve'; open: boolean }
  | { kind: 'exchange'; enabled: boolean }
  | { kind: 'crew'; zone: ZoneId }
  | { kind: 'regulator' | 'fan' | 'scrubber' | 'backup'; enabled: boolean }
  | { kind: 'begin-repair'; component: ComponentId }
  | { kind: 'procedure'; step: number }
  | { kind: 'calibrate'; component: ComponentId }
  | { kind: 'verify' }
  | { kind: 'guidance'; mode: LearningMode };
export type EmergencyAction = { type: 'EMERGENCY_ACTION'; command: EmergencyCommand } | { type: 'ADVANCE_MINUTES'; minutes: number };
