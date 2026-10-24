/**
 * MISSIONLAB - Development & Test Fixtures
 *
 * NOTE: These are typed mock states designed for parallel development and testing.
 * They represent expected intermediate and terminal simulation states.
 */

import { MissionState } from '../types';
import { RED_STORM_CONFIG, INITIAL_MODULES } from '../config';

/**
 * Fixture 1: Normal operating habitat before dust storm
 */
export const FIXTURE_NORMAL: MissionState = {
  scenarioId: RED_STORM_CONFIG.scenarioId,
  branchId: 'main-branch',
  hour: 0,
  durationHours: 72,
  status: 'running',
  stormActive: false,
  crewCount: 4,
  resources: {
    batteryKwh: 110,
    batteryCapacityKwh: 150,
    oxygenKg: 5.0,
    waterLiters: 35.0,
    foodRations: 48,
    sparePumps: 1,
  },
  modules: {
    ...INITIAL_MODULES,
  },
  events: [
    {
      id: 'evt-001',
      hour: 0,
      type: 'HABITAT_INITIALIZED',
      severity: 'info',
      message: 'All habitat subsystems operating within nominal parameters.',
    },
  ],
  scienceScore: 10,
};

/**
 * Fixture 2: Active dust storm (Hour 4)
 */
export const FIXTURE_STORM: MissionState = {
  scenarioId: RED_STORM_CONFIG.scenarioId,
  branchId: 'main-branch',
  hour: 4,
  durationHours: 72,
  status: 'running',
  stormActive: true,
  crewCount: 4,
  resources: {
    batteryKwh: 92.4, // Net drain of 4.4 kWh/h over 4 hours with all loads on
    batteryCapacityKwh: 150,
    oxygenKg: 5.08,
    waterLiters: 34.68,
    foodRations: 48,
    sparePumps: 1,
  },
  modules: {
    ...INITIAL_MODULES,
    'solar-array': {
      ...INITIAL_MODULES['solar-array'],
      status: 'warning',
      health: 0.65,
      description: 'Severe dust accumulation reducing solar generation to 4.0 kW.',
    },
  },
  events: [
    ...FIXTURE_NORMAL.events,
    {
      id: 'evt-002',
      hour: 0,
      type: 'DUST_STORM_ARRIVAL',
      severity: 'warning',
      moduleId: 'solar-array',
      message: 'Martian dust storm arrived. Solar generation collapsed from 10.0 kW to 4.0 kW.',
    },
    {
      id: 'evt-003',
      hour: 4,
      type: 'BATTERY_DISCHARGE_WARNING',
      severity: 'warning',
      moduleId: 'battery-bank',
      message: 'Net power deficit is 4.4 kW. Battery drain rate unsustainable without load shedding.',
    },
  ],
  scienceScore: 25,
};

/**
 * Fixture 3: Water recycler degraded (Hour 30)
 */
export const FIXTURE_WATER_RECYCLER_DEGRADED: MissionState = {
  scenarioId: RED_STORM_CONFIG.scenarioId,
  branchId: 'main-branch',
  hour: 30,
  durationHours: 72,
  status: 'running',
  stormActive: true,
  crewCount: 4,
  resources: {
    batteryKwh: 75.0,
    batteryCapacityKwh: 150,
    oxygenKg: 5.2,
    waterLiters: 31.5,
    foodRations: 44,
    sparePumps: 1,
  },
  modules: {
    ...INITIAL_MODULES,
    'solar-array': {
      ...INITIAL_MODULES['solar-array'],
      status: 'warning',
      health: 0.65,
    },
    'water-recycler': {
      ...INITIAL_MODULES['water-recycler'],
      status: 'degraded',
      health: 0.35,
      powerDemandKw: 0.6,
      suppliedPowerKw: 0.6,
      description: 'Primary distillation pump impeller seized. Water recovery halted.',
    },
    'research-lab': {
      ...INITIAL_MODULES['research-lab'],
      enabled: false,
      status: 'offline',
      suppliedPowerKw: 0,
      description: 'Experiments paused to shed 1.5 kW electrical load.',
    },
  },
  events: [
    ...FIXTURE_STORM.events,
    {
      id: 'evt-004',
      hour: 30,
      type: 'PUMP_MECHANICAL_FAULT',
      severity: 'critical',
      moduleId: 'water-recycler',
      message: 'Water recycler primary pump failed. Recovery rate dropped from 0.42 L/h to 0.00 L/h.',
    },
  ],
  scienceScore: 50,
};

/**
 * Fixture 4: Critical energy shortage
 */
export const FIXTURE_CRITICAL_ENERGY: MissionState = {
  scenarioId: RED_STORM_CONFIG.scenarioId,
  branchId: 'bad-choice-branch',
  hour: 22,
  durationHours: 72,
  status: 'running',
  stormActive: true,
  crewCount: 4,
  resources: {
    batteryKwh: 13.2, // Below 15 kWh safety reserve
    batteryCapacityKwh: 150,
    oxygenKg: 4.8,
    waterLiters: 32.8,
    foodRations: 46,
    sparePumps: 1,
  },
  modules: {
    ...INITIAL_MODULES,
    'battery-bank': {
      ...INITIAL_MODULES['battery-bank'],
      status: 'warning',
      health: 0.4,
      description: 'Critical reserve breached! Imminent blackout within 3 hours.',
    },
    'life-support': {
      ...INITIAL_MODULES['life-support'],
      status: 'warning',
      health: 0.7,
      description: 'Life support at risk due to critical electrical power deficit.',
    },
  },
  events: [
    ...FIXTURE_STORM.events,
    {
      id: 'evt-005',
      hour: 22,
      type: 'CRITICAL_BATTERY_RESERVE',
      severity: 'critical',
      moduleId: 'battery-bank',
      message: 'Battery level reached 13.2 kWh (< 15.0 kWh reserve). Essential life support threatened.',
    },
  ],
  scienceScore: 40,
};

/**
 * Fixture 5: Mission Success (Hour 72 survived)
 */
export const FIXTURE_SUCCESS: MissionState = {
  scenarioId: RED_STORM_CONFIG.scenarioId,
  branchId: 'survival-branch',
  hour: 72,
  durationHours: 72,
  status: 'success',
  stormActive: false,
  crewCount: 4,
  resources: {
    batteryKwh: 48.5,
    batteryCapacityKwh: 150,
    oxygenKg: 5.6,
    waterLiters: 26.8,
    foodRations: 42,
    sparePumps: 0, // Used spare pump to fix recycler
  },
  modules: {
    ...INITIAL_MODULES,
    'water-recycler': {
      ...INITIAL_MODULES['water-recycler'],
      status: 'operational',
      health: 0.95,
      description: 'Pump replaced with spare; recycling efficiency restored.',
    },
  },
  events: [
    ...FIXTURE_WATER_RECYCLER_DEGRADED.events,
    {
      id: 'evt-006',
      hour: 34,
      type: 'PUMP_REPAIR_COMPLETE',
      severity: 'info',
      moduleId: 'water-recycler',
      message: 'Water recycler pump successfully repaired using spare part.',
    },
    {
      id: 'evt-007',
      hour: 72,
      type: 'MISSION_ACCOMPLISHED',
      severity: 'info',
      message: '72-hour storm survived. All four crew members safe and habitat integrity preserved.',
    },
  ],
  scienceScore: 85,
};

/**
 * Fixture 6: Mission Failure (Life support collapsed)
 */
export const FIXTURE_FAILED: MissionState = {
  scenarioId: RED_STORM_CONFIG.scenarioId,
  branchId: 'failed-branch',
  hour: 25,
  durationHours: 72,
  status: 'failed',
  stormActive: true,
  crewCount: 4,
  resources: {
    batteryKwh: 0,
    batteryCapacityKwh: 150,
    oxygenKg: 4.1,
    waterLiters: 32.2,
    foodRations: 46,
    sparePumps: 1,
  },
  modules: {
    ...INITIAL_MODULES,
    'battery-bank': {
      ...INITIAL_MODULES['battery-bank'],
      status: 'offline',
      health: 0.1,
    },
    'life-support': {
      ...INITIAL_MODULES['life-support'],
      status: 'offline',
      health: 0.0,
      suppliedPowerKw: 0,
      description: 'Subsystem blacked out due to total power exhaustion.',
    },
  },
  events: [
    ...FIXTURE_CRITICAL_ENERGY.events,
    {
      id: 'evt-008',
      hour: 25,
      type: 'TOTAL_POWER_EXHAUSTION',
      severity: 'critical',
      message: 'Battery exhausted. Total habitat blackout triggered ECLSS life-support shutdown.',
    },
  ],
  scienceScore: 20,
  failureReason:
    'ECLSS life support shut down after total battery depletion at Hour 25. Failure to shed non-essential loads caused critical energy exhaustion.',
};

export const FIXTURES: Record<string, MissionState> = {
  normal: FIXTURE_NORMAL,
  storm: FIXTURE_STORM,
  'water-recycler-degraded': FIXTURE_WATER_RECYCLER_DEGRADED,
  'critical-energy': FIXTURE_CRITICAL_ENERGY,
  success: FIXTURE_SUCCESS,
  failed: FIXTURE_FAILED,
};
