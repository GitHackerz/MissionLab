import { describe, it, expect } from 'vitest';
import {
  ALL_MODULE_IDS,
  createInitialMission,
  getAvailableActions,
  applyMissionAction,
  advanceMission,
  FIXTURES,
  RED_STORM_CONFIG,
} from '../index';

describe('MissionLab Shared Contracts & Engine Foundation', () => {
  it('defines exactly the 7 agreed habitat module IDs', () => {
    expect(ALL_MODULE_IDS).toHaveLength(7);
    expect(ALL_MODULE_IDS).toContain('solar-array');
    expect(ALL_MODULE_IDS).toContain('battery-bank');
    expect(ALL_MODULE_IDS).toContain('life-support');
    expect(ALL_MODULE_IDS).toContain('water-recycler');
    expect(ALL_MODULE_IDS).toContain('greenhouse');
    expect(ALL_MODULE_IDS).toContain('research-lab');
    expect(ALL_MODULE_IDS).toContain('crew-habitat');
  });

  it('creates a deterministic initial mission state matching Red Storm config', () => {
    const state = createInitialMission(RED_STORM_CONFIG);
    expect(state.scenarioId).toBe('mission-01-red-storm');
    expect(state.hour).toBe(0);
    expect(state.durationHours).toBe(72);
    expect(state.crewCount).toBe(4);
    expect(state.resources.batteryKwh).toBe(110);
    expect(state.resources.batteryCapacityKwh).toBe(150);
    expect(state.resources.waterLiters).toBe(35.0);
    expect(state.resources.oxygenKg).toBe(5.0);
    expect(state.resources.sparePumps).toBe(1);

    // Verify all 7 modules are present
    for (const modId of ALL_MODULE_IDS) {
      expect(state.modules[modId]).toBeDefined();
      expect(state.modules[modId].id).toBe(modId);
      expect(state.modules[modId].status).toBe(modId === 'solar-array' ? 'warning' : 'operational');
    }
  });

  it('provides available actions with preconditions and power deltas', () => {
    const state = createInitialMission(RED_STORM_CONFIG);
    const actions = getAvailableActions(state);
    expect(actions.length).toBeGreaterThanOrEqual(4);

    const ghAction = actions.find((a) => a.id === 'toggle-greenhouse');
    expect(ghAction).toBeDefined();
    expect(ghAction?.powerDeltaKw).toBe(-2.5);

    const labAction = actions.find((a) => a.id === 'toggle-research-lab');
    expect(labAction).toBeDefined();
    expect(labAction?.powerDeltaKw).toBe(-1.5);

    // Water recycler is operational at start, so repair should be disabled
    const repairAction = actions.find((a) => a.id === 'repair-water-recycler');
    expect(repairAction).toBeDefined();
    expect(repairAction?.enabled).toBe(false);
  });

  it('all 6 test fixtures are populated and conform to contract', () => {
    const fixtureKeys = [
      'normal',
      'storm',
      'water-recycler-degraded',
      'critical-energy',
      'success',
      'failed',
    ];

    for (const key of fixtureKeys) {
      const fix = FIXTURES[key];
      expect(fix).toBeDefined();
      expect(fix.resources.batteryKwh).toBeGreaterThanOrEqual(0);
      expect(fix.resources.batteryCapacityKwh).toBe(150);
      expect(fix.crewCount).toBe(4);
      for (const modId of ALL_MODULE_IDS) {
        expect(fix.modules[modId]).toBeDefined();
      }
    }
  });

  it('advancing time deterministically drains battery during dust storm when all loads remain on', () => {
    const state = createInitialMission(RED_STORM_CONFIG);
    state.stormActive = true; // Dust storm active: solar = 4.0 kW

    // Total load: 2.0 (life-support) + 1.2 (crew-heating) + 1.2 (recycler) + 2.5 (greenhouse) + 1.5 (lab) = 8.4 kW
    // Net drain: 8.4 - 4.0 = 4.4 kW
    const after1h = advanceMission(state, 1);
    expect(after1h.hour).toBe(1);
    expect(Number(after1h.resources.batteryKwh.toFixed(1))).toBe(105.6); // 110 - 4.4 = 105.6

    // Repeating on a fresh copy gives the exact same result
    const state2 = createInitialMission(RED_STORM_CONFIG);
    state2.stormActive = true;
    const after1hAgain = advanceMission(state2, 1);
    expect(after1hAgain.resources.batteryKwh).toBe(after1h.resources.batteryKwh);
  });

  it('pausing optional loads reduces drain rate and preserves battery margin', () => {
    let state = createInitialMission(RED_STORM_CONFIG);
    state.stormActive = true;

    // Turn off greenhouse and research lab
    const res1 = applyMissionAction(state, {
      type: 'SET_ENABLED',
      moduleId: 'greenhouse',
      enabled: false,
    });
    expect(res1.ok).toBe(true);
    state = res1.state;

    const res2 = applyMissionAction(state, {
      type: 'SET_ENABLED',
      moduleId: 'research-lab',
      enabled: false,
    });
    expect(res2.ok).toBe(true);
    state = res2.state;

    // Essential load: 2.0 + 1.2 + 1.2 = 4.4 kW
    // Net drain: 4.4 - 4.0 = 0.4 kW
    const after1h = advanceMission(state, 1);
    expect(Number(after1h.resources.batteryKwh.toFixed(1))).toBe(109.6); // 110 - 0.4 = 109.6
  });
});
