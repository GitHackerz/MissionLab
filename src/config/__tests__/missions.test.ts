import { describe, expect, it } from 'vitest';
import { AVAILABLE_MISSIONS, MISSIONS } from '../missions';
import { MISSIONS as REGISTRY, isMissionId } from '@/simulation/missions/registry';

describe('mission catalogue vs simulation registry', () => {
  it('every available catalogue mission is a registered, playable mission with a matching route', () => {
    expect(AVAILABLE_MISSIONS.map((m) => m.id).sort()).toEqual(REGISTRY.map((m) => m.id).sort());
    for (const m of AVAILABLE_MISSIONS) {
      expect(isMissionId(m.id)).toBe(true);
      expect(m.href === '/mission' || m.href === `/mission?mission=${m.id}`).toBe(true);
    }
  });
  it('catalogue ids and numbers are unique and coming-soon missions are not registered yet', () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    expect(new Set(MISSIONS.map((m) => m.number)).size).toBe(MISSIONS.length);
    for (const m of MISSIONS.filter((x) => x.status === 'coming-soon')) expect(isMissionId(m.id)).toBe(false);
  });
});
