import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useGameInput } from '../input/useGameInput';
import { useExploreStore } from '../store';
import { useMissionStore } from '@/state/missionStore';
import HabitatExplorer from '../ui/HabitatExplorer';

function Harness({ move, interact, handlers }: { move: boolean; interact: boolean; handlers: { onInteract: () => void; onEscape: () => void; onObjectives: () => void } }) {
  const keys = useGameInput(move, interact, handlers);
  return <input data-testid="field" onChange={() => {}} data-up={String(keys.current.up)} />;
}

describe('game input: movement keys', () => {
  afterEach(cleanup);
  it('tracks WASD/arrows, clears on window blur and on disable (no stuck keys)', () => {
    let keys!: ReturnType<typeof useGameInput>;
    const noop = { onInteract: () => {}, onEscape: () => {}, onObjectives: () => {} };
    function Probe({ on }: { on: boolean }) {
      keys = useGameInput(on, on, noop);
      return null;
    }
    const { rerender } = render(<Probe on />);
    fireEvent.keyDown(window, { code: 'KeyW' });
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    fireEvent.keyDown(window, { code: 'ShiftLeft' });
    expect([keys.current.up, keys.current.right, keys.current.sprint]).toEqual([true, true, true]);
    fireEvent.blur(window);
    expect(Object.values(keys.current).some(Boolean)).toBe(false);
    fireEvent.keyDown(window, { code: 'KeyA' });
    expect(keys.current.left).toBe(true);
    rerender(<Probe on={false} />); // a task opens: movement is released
    expect(keys.current.left).toBe(false);
    fireEvent.keyDown(window, { code: 'KeyA' });
    expect(keys.current.left).toBe(false); // and ignored while the task is open
  });
});

describe('game input', () => {
  const h = () => ({ onInteract: vi.fn(), onEscape: vi.fn(), onObjectives: vi.fn() });
  afterEach(cleanup);

  it('fires interact once per press and ignores key repeat', () => {
    const handlers = h();
    render(<Harness move interact handlers={handlers} />);
    fireEvent.keyDown(window, { code: 'KeyE' });
    fireEvent.keyDown(window, { code: 'KeyE', repeat: true });
    fireEvent.keyDown(window, { code: 'KeyE', repeat: true });
    expect(handlers.onInteract).toHaveBeenCalledTimes(1);
  });

  it('does nothing for E when no target is in range or while a task is open', () => {
    const handlers = h();
    render(<Harness move interact={false} handlers={handlers} />);
    fireEvent.keyDown(window, { code: 'KeyE' });
    expect(handlers.onInteract).not.toHaveBeenCalled();
  });

  it('ignores keys while typing in a field', () => {
    const handlers = h();
    render(<Harness move interact handlers={handlers} />);
    fireEvent.keyDown(screen.getByTestId('field'), { code: 'KeyE' });
    expect(handlers.onInteract).not.toHaveBeenCalled();
  });

  it('routes Escape and Tab, and removes its listeners on unmount', () => {
    const handlers = h();
    const { unmount } = render(<Harness move interact handlers={handlers} />);
    fireEvent.keyDown(window, { code: 'Escape' });
    fireEvent.keyDown(window, { code: 'Tab' });
    expect(handlers.onEscape).toHaveBeenCalledTimes(1);
    expect(handlers.onObjectives).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.keyDown(window, { code: 'Escape' });
    fireEvent.keyDown(window, { code: 'KeyE' });
    expect(handlers.onEscape).toHaveBeenCalledTimes(1);
    expect(handlers.onInteract).not.toHaveBeenCalled();
  });
});

describe('habitat explorer without WebGL', () => {
  beforeAll(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });
  beforeEach(() => {
    cleanup();
    act(() => {
      useMissionStore.getState().loadFixture('demo-fault');
      useExploreStore.getState().enterHabitat();
    });
  });

  it('offers every activity as a button and opens a focused task', async () => {
    render(<HabitatExplorer />);
    expect(await screen.findByText('3D habitat unavailable')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Water Recycler' }));
    const dialog = await screen.findByRole('dialog', { name: 'Water Recycler' });
    expect(dialog).toBeTruthy();
    expect(useExploreStore.getState().mode).toBe('task');
    expect(screen.getByText(/Water recovery has dropped below the expected range/)).toBeTruthy();
  });

  it('runs a real diagnostic through the task and keeps progress after closing and reopening', async () => {
    render(<HabitatExplorer />);
    await screen.findByText('3D habitat unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Water Recycler' }));
    fireEvent.click(await screen.findByRole('button', { name: /Run full diagnostic cycle/ }));
    expect(useMissionStore.getState().missionState.training!.evidence).toHaveLength(1);
    const hour = useMissionStore.getState().missionState.hour;

    fireEvent.keyDown(window, { code: 'Escape' }); // close the task (without WebGL the transition completes at once)
    expect(useExploreStore.getState().mode).toBe('exploration');
    expect(useExploreStore.getState().activeTaskId).toBeNull();
    expect(useMissionStore.getState().missionState.training!.evidence).toHaveLength(1); // nothing reset
    expect(useMissionStore.getState().missionState.hour).toBe(hour); // navigation never advances mission time

    fireEvent.click(screen.getByRole('button', { name: 'Water Recycler' }));
    expect(await screen.findAllByText(/Pump speed/)).not.toHaveLength(0); // evidence still in the notebook
  });

  it('opens the power board and applies a plan through the engine', async () => {
    render(<HabitatExplorer />);
    await screen.findByText('3D habitat unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Power Distribution Board' }));
    await screen.findByRole('dialog', { name: 'Power Distribution Board' });
    const before = useMissionStore.getState().missionState.modules.greenhouse.enabled;
    fireEvent.click(screen.getByLabelText(/Greenhouse lighting/));
    fireEvent.click(screen.getByRole('button', { name: 'Apply this plan' }));
    expect(useMissionStore.getState().missionState.modules.greenhouse.enabled).toBe(!before);
  });

  it('every other interactable opens its own task surface', async () => {
    for (const [label, title] of [['Mission Console', 'Mission Console'], ['Greenhouse Workstation', 'Greenhouse Workstation'], ['Crew Habitat Terminal', 'Crew Habitat Terminal'], ['Air Revitalization Unit', 'Air Revitalization Unit']]) {
      cleanup();
      act(() => useExploreStore.getState().enterHabitat());
      render(<HabitatExplorer />);
      await screen.findByText('3D habitat unavailable');
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(await screen.findByRole('dialog', { name: title })).toBeTruthy();
    }
  });
});
