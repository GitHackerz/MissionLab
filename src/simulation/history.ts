import { MissionBranch, MissionSnapshot, MissionState, MissionAction } from './types';

export function createSnapshot(
  state: MissionState,
  actionTaken?: MissionAction
): MissionSnapshot {
  return {
    snapshotId: `snap-${state.branchId}-h${state.hour}-${Date.now()}`,
    branchId: state.branchId,
    hour: state.hour,
    state: JSON.parse(JSON.stringify(state)),
    actionTaken,
    timestamp: Date.now(),
  };
}

export function forkMission(
  history: MissionSnapshot[],
  snapshotId: string
): MissionBranch {
  const index = history.findIndex((s) => s.snapshotId === snapshotId);
  const targetSnap = index >= 0 ? history[index] : history[0];
  const newBranchId = `branch-${targetSnap.hour}-${Date.now().toString(36)}`;

  const forkedSnapshots = history.slice(0, index + 1).map((s) => ({
    ...s,
    branchId: newBranchId,
  }));

  return {
    branchId: newBranchId,
    parentBranchId: targetSnap.branchId,
    forkHour: targetSnap.hour,
    snapshots: forkedSnapshots,
    finalStatus: targetSnap.state.status,
  };
}
