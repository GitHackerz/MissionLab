import { create } from 'zustand';
import {
  ActionResult,
  AvailableAction,
  MissionAction,
  MissionSnapshot,
  MissionState,
  ModuleId,
  RecyclerComponentId,
  TrainingFeedback,
} from '@/simulation/types';
import {
  advanceMission,
  applyMissionAction,
  createInitialMission,
  getAvailableActions,
} from '@/simulation/engine';
import { createSnapshot } from '@/simulation/history';
import { FIXTURES } from '@/simulation/fixtures';
import { RED_STORM_CONFIG } from '@/simulation/config';

export interface MissionStore {
  // State
  missionState: MissionState;
  selectedModuleId: ModuleId | null;
  availableActions: AvailableAction[];
  history: MissionSnapshot[];
  activeFixtureKey: string;
  /** Latest educational feedback from a training action (accepted or rejected). */
  lastFeedback: TrainingFeedback | null;
  /** 'service' = detailed equipment view of the water recycler in the 3D scene. */
  viewMode: 'colony' | 'service';
  /** Earlier timelines abandoned by a rewind, kept for comparison. */
  abandonedTimelines: MissionSnapshot[][];

  // Actions
  selectedComponentId: RecyclerComponentId | null;
  selectComponent: (id: RecyclerComponentId | null) => void;
  setViewMode: (mode: 'colony' | 'service') => void;
  clearFeedback: () => void;
  rewindToSnapshot: (snapshotId: string) => void;
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
  activeFixtureKey: 'initial',
  lastFeedback: null,
  viewMode: 'colony',
  abandonedTimelines: [],

  selectedComponentId: null,
  selectComponent: (id) => set({ selectedComponentId: id }),
  setViewMode: (mode) => set({ viewMode: mode, ...(mode === 'service' ? { selectedModuleId: 'water-recycler' as const } : {}) }),
  clearFeedback: () => set({ lastFeedback: null }),

  rewindToSnapshot: (snapshotId: string) => {
    const { history, abandonedTimelines } = get();
    const index = history.findIndex((s) => s.snapshotId === snapshotId);
    if (index < 0) return;
    const restored: MissionState = JSON.parse(JSON.stringify(history[index].state));
    set({
      missionState: restored,
      availableActions: getAvailableActions(restored),
      history: history.slice(0, index + 1),
      abandonedTimelines: index < history.length - 1 ? [...abandonedTimelines, history] : abandonedTimelines,
      lastFeedback: null,
      viewMode: 'colony',
    });
  },

  selectModule: (moduleId: ModuleId | null) => {
    set({ selectedModuleId: moduleId });
  },

  applyAction: (action: MissionAction): ActionResult => {
    const { missionState, history } = get();

    // Special case: Session Reset
    if (action.type === 'RESET_MISSION') {
      const resetState = createInitialMission(RED_STORM_CONFIG);
      const snap = createSnapshot(resetState, action);
      set({
        missionState: resetState,
        availableActions: getAvailableActions(resetState),
        history: [snap],
        activeFixtureKey: 'initial',
        lastFeedback: null,
        viewMode: 'colony',
        abandonedTimelines: [],
      });
      return { ok: true, state: resetState };
    }

    // Special case: Session Rewind
    if (action.type === 'REWIND_TO') {
      const targetSnap = history.find((s) => s.hour === action.hour);
      if (!targetSnap) {
        return { ok: false, reason: `Snapshot at hour ${action.hour} not found`, state: missionState };
      }
      const restoredState = JSON.parse(JSON.stringify(targetSnap.state));
      set({
        missionState: restoredState,
        availableActions: getAvailableActions(restoredState),
      });
      return { ok: true, state: restoredState };
    }

    // In-world actions
    const result = applyMissionAction(missionState, action);
    if (result.ok) {
      const newSnap = createSnapshot(result.state, action);
      set({
        missionState: result.state,
        availableActions: getAvailableActions(result.state),
        history: [...history, newSnap],
        lastFeedback: result.feedback ?? null,
      });
    } else {
      // Rejected training actions still return a state with the rejection logged as learning evidence.
      set({
        lastFeedback: result.feedback ?? { kind: 'rejected', title: 'Not possible', body: result.reason },
        ...(result.state !== missionState ? { missionState: result.state } : {}),
      });
    }

    return result;
  },

  advanceTime: (hours: number) => {
    const { missionState, history } = get();
    const nextState = advanceMission(missionState, hours);
    const snap = createSnapshot(nextState, { type: 'ADVANCE_TIME', hours });
    set({
      missionState: nextState,
      availableActions: getAvailableActions(nextState),
      history: [...history, snap],
    });
  },

  loadFixture: (fixtureKey: string) => {
    // Accelerated demo path: the REAL engine, no canned values. Plan applied, then time advanced to the fault.
    if (fixtureKey === 'demo-fault') {
      const planned = applyMissionAction(createInitialMission(RED_STORM_CONFIG), {
        type: 'APPLY_POWER_PLAN',
        loads: { greenhouse: false, 'research-lab': false },
      });
      const demo = advanceMission(planned.state, 30);
      const snap = createSnapshot(demo);
      set({
        missionState: demo,
        availableActions: getAvailableActions(demo),
        history: [snap],
        activeFixtureKey: fixtureKey,
        lastFeedback: null,
        selectedModuleId: 'water-recycler',
        abandonedTimelines: [],
      });
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
      lastFeedback: null,
      abandonedTimelines: [],
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
