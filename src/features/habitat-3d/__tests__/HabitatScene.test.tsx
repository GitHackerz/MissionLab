import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FIXTURES } from '@/simulation/fixtures';
import HabitatScene from '../HabitatScene';

// jsdom has no WebGL, which exercises the documented fallback path.
describe('HabitatScene without WebGL', () => {
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('offers an accessible module selector that emits selection callbacks', async () => {
    const onSelect = vi.fn();
    render(<HabitatScene missionState={FIXTURES.storm} selectedModuleId="solar-array" onSelectModule={onSelect} />);
    await waitFor(() => expect(screen.getByText('3D view unavailable')).toBeTruthy());

    expect(screen.getAllByRole('button')).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: /Water Recycler/ }));
    expect(onSelect).toHaveBeenCalledWith('water-recycler');
    expect(screen.getByRole('button', { name: /Solar Array/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('states status in text, not only colour', async () => {
    render(<HabitatScene missionState={FIXTURES['water-recycler-degraded']} selectedModuleId={null} onSelectModule={() => {}} />);
    await waitFor(() => screen.getByText('3D view unavailable'));
    expect(screen.getByRole('button', { name: /Water Recycler.*Degraded/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Research Lab.*Offline/ })).toBeTruthy();
  });
});
