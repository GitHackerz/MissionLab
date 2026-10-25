import { describe, expect, it } from 'vitest';
import { createTrainingMission, applyMissionAction, advanceMission } from '@/simulation/engine';
import { getRecyclerOperation, readRecycler } from '@/simulation/training/recycler';
import { RED_STORM_CONFIG } from '@/simulation/config';
import { getRoomPower, roomEquipmentActive } from '../world/power';
import { useMissionStore } from '@/state/missionStore';
import { createSnapshot } from '@/simulation/history';
import { modulePowerFraction } from '@/features/habitat-3d/utils/visualState';

const plan = (s: ReturnType<typeof createTrainingMission>, loads: Parameters<typeof applyMissionAction>[1] & { type: 'APPLY_POWER_PLAN' }) => {
  const result = applyMissionAction(s, loads);
  if (!result.ok) throw Error(result.reason);
  return result.state;
};
describe('allocated habitat circuits', () => {
  it('sheds only the chosen rooms, retains supplied safety lighting and restores main lighting', () => {
    const initial = createTrainingMission();
    const shed = plan(initial, { type: 'APPLY_POWER_PLAN', loads: { greenhouse: false, 'research-lab': false } });
    expect(getRoomPower(shed, 'greenhouse')).toMatchObject({ main: 0, safety: 1, mode: 'emergency' });
    expect(getRoomPower(shed, 'mission-control').mode).toBe('emergency');
    expect(getRoomPower(shed, 'life-support').main).toBe(1);
    expect(getRoomPower(shed, 'power').main).toBe(1);
    const restored = plan(shed, { type: 'APPLY_POWER_PLAN', loads: { greenhouse: true } });
    expect(getRoomPower(restored, 'greenhouse')).toMatchObject({ main: 1, safety: 0, mode: 'normal' });
    expect(initial.modules.greenhouse.enabled).toBe(true);
  });
  it('has no emergency lights when the essential habitat circuit has no supply', () => {
    const state = createTrainingMission({ ...RED_STORM_CONFIG, stormSolarGenerationKw: 0, initialResources: { ...RED_STORM_CONFIG.initialResources, batteryKwh: 0 } });
    for (const room of ['hub', 'mission-control', 'power', 'life-support', 'greenhouse'] as const) expect(getRoomPower(state, room)).toMatchObject({ main: 0, safety: 0, mode: 'unpowered' });
    expect(getRecyclerOperation(state)).toMatchObject({ running: false, reason: 'blackout', recoveryLph: 0 });
    expect(readRecycler(state)['pump-rpm']).toBe(0);
    expect(readRecycler(state)['pump-power-kw']).toBe(0);
  });
  it('shows limited power without claiming fully powered equipment or food growth', () => {
    const state = createTrainingMission({ ...RED_STORM_CONFIG, stormSolarGenerationKw: 5, initialResources: { ...RED_STORM_CONFIG.initialResources, batteryKwh: 0 } });
    expect(getRoomPower(state, 'greenhouse').mode).toBe('limited');
    expect(modulePowerFraction(state.modules.greenhouse)).toBeGreaterThan(0);
    expect(modulePowerFraction(state.modules.greenhouse)).toBeLessThan(1);
    const later = advanceMission(state, 1);
    expect(later.training!.cropGrowthHours).toBe(0);
  });
  it('stops recovery on recycler power loss, and only elapsed lit hours grow crops', () => {
    const initial = createTrainingMission();
    const shed = plan(initial, { type: 'APPLY_POWER_PLAN', loads: { greenhouse: false, 'water-recycler': false } });
    expect(getRecyclerOperation(shed)).toMatchObject({ running: false, recoveryLph: 0 });
    const later = advanceMission(shed, 1);
    expect(later.training!.cropGrowthHours).toBe(0);
    expect(later.resources.foodRations).toBeLessThan(initial.resources.foodRations);
    const lit = advanceMission(initial, 1);
    expect(lit.training!.cropGrowthHours).toBe(1);
    expect(lit.resources.foodRations).toBeGreaterThan(later.resources.foodRations);
  });
  it('silences shed-room machinery without silencing an independently powered air unit', () => {
    const state = plan(createTrainingMission(), { type: 'APPLY_POWER_PLAN', loads: { greenhouse: false, 'water-recycler': false } });
    expect(roomEquipmentActive(state, 'greenhouse')).toBe(false);
    expect(roomEquipmentActive(state, 'life-support')).toBe(true);
    const silent = plan(state, { type: 'APPLY_POWER_PLAN', loads: { 'life-support': false } });
    expect(roomEquipmentActive(silent, 'life-support')).toBe(false);
  });
  it('restores the real allocated circuit through mission rewind and preserves the abandoned branch', () => {
    const initial = createTrainingMission();
    const snapshot = createSnapshot(initial);
    useMissionStore.setState({ missionState: initial, history: [snapshot], branches: [], trainingMode: true });
    useMissionStore.getState().applyAction({ type: 'APPLY_POWER_PLAN', loads: { greenhouse: false } });
    expect(getRoomPower(useMissionStore.getState().missionState, 'greenhouse').mode).toBe('emergency');
    useMissionStore.getState().applyAction({ type: 'REWIND_TO', hour: 0, branchFrom: initial.branchId, snapshotId: snapshot.snapshotId });
    expect(getRoomPower(useMissionStore.getState().missionState, 'greenhouse').mode).toBe('normal');
    expect(useMissionStore.getState().branches).toHaveLength(1);
    expect(getRoomPower(useMissionStore.getState().branches[0].snapshots.at(-1)!.state, 'greenhouse').mode).toBe('emergency');
  });
});
