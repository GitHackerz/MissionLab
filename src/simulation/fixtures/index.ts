/** Engine-derived integration fixtures. These are real reachable scenario states. */
import { createInitialMission, applyMissionAction, advanceMission } from '../engine';
import type { MissionState } from '../types';

export function conservePower(state = createInitialMission()): MissionState {
  let next = applyMissionAction(state, { type: 'SET_ENABLED', moduleId: 'greenhouse', enabled: false }).state;
  next = applyMissionAction(next, { type: 'SET_ENABLED', moduleId: 'research-lab', enabled: false }).state;
  return next;
}

export function runRedStormPaths() {
  const energy = advanceMission(createInitialMission(), 72);
  const water = advanceMission(conservePower(), 72);
  const fault = advanceMission(conservePower(), 30);
  const repair = applyMissionAction(fault, { type: 'REPAIR_WATER_RECYCLER' });
  if (!repair.ok) throw new Error(repair.reason);
  return { energy, water, success: advanceMission(repair.state, 42) };
}

export const FIXTURE_NORMAL = createInitialMission();
export const FIXTURE_STORM = advanceMission(createInitialMission(), 4);
export const FIXTURE_WATER_RECYCLER_DEGRADED = advanceMission(conservePower(), 30);
export const FIXTURE_CRITICAL_ENERGY = advanceMission(createInitialMission(), 22);
const paths = runRedStormPaths();
export const FIXTURE_SUCCESS = paths.success;
export const FIXTURE_FAILED = paths.energy;
export const FIXTURES: Record<string, MissionState> = {
  normal: FIXTURE_NORMAL, storm: FIXTURE_STORM, 'water-recycler-degraded': FIXTURE_WATER_RECYCLER_DEGRADED,
  'critical-energy': FIXTURE_CRITICAL_ENERGY, success: FIXTURE_SUCCESS, failed: FIXTURE_FAILED,
};
