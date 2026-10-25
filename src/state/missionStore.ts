import { advanceEmergencySteps } from '@/simulation/missions/emergency';
import { createRegisteredMission } from '@/simulation/engine';
import { getMission, RED_STORM_ID, isMissionId } from '@/simulation/missions/registry';
import type { MissionId, FaultId } from '@/simulation/missions/types';
import { compatibleSession } from '@/simulation/missions/saves';
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

const SESSION_STORAGE_KEY = 'missionlab_sessions_v2';
const LEGACY_KEY = 'missionlab_active_session_v1';
interface SavedSession { missionState: MissionState; history: MissionSnapshot[]; branches: MissionBranch[]; trainingMode: boolean }
interface SavedEnvelope { formatVersion: 2; activeMissionId: MissionId; sessions: Partial<Record<MissionId, { missionVersion: number; session: SavedSession }>> }
function readEnvelope(): SavedEnvelope {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null') as SavedEnvelope | null;
    if (raw?.formatVersion === 2 && isMissionId(raw.activeMissionId) && raw.sessions && typeof raw.sessions === 'object') return raw;
  } catch {}
  return { formatVersion: 2, activeMissionId: RED_STORM_ID, sessions: {} };
}
export function saveSessionToStorage(state: SavedSession) {
  if (typeof window === 'undefined') return;
  try {
    const id = state.missionState.scenarioId;
    if (!isMissionId(id)) return;
    const envelope = readEnvelope();
    envelope.activeMissionId = id;
    envelope.sessions[id] = { missionVersion: getMission(id).version, session: state };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(envelope));
  } catch { /* Storage may be unavailable or full. The in-memory mission remains playable. */ }
}
export function loadSessionFromStorage(missionId?: MissionId): SavedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const envelope = readEnvelope(), id = missionId ?? envelope.activeMissionId;
    const entry = envelope.sessions[id];
    if (entry && entry.missionVersion === getMission(id).version && compatibleSession(entry.session) && entry.session.missionState.scenarioId === id) return entry.session;
    // Only migrate a structurally valid Red Storm v1 session. No other mission can inherit it.
    if ((!missionId || id === RED_STORM_ID) && !localStorage.getItem(SESSION_STORAGE_KEY)) {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null') as SavedSession | null;
      if (legacy && legacy.missionState?.scenarioId === RED_STORM_ID && compatibleSession(legacy)) return legacy;
    }
  } catch {}
  return null;
}
export function clearSessionFromStorage(missionId?: MissionId) {
  if (typeof window === 'undefined') return;
  try {
    const envelope = readEnvelope();
    delete envelope.sessions[missionId ?? envelope.activeMissionId];
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(envelope));
    if (!missionId || missionId === RED_STORM_ID) localStorage.removeItem(LEGACY_KEY);
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
  startMission: (id?: MissionId, fault?: FaultId) => void;
  saveRecoveryMessage: string | null;
  restoreSession: (id?: MissionId) => boolean;
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
  saveRecoveryMessage: null,
  startMission: (id = RED_STORM_ID, fault) => {
    const old = get();
    saveSessionToStorage(old);
    const state = createRegisteredMission(id, fault);
    const history = [createSnapshot(state)];
    set({ missionState: state, history, branches: [], trainingMode: true, autoRunning: false,
      availableActions: getAvailableActions(state), selectedModuleId: id === RED_STORM_ID ? 'water-recycler' : 'life-support',
      selectedComponentId: null, lastFeedback: null, viewMode: 'colony', activeFixtureKey: 'initial', saveRecoveryMessage: null });
    saveSessionToStorage({ missionState: state, history, branches: [], trainingMode: true });
  },
  restoreSession: (id) => {
    const saved = loadSessionFromStorage(id);
    if (!saved || !saved.missionState) { set({ saveRecoveryMessage: typeof window !== 'undefined' && (localStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem(LEGACY_KEY)) ? 'No compatible saved attempt was found. Choose a mission and launch a fresh attempt; incompatible data is not resumed.' : null }); return false; }
    saveSessionToStorage(saved);
    set({
      missionState: saved.missionState,
      history: saved.history,
      branches: saved.branches || [],
      trainingMode: saved.trainingMode ?? true,
      availableActions: getAvailableActions(saved.missionState),
      activeFixtureKey: 'saved', autoRunning: false, viewMode: 'colony', lastFeedback: null, saveRecoveryMessage: null,
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
      clearSessionFromStorage(missionState.scenarioId as MissionId);
      const resetState = missionState.emergency ? createRegisteredMission(missionState.scenarioId as MissionId, missionState.emergency.fault) : (get().trainingMode ? createTrainingMission : createInitialMission)(missionState.config ?? RED_STORM_CONFIG);
      resetState.missionVersion = getMission(missionState.scenarioId).version;
      const snap = createSnapshot(resetState, action);
      saveSessionToStorage({missionState:resetState,history:[snap],branches:[],trainingMode:get().trainingMode});
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
      if (!Number.isFinite(action.hour) || action.hour < 0 || action.hour > missionState.hour || action.branchFrom !== missionState.branchId) {
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
        lastFeedback: null, viewMode: 'colony', autoRunning: false });
      return { ok: true, state: restoredState };
    }

    // In-world actions
    if (action.type === 'EMERGENCY_ACTION') set({ autoRunning: false });
    let effectiveAction = action;
    if (missionState.emergency && missionState.status === 'running' && (action.type === 'ADVANCE_MINUTES' || action.type === 'ADVANCE_TIME')) {
      const minutes = action.type === 'ADVANCE_MINUTES' ? action.minutes : action.hours * 60;
      if (Number.isSafeInteger(minutes) && minutes > 0) {
        const steps = advanceEmergencySteps(missionState, minutes);
        const alert = steps.find(s=>s.events.slice(missionState.events.length).some(event=>event.severity !== 'info'));
        if (alert) effectiveAction = {type:'ADVANCE_MINUTES', minutes:alert.emergency!.minute-missionState.emergency.minute};
      }
    }
    const transition = recordMissionAction(missionState, history, effectiveAction);
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
      // Keep the latest snapshot in step with that state: saved sessions must end on the live state to be restorable.
      const logged = result.state !== missionState;
      const syncedHistory = logged && history.length
        ? [...history.slice(0, -1), { ...history[history.length - 1], state: structuredClone(result.state) }]
        : history;
      if (logged) saveSessionToStorage({ missionState: result.state, history: syncedHistory, branches: get().branches, trainingMode: get().trainingMode });
      set({ lastFeedback: result.feedback ?? { kind: 'rejected', title: 'Not possible', body: result.reason },
        ...(logged ? { missionState: result.state, history: syncedHistory } : {}) });
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
