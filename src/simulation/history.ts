import type { MissionBranch, MissionSnapshot, MissionState, MissionAction, ActionResult } from './types';
import { advanceMissionSteps, applyMissionAction } from './engine';
import { isTrainingAction, validateAction } from './actions';

/** timestamp is a logical event sequence, never a wall clock. */
export function createSnapshot(state: MissionState, actionTaken?: MissionAction): MissionSnapshot {
  // Training actions can happen without new events, so the training log keeps snapshot ids unique.
  const sequence = state.events.length + (state.training?.log.length ?? 0);
  return {
    snapshotId: `snap:${state.branchId}:h${state.hour}:e${sequence}`,
    branchId: state.branchId, hour: state.hour, state: structuredClone(state),
    actionTaken: actionTaken ? structuredClone(actionTaken) : undefined, timestamp: sequence,
  };
}

export function forkMission(history: MissionSnapshot[], snapshotId: string, branchId?: string): MissionBranch {
  const index = history.findIndex(s => s.snapshotId === snapshotId);
  if (index < 0) throw new RangeError('Snapshot not found. Select an existing decision point.');
  const target = history[index];
  const newId = branchId ?? `${target.branchId}:fork:${index}`;
  if (history.some(s => s.branchId === newId)) throw new RangeError('Branch ID must be independent of its source.');
  // Preserve the shared prefix byte-for-byte, then add a branch-owned boundary.
  const prefix = structuredClone(history.slice(0, index + 1));
  const state = structuredClone(target.state);
  state.branchId = newId;
  prefix.push(createSnapshot(state));
  return { branchId: newId, parentBranchId: target.state.branchId, forkHour: target.hour,
    snapshots: prefix, finalStatus: state.status };
}

/** Session helper used by both the store and headless clients; physical math stays in engine.ts. */
export function recordMissionAction(state: MissionState, history: MissionSnapshot[], action: MissionAction):
  { result: ActionResult; history: MissionSnapshot[] } {
  // Training actions validate themselves and log rejections as learning evidence.
  const validation = isTrainingAction(action) ? { valid: true as const, reason: undefined } : validateAction(state, action);
  if (!validation.valid) return { result: { ok: false, reason: validation.reason ?? 'Invalid action.', state }, history };
  if (action.type === 'ADVANCE_TIME') {
    const steps = advanceMissionSteps(state, action.hours);
    return { result: { ok: true, state: steps.at(-1) ?? structuredClone(state) },
      history: [...history, ...steps.map(s => createSnapshot(s, { type: 'ADVANCE_TIME', hours: 1 }))] };
  }
  const result = applyMissionAction(state, action);
  if (!result.ok) return { result, history };
  return { result, history: action.type === 'RESET_MISSION' ? [createSnapshot(result.state, action)]
    : [...history, createSnapshot(result.state, action)] };
}
