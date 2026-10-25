import { describe, expect, it } from 'vitest';
import { ALL_MODULE_IDS, ModuleStatus } from '@/simulation/types';
import { FIXTURES } from '@/simulation/fixtures';
import { MODULE_LAYOUT } from '../constants/layout';
import { LEGEND_STATUSES, STATUS_VISUALS, UNKNOWN_STATUS_VISUAL } from '../constants/statusVisuals';
import {
  batteryChargeFraction,
  CLEAR_SKY,
  getRenderableModules,
  getStormPhase,
  isModuleId,
  mixStorm,
  resolveStatusVisual,
  solarDustLevel,
  STORM_SKY,
  stormTarget,
} from '../utils/visualState';
import { litSegments } from '../modules/BatteryBank';
import { overviewDistanceForAspect } from '../components/CameraController';
import { generateScatter, terrainHeight } from '../utils/terrain';

describe('module id to visual mapping', () => {
  it('has a layout entry for every shared ModuleId', () => {
    for (const id of ALL_MODULE_IDS) expect(MODULE_LAYOUT[id]).toBeDefined();
    expect(Object.keys(MODULE_LAYOUT).sort()).toEqual([...ALL_MODULE_IDS].sort());
  });

  it('rejects unknown ids', () => {
    expect(isModuleId('solar-array')).toBe(true);
    expect(isModuleId('reactor')).toBe(false);
    expect(isModuleId(undefined)).toBe(false);
  });

  it('ignores unknown module keys in state and keeps stable order', () => {
    const state = { modules: { ...FIXTURES.normal.modules, reactor: { ...FIXTURES.normal.modules['solar-array'], id: 'reactor' } } };
    const ids = getRenderableModules(state as never).map((m) => m.id);
    expect(ids).toEqual(ALL_MODULE_IDS);
  });

  it('keeps modules on the flat pad, apart from each other', () => {
    for (const id of ALL_MODULE_IDS) {
      const [x, , z] = MODULE_LAYOUT[id].position;
      expect(terrainHeight(x, z)).toBe(0);
    }
  });
});

describe('module status mapping', () => {
  it('maps every status to a distinct shape and colour', () => {
    const statuses = Object.keys(STATUS_VISUALS) as ModuleStatus[];
    expect(new Set(statuses.map((s) => STATUS_VISUALS[s].shape)).size).toBe(statuses.length);
    expect(new Set(statuses.map((s) => STATUS_VISUALS[s].color)).size).toBe(statuses.length);
    expect(LEGEND_STATUSES).toEqual(statuses);
  });

  it('stops activity and lights when offline and shows maintenance when repairing', () => {
    expect(resolveStatusVisual('offline')).toMatchObject({ activity: 0, glow: 0, shape: 'box' });
    expect(resolveStatusVisual('repairing').shape).toBe('torus');
    expect(resolveStatusVisual('operational').activity).toBeGreaterThan(resolveStatusVisual('degraded').activity);
  });

  it('falls back safely for an unrecognised status', () => {
    expect(resolveStatusVisual('on-fire')).toBe(UNKNOWN_STATUS_VISUAL);
    expect(resolveStatusVisual(undefined)).toBe(UNKNOWN_STATUS_VISUAL);
    expect(resolveStatusVisual('toString')).toBe(UNKNOWN_STATUS_VISUAL);
  });

  it('reflects operational to degraded/offline transitions from fixtures', () => {
    const before = FIXTURES.normal.modules['water-recycler'];
    const degraded = FIXTURES['water-recycler-degraded'].modules['water-recycler'];
    expect(resolveStatusVisual(before.status).activity).toBe(1);
    expect(resolveStatusVisual(degraded.status).activity).toBeLessThan(1);
    const lab = FIXTURES['water-recycler-degraded'].modules['research-lab'];
    expect(resolveStatusVisual(lab.status).activity).toBe(0);
  });
});

describe('resource-driven indicators', () => {
  it('derives battery fraction from authoritative values only', () => {
    expect(batteryChargeFraction({ batteryKwh: 75, batteryCapacityKwh: 150 })).toBe(0.5);
    expect(batteryChargeFraction({ batteryKwh: 500, batteryCapacityKwh: 150 })).toBe(1);
    expect(batteryChargeFraction({ batteryKwh: -3, batteryCapacityKwh: 150 })).toBe(0);
    expect(batteryChargeFraction({ batteryKwh: 10, batteryCapacityKwh: 0 })).toBe(0);
  });

  it('lights charge segments proportionally and never hides a non-empty battery', () => {
    expect(litSegments(0)).toBe(0);
    expect(litSegments(1)).toBe(24);
    expect(litSegments(0.5)).toBe(12);
    expect(litSegments(0.001)).toBe(1);
  });

  it('dusts solar panels from reported health and storm haze', () => {
    expect(solarDustLevel({ health: 1 }, 0)).toBe(0);
    expect(solarDustLevel({ health: 0.65 }, 0)).toBeCloseTo(0.35);
    expect(solarDustLevel({ health: 1 }, 1)).toBeGreaterThan(0.4);
  });
});

describe('weather-state visualization mapping', () => {
  it('follows the canonical stormActive flag', () => {
    expect(stormTarget(FIXTURES.normal)).toBe(0);
    expect(stormTarget(FIXTURES.storm)).toBe(1);
  });

  it('maps eased intensity to clear / approaching / active / recovering', () => {
    expect(getStormPhase(0, 0)).toBe('clear');
    expect(getStormPhase(0.4, 1)).toBe('approaching');
    expect(getStormPhase(1, 1)).toBe('active');
    expect(getStormPhase(0.6, 0)).toBe('recovering');
  });

  it('interpolates between clear and storm endpoints from the design doc', () => {
    expect(mixStorm('fogDensity', 0)).toBe(CLEAR_SKY.fogDensity);
    expect(mixStorm('fogDensity', 1)).toBe(STORM_SKY.fogDensity);
    expect(mixStorm('sunIntensity', 0)).toBe(2.2);
    expect(mixStorm('sunIntensity', 1)).toBe(0.8);
    expect(mixStorm('sunIntensity', 5)).toBe(0.8);
    expect(mixStorm('dustOpacity', 0.5)).toBeGreaterThan(0);
  });
});

describe('camera and terrain helpers', () => {
  it('pulls the overview back on narrow viewports, within limits', () => {
    expect(overviewDistanceForAspect(1.78)).toBeLessThan(overviewDistanceForAspect(0.6));
    expect(overviewDistanceForAspect(0.01)).toBeLessThan(35);
  });

  it('generates deterministic scatter outside the colony pad', () => {
    const a = generateScatter(50, 7, 10, 60, 0.2, 1.5);
    const b = generateScatter(50, 7, 10, 60, 0.2, 1.5);
    expect(a).toEqual(b);
    for (const rock of a) expect(Math.hypot(rock.x, rock.z)).toBeGreaterThanOrEqual(10);
  });
});
