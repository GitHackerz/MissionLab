import { create } from 'zustand';
import type {
  ActionResult,
  AvailableAction,
  MissionAction,
  MissionSnapshot,
  MissionBranch,
  MissionState,
  ModuleId,
} from '@/simulation/types';
import {
  createInitialMission,
  getAvailableActions,
} from '@/simulation/engine';
import { createSnapshot, forkMission, recordMissionAction } from '@/simulation/history';
import { FIXTURES } from '@/simulation/fixtures';
import { RED_STORM_CONFIG } from '@/simulation/config';

export interface MissionStore {
  // State
  missionState: MissionState;
  selectedModuleId: ModuleId | null;
  availableActions: AvailableAction[];
  history: MissionSnapshot[];
  branches: MissionBranch[];
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
  branches: [],
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
        branches: [],
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
      set({ missionState: restoredState, history: branch.snapshots,
        branches: [...branches, original], availableActions: getAvailableActions(restoredState) });
      return { ok: true, state: restoredState };
    }

    // In-world actions
    const transition = recordMissionAction(missionState, history, action);
    if (transition.result.ok) {
      set({ missionState: transition.result.state,
        availableActions: getAvailableActions(transition.result.state), history: transition.history });
    }
    return transition.result;
  },

  advanceTime: (hours: number) => {
    get().applyAction({ type: 'ADVANCE_TIME', hours });
  },

  loadFixture: (fixtureKey: string) => {
    if (fixtureKey === 'initial') { get().resetMission(); return; }
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
