import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MissionReview } from '../../features/debrief/components/MissionReview';
import { useMissionStore } from '../../state/missionStore';

afterEach(cleanup);
it('exposes recorded failure evidence and an actionable rewind to an independent branch', () => {
  useMissionStore.getState().resetMission();
  useMissionStore.getState().advanceTime(72);
  render(<MissionReview />);
  expect(screen.getByText('Insufficient electrical supply for essential systems.')).toBeDefined();
  expect(screen.getAllByText(/unserved/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByText('Create alternative branch'));
  expect(useMissionStore.getState().missionState.hour).toBe(0);
  expect(useMissionStore.getState().missionState.branchId).toBe('branch-1');
  expect(useMissionStore.getState().branches[0].finalStatus).toBe('failed');
  expect(screen.getByRole('status').textContent).toContain('Independent branch created');
  expect(screen.getByText('Comparison with main-branch')).toBeDefined();
});

it('renders real last-interval water and oxygen telemetry rather than legacy fixed rates', async () => {
  const { ResourceHud } = await import('../../features/mission-ui/components/ResourceHud');
  useMissionStore.getState().resetMission();
  useMissionStore.getState().advanceTime(1);
  render(<ResourceHud />);
  expect(screen.getByText('Last hour: -0.26 L/h')).toBeDefined();
  expect(screen.getByText('Last output: 0.16 kg/h')).toBeDefined();
});
