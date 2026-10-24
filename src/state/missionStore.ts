import { create } from 'zustand';
import {
  ActionResult,
  AvailableAction,
  MissionAction,
  MissionSnapshot,
  MissionState,
  ModuleId,
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

  // Actions
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
