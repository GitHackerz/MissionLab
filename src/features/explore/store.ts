import { create } from 'zustand';
import type { RoomId, TaskId } from './world/layout';

/**
 * Navigation and task-lifecycle state only. Mission truth (resources, equipment,
 * procedure progress) lives in the mission store / engine. Character transforms live
 * in refs and are never stored here, so walking never re-renders the app.
 */
export type GameplayMode = 'exploration' | 'transitioning' | 'task' | 'debrief';
export type WorldMode = 'colony' | 'habitat';

export interface ExploreState {
  worldMode: WorldMode;
  mode: GameplayMode;
  nearbyId: string | null;
  room: RoomId | null;
  activeTaskId: TaskId | null;
  activeInteractableId: string | null;
  /** True while the camera is moving into or out of a task. */
  transitionDirection: 'in' | 'out' | null;
  showObjectives: boolean;
  /** Last known player pose, so re-entering the habitat resumes in place. */
  lastPose: { x: number; z: number; yaw: number } | null;

  enterHabitat: () => void;
  exitHabitat: () => void;
  setNearby: (id: string | null) => void;
  setRoom: (room: RoomId | null) => void;
  beginTask: (interactableId: string, taskId: TaskId) => boolean;
  taskVisible: () => void;
  endTask: () => void;
  finishTransition: () => void;
  openDebrief: () => void;
  closeDebrief: () => void;
  toggleObjectives: () => void;
  rememberPose: (pose: { x: number; z: number; yaw: number }) => void;
}

const initial = {
  worldMode: 'colony' as WorldMode,
  mode: 'exploration' as GameplayMode,
  nearbyId: null as string | null,
  room: null as RoomId | null,
  activeTaskId: null as TaskId | null,
  activeInteractableId: null as string | null,
  transitionDirection: null as 'in' | 'out' | null,
  showObjectives: false,
  lastPose: null as ExploreState['lastPose'],
};

export const useExploreStore = create<ExploreState>((set, get) => ({
  ...initial,

  enterHabitat: () => set({ ...initial, worldMode: 'habitat', lastPose: get().lastPose }),
  exitHabitat: () => set({ worldMode: 'colony', mode: 'exploration', activeTaskId: null, activeInteractableId: null, transitionDirection: null, nearbyId: null, showObjectives: false }),

  setNearby: (id) => {
    if (get().nearbyId !== id) set({ nearbyId: id });
  },

  setRoom: (room) => {
    if (get().room !== room) set({ room });
  },

  /** Returns false (and does nothing) unless exploration is idle, so a task can never start twice. */
  beginTask: (interactableId, taskId) => {
    if (get().mode !== 'exploration' || get().worldMode !== 'habitat') return false;
    set({ mode: 'transitioning', transitionDirection: 'in', activeTaskId: taskId, activeInteractableId: interactableId });
    return true;
  },

  taskVisible: () => {
    if (get().mode === 'transitioning' && get().transitionDirection === 'in') set({ mode: 'task', transitionDirection: null });
  },

  /** Safe from any state: always ends with exploration controls restored after the camera returns. */
  endTask: () => {
    const { mode } = get();
    if (mode === 'task' || (mode === 'transitioning' && get().transitionDirection === 'in')) {
      set({ mode: 'transitioning', transitionDirection: 'out', activeTaskId: null });
    }
  },

  finishTransition: () => {
    if (get().mode === 'transitioning' && get().transitionDirection === 'out') {
      set({ mode: 'exploration', transitionDirection: null, activeInteractableId: null });
    } else if (get().mode === 'transitioning' && get().transitionDirection === 'in') {
      set({ mode: 'task', transitionDirection: null });
    }
  },

  openDebrief: () => {
    if (get().mode === 'exploration') set({ mode: 'debrief' });
  },
  closeDebrief: () => {
    if (get().mode === 'debrief') set({ mode: 'exploration' });
  },
  toggleObjectives: () => set((s) => (s.mode === 'exploration' ? { showObjectives: !s.showObjectives } : s)),
  rememberPose: (pose) => set({ lastPose: pose }),
}));
