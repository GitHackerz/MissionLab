import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createTrainingMission, applyMissionAction, advanceMission } from '@/simulation/engine';
import { createSnapshot } from '@/simulation/history';
import { FAULT_LABEL } from '@/simulation/training/recycler';
import type { RecyclerFaultKind } from '@/simulation/training/types';
import { useMissionStore } from '@/state/missionStore';
import { RecyclerWorkbench } from '../ui/tasks/RecyclerWorkbench';
import { MissionBriefing } from '../ui/MissionBriefing';
import { getObjectives } from '../objectives';
import { vi } from 'vitest';

function setup(fault: RecyclerFaultKind) {
  const state = createTrainingMission();
  state.training!.recycler.faultKind = fault;
  const planned = applyMissionAction(state, { type: 'APPLY_POWER_PLAN', loads: { greenhouse: false, 'research-lab': false } });
  const mission = advanceMission(planned.state, 30);
  act(() => useMissionStore.setState({ missionState: mission, trainingMode: true, history: [createSnapshot(mission)], branches: [], selectedComponentId: null, lastFeedback: null }));
  render(<RecyclerWorkbench />);
}
function diagnose(kind: RecyclerFaultKind) {
  fireEvent.click(screen.getByRole('button', { name: 'Run full diagnostic cycle (30 min)' }));
  const record = screen.getByRole('button', { name: 'Record evidence-backed diagnosis' });
  expect((record as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: FAULT_LABEL[kind] }));
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  fireEvent.click(record);
}
function repair() {
  for (let i = 0; i < 25; i++) {
    const action = screen.queryByTestId('current-engine-action');
    if (!action) break;
    fireEvent.click(action);
  }
}
afterEach(cleanup);
describe('progressive recycler workbench', () => {
  for (const fault of ['pump-seized', 'filter-clogged', 'sensor-drift'] as const) it(`completes ${fault} through visible, validated actions`, () => {
    setup(fault);
    expect(screen.queryByText('Stop recycler')).toBeNull();
    diagnose(fault);
    expect(screen.getByRole('region', { name: 'Intervention plan' })).toBeTruthy();
    repair();
    expect(useMissionStore.getState().missionState.training!.recycler.procedure.verification?.passed).toBe(true);
    expect(screen.getByText('Water recovery restored')).toBeTruthy();
    expect(screen.getByText(/1 spare part taken/)).toBeTruthy();
    expect(getObjectives(useMissionStore.getState().missionState).find(o => o.id === 'repair')?.status).toBe('completed');
  });
  it('does not repair a filter fault with a pump, and supports a second evidence-based intervention', () => {
    setup('filter-clogged'); diagnose('pump-seized'); repair();
    expect(useMissionStore.getState().missionState.training!.recycler.procedure.verification?.passed).toBe(false);
    expect(screen.getByText('The startup test did not pass')).toBeTruthy();
    expect(useMissionStore.getState().missionState.resources.sparePumps).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Review evidence and diagnosis' }));
    fireEvent.click(screen.getByRole('radio', { name: FAULT_LABEL['filter-clogged'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Record evidence-backed diagnosis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Begin another safe intervention' }));
    repair();
    expect(useMissionStore.getState().missionState.training!.recycler.procedure.verification?.passed).toBe(true);
    expect(useMissionStore.getState().missionState.training!.inventory.filterCartridges).toBe(0);
  });
  it('retests a repaired unit after restoring power without consuming another spare', () => {
    setup('pump-seized'); diagnose('pump-seized');
    for (let i = 0; i < 25; i++) {
      const action = screen.getByTestId('current-engine-action');
      if (action.textContent?.includes('Run startup test')) break;
      fireEvent.click(action);
    }
    expect(useMissionStore.getState().missionState.modules['water-recycler'].status).toBe('repairing');
    act(() => useMissionStore.getState().applyAction({ type: 'APPLY_POWER_PLAN', loads: { 'water-recycler': false } }));
    fireEvent.click(screen.getByTestId('current-engine-action'));
    expect(useMissionStore.getState().missionState.training!.recycler.procedure.verification?.passed).toBe(false);
    const spares = useMissionStore.getState().missionState.resources.sparePumps;
    act(() => useMissionStore.getState().applyAction({ type: 'APPLY_POWER_PLAN', loads: { 'water-recycler': true } }));
    expect(useMissionStore.getState().missionState.modules['water-recycler'].status).toBe('warning');
    fireEvent.click(screen.getByRole('button', { name: 'Prepare verification-only retest' }));
    fireEvent.click(screen.getByTestId('current-engine-action'));
    expect(useMissionStore.getState().missionState.training!.recycler.procedure.verification?.passed).toBe(true);
    expect(useMissionStore.getState().missionState.resources.sparePumps).toBe(spares);
  });
  it('reopens the same engine step after unmount, without replaying or resetting the procedure', () => {
    setup('pump-seized'); diagnose('pump-seized');
    fireEvent.click(screen.getByTestId('current-engine-action'));
    fireEvent.click(screen.getByTestId('current-engine-action'));
    const before = structuredClone(useMissionStore.getState().missionState);
    cleanup(); render(<RecyclerWorkbench />);
    expect(screen.getByTestId('current-engine-action').textContent).toContain('Stop recycler');
    expect(useMissionStore.getState().missionState).toEqual(before);
  });
});
describe('training entry', () => {
  it('exposes only the available mission, explains guidance, and requires an explicit begin action', () => {
    const begin = vi.fn(); render(<MissionBriefing onStart={begin} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Training' }));
    expect(screen.getByText(/Not playable yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'engineer' }));
    fireEvent.click(screen.getByRole('button', { name: 'View briefing' }));
    expect(begin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Begin Mission' }));
    expect(begin).toHaveBeenCalledWith('engineer');
  });
});
