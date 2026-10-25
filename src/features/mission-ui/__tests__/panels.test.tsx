import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useMissionStore } from '@/state/missionStore';
import { TrainingPanel } from '../components/TrainingPanel';
import { PowerPlanner } from '../components/PowerPlanner';
import { MissionDebrief } from '../components/MissionDebrief';

const store = () => useMissionStore.getState();

beforeEach(() => {
  cleanup();
  act(() => {
    store().loadFixture('demo-fault');
  });
});

describe('training UI integration', () => {
  it('shows the current objective from engine state and collects evidence into the notebook', () => {
    render(<TrainingPanel />);
    expect(screen.getByText(/Water recovery has dropped below the expected range/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Run full diagnostic cycle/ }));
    expect(store().missionState.training!.evidence).toHaveLength(1);
    expect(screen.getAllByText(/Pump speed/).length).toBeGreaterThan(0);
  });

  it('records a diagnosis only with selected evidence and surfaces engine rejections', () => {
    render(<TrainingPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Run full diagnostic cycle/ }));
    const record = screen.getByRole('button', { name: /Tick the evidence/ });
    expect((record as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Record diagnosis/ }));
    expect(store().missionState.training!.hypotheses).toHaveLength(1);

    // Skipping the isolation checklist is refused with an explanation.
    fireEvent.click(screen.getByRole('button', { name: 'Stop unit' }));
    expect(store().lastFeedback?.kind).toBe('rejected');
    expect(store().lastFeedback?.title).toMatch(/isolation/i);
    expect(store().missionState.training!.recycler.procedure.maintenanceMode).toBe(false);
  });

  it('keeps resource HUD data in sync: repair spends time and a spare, verified by the engine', () => {
    render(<TrainingPanel />);
    const hourBefore = store().missionState.hour;
    const click = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));
    click(/Run full diagnostic cycle/);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    click(/Record diagnosis/);
    for (const name of ['Read', 'Stop unit', 'Check pump']) click(name);
    fireEvent.click(screen.getAllByRole('button', { name: 'Hatch key' })[0]);
    for (const name of ['Open hatch']) click(name);
    fireEvent.click(screen.getAllByRole('button', { name: 'Retainer driver' })[0]);
    for (const name of ['Release', 'Remove', 'Take spare', 'Inspect']) click(name);
    click(/Rotate/);
    click(/Rotate/);
    for (const name of ['Install', 'Secure', 'Close hatch', 'Restore', 'Run test']) click(name);
    const t = store().missionState.training!;
    expect(t.recycler.procedure.verification?.passed).toBe(true);
    expect(store().missionState.resources.sparePumps).toBe(0);
    expect(store().missionState.hour).toBeGreaterThan(hourBefore);
  });
});

describe('power planner and debrief', () => {
  it('forecast reflects the proposed plan and applying changes the real state', () => {
    act(() => store().resetMission());
    render(<PowerPlanner />);
    expect(screen.getByText(/fails at hour/)).toBeTruthy(); // storm + all loads on
    fireEvent.click(screen.getByLabelText(/Greenhouse lighting/));
    fireEvent.click(screen.getByLabelText(/Research laboratory/));
    expect(screen.getByText(/reaches hour/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apply this plan' }));
    expect(store().missionState.modules.greenhouse.enabled).toBe(false);
    expect(store().missionState.training!.powerPlanAppliedHour).toBe(0);
  });

  it('rewinds to a decision and keeps the abandoned timeline for comparison', () => {
    act(() => store().resetMission());
    act(() => {
      store().applyAction({ type: 'APPLY_POWER_PLAN', loads: { greenhouse: false, 'research-lab': false } });
      store().advanceTime(6);
    });
    render(<MissionDebrief />);
    fireEvent.click(screen.getByRole('button', { name: /Rewind before this/ }));
    expect(store().missionState.hour).toBe(0);
    expect(store().missionState.modules.greenhouse.enabled).toBe(true); // state before the plan decision
    expect(store().abandonedTimelines).toHaveLength(1);
  });
});
