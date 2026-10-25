import type { MissionConfig, ModuleId, ModuleState } from './types';

export const RED_STORM_CONFIG: MissionConfig = {
  scenarioId: 'mission-01-red-storm',
  title: 'Mission 01: The Red Storm',
  description:
    'A severe Martian dust storm reduces solar array generation to 4.0 kW. A four-astronaut science crew must balance life support, thermal heating, agricultural power, and a secondary water recycler failure across 72 simulated hours.',
  durationHours: 72,
  crewCount: 4,
  initialResources: {
    batteryKwh: 110,
    batteryCapacityKwh: 150,
    oxygenKg: 5.0,
    waterLiters: 35.0,
    foodRations: 48,
    sparePumps: 1,
  },
  stormSolarGenerationKw: 4.0,
  normalSolarGenerationKw: 10.0,
  batterySafetyThresholdKwh: 15.0,
  waterSafetyThresholdLiters: 14.0,
  oxygenSafetyThresholdKg: 1.5,
  crewWaterUseLitersPerHour: 0.50,
  normalWaterRecoveryLitersPerHour: 0.42,
  crewOxygenUseKgPerHour: 0.14,
  normalOxygenGenKgPerHour: 0.16,
  waterRecyclerRepairDurationHours: 4,
  oxygenProcessWaterLitersPerKg: 1.125,
};

export const INITIAL_MODULES: Record<ModuleId, ModuleState> = {
  'solar-array': {
    id: 'solar-array',
    name: 'Photovoltaic Solar Array',
    status: 'operational',
    enabled: true,
    health: 1.0,
    powerDemandKw: 0,
    suppliedPowerKw: 0,
    description: 'Bifacial solar panel arrays generating colony electrical power.',
  },
  'battery-bank': {
    id: 'battery-bank',
    name: 'Lithium-Ion Battery Bank',
    status: 'operational',
    enabled: true,
    health: 1.0,
    powerDemandKw: 0,
    suppliedPowerKw: 0,
    description: 'Central chemical energy storage buffer (150 kWh capacity).',
  },
  'life-support': {
    id: 'life-support',
    name: 'ECLSS Life Support Unit',
    status: 'operational',
    enabled: true,
    health: 1.0,
    powerDemandKw: 2.0,
    suppliedPowerKw: 2.0,
    description: 'Atmospheric revitalization, trace contaminant removal, and oxygen generation.',
  },
  'water-recycler': {
    id: 'water-recycler',
    name: 'Vapor Compression Water Recycler',
    status: 'operational',
    enabled: true,
    health: 1.0,
    powerDemandKw: 1.2,
    suppliedPowerKw: 1.2,
    description: 'Distills and purifies wastewater and humidity condensate into potable water.',
  },
  'greenhouse': {
    id: 'greenhouse',
    name: 'Hydroponic Crop Greenhouse',
    status: 'operational',
    enabled: true,
    health: 1.0,
    powerDemandKw: 2.5,
    suppliedPowerKw: 2.5,
    description: 'Automated plant growth chambers with high-intensity grow lighting.',
  },
  'research-lab': {
    id: 'research-lab',
    name: 'Geological Science Lab',
    status: 'operational',
    enabled: true,
    health: 1.0,
    powerDemandKw: 1.5,
    suppliedPowerKw: 1.5,
    description: 'Sample analysis spectrometers and high-throughput computational lab.',
  },
  'crew-habitat': {
    id: 'crew-habitat',
    name: 'Pressurized Crew Quarters',
    status: 'operational',
    enabled: true,
    health: 1.0,
    powerDemandKw: 1.2, // Essential environmental heating
    suppliedPowerKw: 1.2,
    description: 'Living quarters for 4 crew members with thermal heating systems.',
  },
};

/** Legacy fixtures default to Red Storm; live missions carry their own rules. */
export function getMissionConfig(state: { config?: MissionConfig }): MissionConfig {
  return state.config ?? RED_STORM_CONFIG;
}

export function validateConfig(config: MissionConfig): void {
  const numeric = {
    durationHours: config.durationHours, crewCount: config.crewCount,
    stormSolarGenerationKw: config.stormSolarGenerationKw, normalSolarGenerationKw: config.normalSolarGenerationKw,
    batterySafetyThresholdKwh: config.batterySafetyThresholdKwh, waterSafetyThresholdLiters: config.waterSafetyThresholdLiters,
    oxygenSafetyThresholdKg: config.oxygenSafetyThresholdKg, crewWaterUseLitersPerHour: config.crewWaterUseLitersPerHour,
    normalWaterRecoveryLitersPerHour: config.normalWaterRecoveryLitersPerHour, crewOxygenUseKgPerHour: config.crewOxygenUseKgPerHour,
    normalOxygenGenKgPerHour: config.normalOxygenGenKgPerHour, repairDuration: config.waterRecyclerRepairDurationHours,
    processWater: config.oxygenProcessWaterLitersPerKg ?? 1.125, ...config.initialResources,
  };
  for (const [name, value] of Object.entries(numeric)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} must be finite and nonnegative.`);
    }
  }
  for (const [name, value] of Object.entries({ durationHours: config.durationHours,
    crewCount: config.crewCount, repairDuration: config.waterRecyclerRepairDurationHours })) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer.`);
  }
  const r = config.initialResources;
  if (!Number.isSafeInteger(r.sparePumps) || r.batteryKwh > r.batteryCapacityKwh) {
    throw new RangeError('Invalid initial battery or spare pump inventory.');
  }
}
