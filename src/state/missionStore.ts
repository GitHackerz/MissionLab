import { create } from 'zustand';
import type {
  ActionResult,
  AvailableAction,
  MissionAction,
  MissionSnapshot,
  MissionBranch,
  MissionState,
  ModuleId,
  RecyclerComponentId,
  TrainingFeedback,
} from '@/simulation/types';
import {
  advanceMission,
  applyMissionAction,
  createInitialMission,
  createTrainingMission,
  getAvailableActions,
} from '@/simulation/engine';
import { createSnapshot, forkMission, recordMissionAction } from '@/simulation/history';
import { FIXTURES } from '@/simulation/fixtures';
import { ALL_MODULE_IDS } from '@/simulation/types';
import { RED_STORM_CONFIG, validateConfig } from '@/simulation/config';

/** Dev-only fixture switcher in the mission header (hidden in production builds). */
export const FIXTURES_ENABLED = process.env.NODE_ENV !== 'production';

const SESSION_STORAGE_KEY = 'missionlab_active_session_v1';

export function saveSessionToStorage(state: {
  missionState: MissionState;
  history: MissionSnapshot[];
  branches: MissionBranch[];
  trainingMode: boolean;
}) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or disabled storage
  }
}

/** Reject stale/corrupt local records before they reach the live UI or engine. */
function isRestorableMission(value: unknown): value is MissionState {
  if (!value || typeof value !== 'object') return false;
  const m = value as MissionState;
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  if (typeof m.scenarioId !== 'string' || typeof m.branchId !== 'string' || !finite(m.hour) || !finite(m.durationHours) || m.durationHours <= 0 || m.hour > m.durationHours || !['running', 'success', 'failed', 'briefing'].includes(m.status) || typeof m.stormActive !== 'boolean') return false;
  if (!m.resources || !['batteryKwh', 'batteryCapacityKwh', 'waterLiters', 'oxygenKg', 'foodRations', 'sparePumps'].every(key => finite(m.resources[key as keyof typeof m.resources]))) return false;
  if (!m.modules || !ALL_MODULE_IDS.every(id => { const mod = m.modules[id]; return mod && mod.id === id && typeof mod.enabled === 'boolean' && finite(mod.powerDemandKw) && finite(mod.suppliedPowerKw) && finite(mod.health) && ['operational', 'warning', 'degraded', 'offline', 'repairing'].includes(mod.status); })) return false;
  if (!finite(m.crewCount) || m.crewCount <= 0 || !finite(m.scienceScore)) return false;
  if (!Array.isArray(m.events) || !m.events.every(e => e && typeof e.id === 'string' && typeof e.message === 'string' && finite(e.hour))) return false;
  if (m.config) { try { validateConfig(m.config); } catch { return false; } }
  const t = m.training;
  if (t) {
    const p = t.recycler?.procedure;
    if (!['cadet', 'engineer', 'commander'].includes(t.mode) || !finite(t.minuteOfHour) || t.minuteOfHour >= 60 || !p || !Array.isArray(p.completedSteps) || !p.slots) return false;
    if (!['available', 'investigating', 'diagnosis-recorded', 'preparing', 'intervention', 'verifying', 'completed', 'failed-verification'].includes(p.phase) || !['isolationReviewed', 'maintenanceMode', 'inactiveConfirmed', 'hatchOpen', 'testReady'].every(key => typeof p[key as keyof typeof p] === 'boolean')) return false;
    if (p.held && (!['pump-cartridge', 'filter-cartridge', 'flow-sensor'].includes(p.held.part) || ![0, 90, 180, 270].includes(p.held.orientation) || typeof p.held.inspected !== 'boolean')) return false;
    if (!['pump-cartridge', 'filter-cartridge', 'flow-sensor'].every(id => { const slot = p.slots[id as keyof typeof p.slots]; return slot && ['original', 'spare', 'empty'].includes(slot.occupant) && ['locked', 'released'].includes(slot.retainers); })) return false;
    if (!t.inventory || !finite(t.inventory.filterCartridges) || !finite(t.inventory.flowSensors) || !Array.isArray(t.inspectedComponents) || !Array.isArray(t.log) || !t.log.every(e => e && finite(e.hour) && finite(e.minute) && typeof e.action === 'string' && typeof e.ok === 'boolean')) return false;
    if (!Array.isArray(t.evidence) || !t.evidence.every(e => e && typeof e.id === 'string' && Array.isArray(e.readings) && e.readings.every(r => r && typeof r.label === 'string' && typeof r.unit === 'string' && finite(r.value) && finite(r.expectedMin) && finite(r.expectedMax)))) return false;
    if (!Array.isArray(t.hypotheses) || !t.hypotheses.every(h => h && ['pump-seized', 'filter-clogged', 'sensor-drift'].includes(h.kind) && Array.isArray(h.evidenceIds))) return false;
  }
  return true;
}

export function loadSessionFromStorage(): {
  missionState: MissionState;
  history: MissionSnapshot[];
  branches: MissionBranch[];
  trainingMode: boolean;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && isRestorableMission(parsed.missionState) && Array.isArray(parsed.history) && parsed.history.length > 0 && parsed.history.every((snap: MissionSnapshot) => snap && typeof snap.snapshotId === 'string' && isRestorableMission(snap.state)) && (!parsed.branches || Array.isArray(parsed.branches) && parsed.branches.every((branch: MissionBranch) => branch && Array.isArray(branch.snapshots) && branch.snapshots.length > 0 && branch.snapshots.every(snap => isRestorableMission(snap.state))))) {
      return parsed;
    }
  } catch {
    // Ignore invalid JSON
  }
  return null;
}

export function clearSessionFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}

export interface MissionStore {
  // State
  missionState: MissionState;
  selectedModuleId: ModuleId | null;
  availableActions: AvailableAction[];
  history: MissionSnapshot[];
  branches: MissionBranch[];
  activeFixtureKey: string;
  /** True once the component-level training model is active (docs/16). Off by default so the pure scenario engine behaves as specified. */
  trainingMode: boolean;
  /** Latest educational feedback from a training action (accepted or rejected). */
  lastFeedback: TrainingFeedback | null;
  /** 'service' = detailed equipment view of the water recycler in the colony scene. */
  viewMode: 'colony' | 'service';
  selectedComponentId: RecyclerComponentId | null;
  /** Auto-run flag; the guest lock screen switches it off when the trial ends. */
  autoRunning: boolean;

  // Actions
  enableTraining: () => void;
  setAutoRunning: (running: boolean) => void;
  /** Starts the training mission (used by the mission-ui briefing). */
  startMission: () => void;
  restoreSession: () => boolean;
  selectComponent: (id: RecyclerComponentId | null) => void;
  setViewMode: (mode: 'colony' | 'service') => void;
  clearFeedback: () => void;
  selectModule: (moduleId: ModuleId | null) => void;
  applyAction: (action: MissionAction) => ActionResult;
  advanceTime: (hours: number) => void;
  loadFixture: (fixtureKey: string) => void;
  resetMission: () => void;
  rewindTo: (hour: number) => void;
}

const initialMission = createInitialMission(RED_STORM_CONFIG);
const initialSnapshot = createSnapshot(initialMission);

export const useMissionStore = create<MissionStore>((set, get) => ({
  missionState: initialMission,
  selectedModuleId: 'water-recycler', // Start with an inspectable module
  availableActions: getAvailableActions(initialMission),
  history: [initialSnapshot],
  branches: [],
  activeFixtureKey: 'initial',
  trainingMode: false,
  lastFeedback: null,
  viewMode: 'colony',
  selectedComponentId: null,
  autoRunning: false,

  setAutoRunning: (running) => set({ autoRunning: running }),
  startMission: () => get().enableTraining(),
  restoreSession: () => {
    const saved = loadSessionFromStorage();
    if (!saved || !saved.missionState) return false;
    set({
      missionState: saved.missionState,
      history: saved.history,
      branches: saved.branches || [],
      trainingMode: saved.trainingMode ?? true,
      availableActions: getAvailableActions(saved.missionState),
      activeFixtureKey: 'saved',
    });
    return true;
  },
  enableTraining: () => {
    if (get().trainingMode) return;
    const state = createTrainingMission(RED_STORM_CONFIG);
    set({
      trainingMode: true,
      missionState: state,
      availableActions: getAvailableActions(state),
      history: [createSnapshot(state)],
      branches: [],
      activeFixtureKey: 'initial',
    });
  },
  selectComponent: (id) => set({ selectedComponentId: id }),
  setViewMode: (mode) => set({ viewMode: mode, ...(mode === 'service' ? { selectedModuleId: 'water-recycler' as const } : {}) }),
  clearFeedback: () => set({ lastFeedback: null }),

  selectModule: (moduleId: ModuleId | null) => {
    set({ selectedModuleId: moduleId });
  },

  applyAction: (action: MissionAction): ActionResult => {
    const { missionState, history } = get();

    // Special case: Session Reset
    if (action.type === 'RESET_MISSION') {
      clearSessionFromStorage();
      const resetState = (get().trainingMode ? createTrainingMission : createInitialMission)(RED_STORM_CONFIG);
      const snap = createSnapshot(resetState, action);
      set({
        missionState: resetState,
        availableActions: getAvailableActions(resetState),
        history: [snap],
        activeFixtureKey: 'initial',
        branches: [],
        lastFeedback: null,
        viewMode: 'colony',
      });
      return { ok: true, state: resetState };
    }

    // Special case: Session Rewind
    if (action.type === 'REWIND_TO') {
      const { branches } = get();
      if (!Number.isSafeInteger(action.hour) || action.hour < 0 || action.hour > missionState.hour || action.branchFrom !== missionState.branchId) {
        return { ok: false, reason: 'Select an existing hour on the active branch.', state: missionState };
      }
      const targetSnap = action.snapshotId
        ? history.find(s => s.snapshotId === action.snapshotId && s.hour === action.hour)
        : history.find(s => s.hour === action.hour);
      if (!targetSnap) return { ok: false, reason: 'Snapshot not found. Select an existing decision point.', state: missionState };
      const ownStart = history.findIndex(s => s.branchId === missionState.branchId);
      const original: MissionBranch = { branchId: missionState.branchId,
        parentBranchId: ownStart > 0 ? history[ownStart - 1].branchId : undefined,
        forkHour: history[Math.max(0, ownStart)].hour,
        snapshots: structuredClone(history), finalStatus: missionState.status };
      const branch = forkMission(history, targetSnap.snapshotId, `branch-${branches.length + 1}`);
      const restoredState = structuredClone(branch.snapshots.at(-1)!.state);
      const nextBranches = [...branches, original];
      saveSessionToStorage({
        missionState: restoredState,
        history: branch.snapshots,
        branches: nextBranches,
        trainingMode: get().trainingMode,
      });
      set({ missionState: restoredState, history: branch.snapshots,
        branches: nextBranches, availableActions: getAvailableActions(restoredState),
        lastFeedback: null, viewMode: 'colony' });
      return { ok: true, state: restoredState };
    }

    // In-world actions
    const transition = recordMissionAction(missionState, history, action);
    const result = transition.result;
    if (result.ok) {
      saveSessionToStorage({
        missionState: result.state,
        history: transition.history,
        branches: get().branches,
        trainingMode: get().trainingMode,
      });
      set({ missionState: result.state,
        availableActions: getAvailableActions(result.state), history: transition.history,
        ...(result.feedback || get().lastFeedback ? { lastFeedback: result.feedback ?? null } : {}) });
    } else if (result.feedback || result.state !== missionState) {
      if (result.state !== missionState) saveSessionToStorage({ missionState: result.state, history, branches: get().branches, trainingMode: get().trainingMode });
      // Rejected training actions still return a state with the rejection logged as learning evidence.
      set({ lastFeedback: result.feedback ?? { kind: 'rejected', title: 'Not possible', body: result.reason },
        ...(result.state !== missionState ? { missionState: result.state } : {}) });
    }
    return result;
  },

  advanceTime: (hours: number) => {
    get().applyAction({ type: 'ADVANCE_TIME', hours });
  },

  loadFixture: (fixtureKey: string) => {
    if (fixtureKey === 'initial') { get().resetMission(); return; }
    // Accelerated demo path: the REAL engine, no canned values. Plan applied, then time advanced to the fault.
    if (fixtureKey === 'demo-fault') {
      const planned = applyMissionAction(createTrainingMission(RED_STORM_CONFIG), {
        type: 'APPLY_POWER_PLAN', loads: { greenhouse: false, 'research-lab': false },
      });
      const demo = advanceMission(planned.state, 30);
      set({ trainingMode: true, missionState: demo, availableActions: getAvailableActions(demo),
        history: [createSnapshot(demo)], activeFixtureKey: fixtureKey, branches: [], lastFeedback: null,
        selectedModuleId: 'water-recycler' });
      return;
    }
    const fixture = FIXTURES[fixtureKey];
    if (!fixture) {
      console.warn(`Fixture ${fixtureKey} not found`);
      return;
    }
    const stateCopy = JSON.parse(JSON.stringify(fixture));
    const snap = createSnapshot(stateCopy);
    set({
      missionState: stateCopy,
      availableActions: getAvailableActions(stateCopy),
      history: [snap],
      activeFixtureKey: fixtureKey,
      branches: [],
      lastFeedback: null,
    });
  },

  resetMission: () => {
    get().applyAction({ type: 'RESET_MISSION' });
  },

  rewindTo: (hour: number) => {
    get().applyAction({
      type: 'REWIND_TO',
      hour,
      branchFrom: get().missionState.branchId,
    });
  },
}));
