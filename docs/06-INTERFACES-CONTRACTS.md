# 06 — Shared Interfaces & TypeScript Contracts

**Document Status:** Canonical Integration Contract  
**Code Reference:** `src/simulation/types.ts`  
**Governing Rule:** Any modification to this document or `src/simulation/types.ts` requires explicit approval from all 3 workstream owners (Kammoun, Habib, Amina).

---

## 1. Habitat Module Identifiers & Statuses

```ts
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
  | 'operational'  // Functioning nominally (Green)
  | 'warning'      // Under environmental stress or low capacity (Amber)
  | 'degraded'     // Mechanical fault; reduced throughput (Orange)
  | 'offline'      // Suspended by commander or blacked out (Red)
  | 'repairing';   // Active maintenance underway (Cyan)

export interface ModuleState {
  id: ModuleId;
  name: string;
  status: ModuleStatus;
  enabled: boolean;
  health: number; // 0.0 to 1.0
  powerDemandKw: number;
  suppliedPowerKw: number;
  repairHoursRemaining?: number;
  description: string;
}
```

---

## 2. Resource Inventory & Telemetry Contracts

All resources must specify explicit, standardized physical units:

```ts
export interface Resources {
  /** Current battery stored energy in kilowatt-hours (kWh). Clamped to [0, batteryCapacityKwh]. */
  batteryKwh: number;

  /** Maximum chemical energy storage capacity in kilowatt-hours (kWh). Default: 150 kWh. */
  batteryCapacityKwh: number;

  /** Available gaseous breathable oxygen in kilograms (kg). Default: 5.0 kg. */
  oxygenKg: number;

  /** Available potable water in liters (L). Default: 35.0 L. */
  waterLiters: number;

  /** Remaining packaged food rations in unit rations. Default: 48. */
  foodRations: number;

  /** Available mechanical pump replacement assemblies. Default: 1. */
  sparePumps: number;
}
```

---

## 3. Mission State & Event Contracts

```ts
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
  failureReason?: string;
}
```

---

## 4. Player & Session Actions

Actions are organized as a discriminated union:

```ts
export type InWorldAction =
  | { type: 'SET_ENABLED'; moduleId: 'greenhouse' | 'research-lab'; enabled: boolean }
  | { type: 'REPAIR_WATER_RECYCLER' }
  | { type: 'ADVANCE_TIME'; hours: number };

export type SessionAction =
  | { type: 'REWIND_TO'; hour: number; branchFrom: string }
  | { type: 'RESET_MISSION' };

export type MissionAction = InWorldAction | SessionAction;

export type ActionResult =
  | { ok: true; state: MissionState; message?: string }
  | { ok: false; reason: string; state: MissionState };

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
```

---

## 5. Timeline History, Autopsy & Comparison Contracts

```ts
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
```

---

## 6. 3D Scene Interface

Habib's `<HabitatScene />` component consumes and emits:

```tsx
export interface HabitatSceneProps {
  missionState: MissionState;
  selectedModuleId: ModuleId | null;
  onSelectModule: (moduleId: ModuleId) => void;
  className?: string;
}
```

## Implemented engine additions (2026-10-25)

The user-authorized engine completion preserves all existing module IDs, status unions, action shapes and state fields. `src/simulation/types.ts` is authoritative; the excerpts above show the original baseline.

Additions: optional `MissionState.config`, `power`, last-interval `flows` and structured `failure`; optional `REWIND_TO.snapshotId`; optional config `oxygenProcessWaterLitersPerKg`; summary `significantEvents`, `rootCause`, `minimumMargins` and `thresholds`. `MissionSnapshot.timestamp` now means logical event sequence. Store `branches` archives prior paths while `history` remains the active path. `advanceMissionSteps` and `recordMissionAction` expose deterministic hourly recording to integrators. Domain rewind without session history now rejects with instructions.

Module power ratings remain nameplate demand when enabled; actual supply is `suppliedPowerKw`. Storm is already active in the initial state. Fixtures are now engine-derived and retain their six existing keys. These deliberate corrections are described in [04-SIMULATION-ENGINE.md](04-SIMULATION-ENGINE.md).

---

## 7. Training Contracts (additive)

Defined in `src/simulation/training/types.ts` and re-exported from `types.ts`:
`TrainingState`, `TrainingAction`, `TrainingStepAction`, `RecyclerComponentId`, `ReplaceableId`, `RecyclerFaultKind`, `Measurement`, `EvidenceRecord`, `Hypothesis`, `ProcedureState`, `VerificationResult`, `TrainingFeedback`.

- `MissionState.training?: TrainingState`
- `MissionAction = InWorldAction | SessionAction | TrainingAction`
- `ActionResult` carries optional `feedback`
- `HabitatSceneProps` gains optional `viewMode`, `onViewModeChange`, `onTrainingAction`, `selectedComponentId`, `onSelectComponent`. Existing callers keep working unchanged.

These changes are backwards compatible; per the governing rule they still need sign-off from all three owners.

## Multi-mission contracts

`MissionState` optionally carries `missionVersion` and typed `emergency` state; the existing seven module IDs and Red Storm fields remain compatible. `MissionAction` adds `ADVANCE_MINUTES` and a discriminated `EMERGENCY_ACTION.command` union. `createRegisteredMission(id, fault?)` initializes the registry scenario. Successful atmospheric actions expose `decisionState` plus intermediate `transitions` for history recording; these are transient return values rather than nested saved-state history.

The store accepts `startMission(id?, fault?)` and `restoreSession(id?)`. Saves use a validated v2 envelope indexed by mission ID/version, with legacy Red Storm migration. Reset/rewind preserve selected scenario identity. Minute snapshots use fractional derived `hour` values; exact `snapshotId` selection is preferred. Scene action callbacks accept the broader `MissionAction` union and remain requests validated by the engine. See [21-MULTI-MISSION-EXPANSION.md](21-MULTI-MISSION-EXPANSION.md).
