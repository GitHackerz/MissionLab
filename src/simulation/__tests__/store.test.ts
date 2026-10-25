import { beforeEach, describe, expect, it } from 'vitest';
import { useMissionStore } from '../../state/missionStore';
import { compareBranches } from '../debrief';

const store = () => useMissionStore.getState();
beforeEach(() => store().resetMission());

describe('Zustand session integration', () => {
  it('records intermediate hours for both advance entrypoints and preserves rejected state', () => {
    store().advanceTime(6);
    expect(store().history.map(s => s.hour)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    store().applyAction({ type: 'ADVANCE_TIME', hours: 6 });
    expect(store().history.map(s => s.hour)).toEqual(Array.from({ length: 13 }, (_, i) => i));
    const before = store();
    expect(store().applyAction({ type: 'ADVANCE_TIME', hours: NaN }).ok).toBe(false);
    expect(store()).toBe(before);
  });
  it('rewinds a failed mission, preserves original, survives, and compares actual decisions', () => {
    store().advanceTime(72);
    expect(store().missionState.failure?.kind).toBe('power');
    const original = structuredClone(store().history);
    store().rewindTo(0);
    expect(store().missionState.branchId).toBe('branch-1');
    expect(store().branches[0].snapshots).toEqual(original);
    store().applyAction({ type: 'SET_ENABLED', moduleId: 'greenhouse', enabled: false });
    store().applyAction({ type: 'SET_ENABLED', moduleId: 'research-lab', enabled: false });
    store().advanceTime(30);
    store().applyAction({ type: 'REPAIR_WATER_RECYCLER' });
    store().advanceTime(42);
    const s = store();
    expect(s.missionState.status).toBe('success');
    expect(s.branches[0].snapshots).toEqual(original);
    expect(s.missionState.events.filter(e => e.type === 'DUST_STORM_ARRIVAL')).toHaveLength(1);
    expect(s.missionState.events.filter(e => e.type === 'PUMP_MECHANICAL_FAULT')).toHaveLength(1);
    const comparison = compareBranches(s.branches[0], { branchId: s.missionState.branchId,
      forkHour: 0, snapshots: s.history, finalStatus: s.missionState.status });
    expect(comparison.branchA.status).toBe('failed');
    expect(comparison.branchB.status).toBe('success');
    expect(comparison.keyDivergenceFactors.join()).toContain('greenhouse');
    store().rewindTo(30);
    expect(store().missionState.branchId).toBe('branch-2');
    expect(store().branches).toHaveLength(2);
  });
  it('selects exact same-hour decisions, rejects invalid targets and resets history', () => {
    store().applyAction({ type: 'SET_ENABLED', moduleId: 'greenhouse', enabled: false });
    const target = store().history.at(-1)!;
    store().applyAction({ type: 'SET_ENABLED', moduleId: 'research-lab', enabled: false });
    const before = store();
    for (const hour of [NaN, Infinity, -1, .5, 8]) {
      expect(store().applyAction({ type: 'REWIND_TO', hour, branchFrom: 'main-branch' }).ok).toBe(false);
    }
    expect(store()).toBe(before);
    expect(store().applyAction({ type: 'REWIND_TO', hour: 0, branchFrom: 'wrong' }).ok).toBe(false);
    expect(store().applyAction({ type: 'REWIND_TO', hour: 0, branchFrom: 'main-branch', snapshotId: target.snapshotId }).ok).toBe(true);
    expect(store().missionState.modules.greenhouse.enabled).toBe(false);
    expect(store().missionState.modules['research-lab'].enabled).toBe(true);
    store().resetMission();
    expect(store().branches).toEqual([]);
    expect(store().history).toHaveLength(1);
    expect(store().missionState.stormActive).toBe(true);
  });
});
