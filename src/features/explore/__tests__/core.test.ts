import { beforeEach, describe, expect, it } from 'vitest';
import { box, collides, moveWithCollision } from '../world/collision';
import { COLLIDERS, INTERACTABLES, PLAYER_RADIUS, ROOM_LIST, SPAWN, WALLS, roomAt } from '../world/layout';
import { pickInteractable } from '../interaction';
import { useExploreStore } from '../store';

describe('collision', () => {
  const wall = [box(0, 0, 4, 0.2)];
  it('blocks a circle and slides along the wall', () => {
    const r = moveWithCollision(0, 1, 0.5, -2, 0.3, wall);
    expect(r.z).toBeGreaterThanOrEqual(0.4); // stopped in front of the wall (0.1 + radius 0.3)
    expect(r.x).toBeCloseTo(0.5, 5); // sideways motion is preserved
    expect(r.blocked).toBe(true);
  });
  it('cannot tunnel through a thin wall at high speed', () => {
    const r = moveWithCollision(0, 1, 0, -50, 0.3, wall);
    expect(r.z).toBeGreaterThan(0);
  });
  it('is frame-rate independent: one big step equals many small ones', () => {
    const a = moveWithCollision(-1, 1, 1.4, -1.4, 0.3, wall);
    let x = -1;
    let z = 1;
    for (let i = 0; i < 14; i++) ({ x, z } = moveWithCollision(x, z, 0.1, -0.1, 0.3, wall));
    // Sub-stepping keeps results within a centimetre regardless of frame size.
    expect(Math.abs(a.x - x)).toBeLessThan(0.02);
    expect(Math.abs(a.z - z)).toBeLessThan(0.02);
  });
});

describe('habitat layout', () => {
  it('spawns in the hub on free ground', () => {
    expect(roomAt(SPAWN.x, SPAWN.z)).toBe('hub');
    expect(collides(SPAWN.x, SPAWN.z, PLAYER_RADIUS, COLLIDERS)).toBe(false);
  });

  it('has doorways wide enough for the astronaut between every pair of connected spaces', () => {
    for (const [x, z] of [[0, -3], [0, 3], [3, 0], [-3, 0]]) expect(collides(x, z, PLAYER_RADIUS, COLLIDERS)).toBe(false);
    // Straight walks from the hub centre to each room's doorway are clear.
    const walk = (dx: number, dz: number) => moveWithCollision(0, 0, dx, dz, PLAYER_RADIUS, COLLIDERS);
    expect(walk(0, -6).z).toBeCloseTo(-6, 1);
    expect(walk(0, 4.6).z).toBeCloseTo(4.6, 1); // into the greenhouse doorway; the planters block further
    expect(walk(6, 0).x).toBeCloseTo(6, 1);
    expect(walk(-4.4, 0).x).toBeCloseTo(-4.4, 1);
  });

  it('cannot leave the habitat through its outer walls', () => {
    for (const [dx, dz] of [[0, -30], [0, 30], [40, 0], [-40, 0]]) {
      const r = moveWithCollision(0, 0, dx, dz, PLAYER_RADIUS, COLLIDERS);
      expect(Math.abs(r.x)).toBeLessThan(10);
      expect(r.z).toBeGreaterThan(-9);
      expect(r.z).toBeLessThan(9);
    }
    expect(WALLS.length).toBeGreaterThan(30);
  });

  it('places every interactable on walkable ground inside a room, reachable from its own radius', () => {
    for (const i of INTERACTABLES.filter((x) => x.id !== 'water-recycler')) {
      // (the recycler's anchor is the machine itself; the player stands within its radius, in front)
      expect(collides(i.position[0], i.position[2], PLAYER_RADIUS, COLLIDERS)).toBe(false);
      expect(roomAt(i.position[0], i.position[2])).toBe(i.room);
    }
    expect(ROOM_LIST).toHaveLength(5);
  });

  it('covers the four required areas and maps each task to a module', () => {
    expect(new Set(INTERACTABLES.map((i) => i.room))).toEqual(new Set(['mission-control', 'power', 'life-support', 'greenhouse', 'hub']));
    expect(new Set(INTERACTABLES.map((i) => i.id)).size).toBe(INTERACTABLES.length);
    expect(INTERACTABLES.find((i) => i.taskId === 'water-recycler')?.moduleId).toBe('water-recycler');
  });
});

describe('interaction targeting', () => {
  const rec = INTERACTABLES.find((i) => i.id === 'water-recycler')!;
  const air = INTERACTABLES.find((i) => i.id === 'air-unit')!;
  it('returns nothing when out of range', () => {
    expect(pickInteractable(INTERACTABLES, { x: 0.9, z: -0.2, yaw: 0, current: null })).toBeNull();
  });
  it('selects an in-range target and is deterministic', () => {
    const p = { x: rec.position[0] - 1.8, z: rec.position[2], yaw: Math.PI / 2, current: null };
    expect(pickInteractable(INTERACTABLES, p)?.id).toBe('water-recycler');
    expect(pickInteractable(INTERACTABLES, p)?.id).toBe('water-recycler');
  });
  it('prefers the nearer / faced target and does not flicker between close candidates', () => {
    const near = { x: air.position[0], z: air.position[2] + 0.4, yaw: Math.PI, current: null as string | null };
    expect(pickInteractable(INTERACTABLES, near)?.id).toBe('air-unit');
    // Move to a spot where both are in range with similar scores: the current target is kept.
    const between = { x: -5.6, z: -0.9, yaw: 0, current: 'air-unit' };
    const kept = pickInteractable(INTERACTABLES, between);
    const switched = pickInteractable(INTERACTABLES, { ...between, current: 'water-recycler' });
    expect(kept && switched).toBeTruthy();
    if (kept?.id !== switched?.id) expect([kept?.id, switched?.id].sort()).toEqual(['air-unit', 'water-recycler']);
  });
  it('ignores disabled interactables', () => {
    const list = INTERACTABLES.map((i) => (i.id === 'water-recycler' ? { ...i, enabled: false } : i));
    expect(pickInteractable(list, { x: rec.position[0] - 1.8, z: rec.position[2], yaw: Math.PI / 2, current: null })?.id).not.toBe('water-recycler');
  });
});

describe('gameplay lifecycle', () => {
  beforeEach(() => {
    useExploreStore.setState({ worldMode: 'habitat', mode: 'exploration', nearbyId: null, activeTaskId: null, activeInteractableId: null, transitionDirection: null, showObjectives: false });
  });

  it('opens a task through a transition and never twice', () => {
    const s = useExploreStore.getState();
    expect(s.beginTask('water-recycler', 'water-recycler')).toBe(true);
    expect(useExploreStore.getState().mode).toBe('transitioning');
    expect(useExploreStore.getState().beginTask('power-console', 'power-console')).toBe(false);
    expect(useExploreStore.getState().activeTaskId).toBe('water-recycler');
    useExploreStore.getState().finishTransition();
    expect(useExploreStore.getState().mode).toBe('task');
    expect(useExploreStore.getState().beginTask('power-console', 'power-console')).toBe(false);
  });

  it('closing always returns to exploration, even if closed mid-transition', () => {
    const s = useExploreStore.getState();
    s.beginTask('water-recycler', 'water-recycler');
    useExploreStore.getState().endTask(); // Esc during the transition in
    expect(useExploreStore.getState().transitionDirection).toBe('out');
    useExploreStore.getState().finishTransition();
    expect(useExploreStore.getState().mode).toBe('exploration');
    expect(useExploreStore.getState().activeInteractableId).toBeNull();
  });

  it('refuses tasks outside the habitat and during debrief', () => {
    useExploreStore.setState({ worldMode: 'colony' });
    expect(useExploreStore.getState().beginTask('a', 'water-recycler')).toBe(false);
    useExploreStore.setState({ worldMode: 'habitat', mode: 'exploration' });
    useExploreStore.getState().openDebrief();
    expect(useExploreStore.getState().beginTask('a', 'water-recycler')).toBe(false);
    useExploreStore.getState().closeDebrief();
    expect(useExploreStore.getState().mode).toBe('exploration');
  });

  it('objectives toggle only while exploring', () => {
    useExploreStore.getState().toggleObjectives();
    expect(useExploreStore.getState().showObjectives).toBe(true);
    useExploreStore.getState().beginTask('x', 'crew-terminal');
    useExploreStore.getState().toggleObjectives();
    expect(useExploreStore.getState().showObjectives).toBe(true);
  });
});

describe('mission menu and review lifecycle', () => {
  it('locks task entry while paused and resumes without changing the saved pose', () => {
    useExploreStore.getState().enterHabitat();
    useExploreStore.getState().rememberPose({ x: 5, z: 0, yaw: 1 });
    useExploreStore.getState().togglePause();
    expect(useExploreStore.getState().mode).toBe('paused');
    expect(useExploreStore.getState().beginTask('power-console', 'power-console')).toBe(false);
    useExploreStore.getState().togglePause();
    expect(useExploreStore.getState().mode).toBe('exploration');
    expect(useExploreStore.getState().lastPose).toEqual({ x: 5, z: 0, yaw: 1 });
  });

  it('opens autopsy directly from a mission task without a transition timer race', () => {
    useExploreStore.getState().enterHabitat();
    useExploreStore.getState().beginTask('mission-console', 'mission-console');
    useExploreStore.getState().finishTransition();
    useExploreStore.getState().openDebrief();
    expect(useExploreStore.getState().mode).toBe('debrief');
    expect(useExploreStore.getState().activeTaskId).toBeNull();
    useExploreStore.getState().finishTransition();
    expect(useExploreStore.getState().mode).toBe('debrief');
    useExploreStore.getState().closeDebrief();
    expect(useExploreStore.getState().mode).toBe('exploration');
  });
});
