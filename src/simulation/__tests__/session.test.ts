import { beforeEach, describe, expect, it } from 'vitest';
import { useMissionStore, loadSessionFromStorage } from '@/state/missionStore';
import { getRoomPower } from '@/features/explore/world/power';

// Sessions are stored per mission in one versioned envelope (see missionStore / simulation/missions/saves).
const KEY = 'missionlab_sessions_v2';
const envelope = (session: unknown) =>
  JSON.stringify({ formatVersion: 2, activeMissionId: 'mission-01-red-storm', sessions: { 'mission-01-red-storm': { missionVersion: 1, session } } });

beforeEach(() => {
  localStorage.clear();
  useMissionStore.getState().enableTraining();
  useMissionStore.getState().resetMission();
});
describe('valid local mission continuation', () => {
  it('restores actual state, allocated circuits and history after a fresh training initialization', () => {
    const store = useMissionStore.getState();
    store.applyAction({ type: 'APPLY_POWER_PLAN', loads: { greenhouse: false, 'research-lab': false } });
    store.advanceTime(6);
    const before = structuredClone(useMissionStore.getState().missionState);
    const saved = localStorage.getItem(KEY)!;
    store.resetMission();
    localStorage.setItem(KEY, saved);
    expect(store.restoreSession()).toBe(true);
    expect(useMissionStore.getState().missionState).toEqual(before);
    expect(getRoomPower(useMissionStore.getState().missionState, 'greenhouse').mode).toBe('emergency');
    expect(useMissionStore.getState().history.length).toBeGreaterThan(1);
  });
  it('ignores corrupt or stale records without replacing the live mission', () => {
    const initial = useMissionStore.getState().missionState;
    for (const raw of ['invalid json', envelope({ missionState: {}, history: [] }), envelope({ missionState: null, history: [{}] })]) {
      localStorage.setItem(KEY, raw);
      expect(loadSessionFromStorage()).toBeNull();
      expect(useMissionStore.getState().restoreSession()).toBe(false);
      expect(useMissionStore.getState().missionState).toBe(initial);
    }
  });
  it('persists rejected-action learning records as well as accepted decisions', () => {
    useMissionStore.getState().applyAction({ type: 'TRAINING_STEP', step: { step: 'OPEN_HATCH' } });
    expect(loadSessionFromStorage()?.missionState.training!.log.at(-1)?.ok).toBe(false);
    expect(useMissionStore.getState().missionState.training!.recycler.procedure.hatchOpen).toBe(false);
  });
});
