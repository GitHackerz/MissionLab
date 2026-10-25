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
import { RED_STORM_CONFIG } from '@/simulation/config';

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
    if (parsed && parsed.missionState && Array.isArray(parsed.history)) {
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
