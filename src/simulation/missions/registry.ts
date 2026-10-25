import { RED_STORM_CONFIG } from '../config';
import type { EmergencyRules, MissionDefinition, MissionId } from './types';

export const RED_STORM_ID: MissionId = 'mission-01-red-storm';
const gasSource = 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/equation-of-state-ideal-gas-2/';
const eclssSource = 'https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/';
const rules: EmergencyRules = {
  temperatureK: 293.15, initialPressureKpa: 101.3, initialOxygenFraction: .21, initialCo2Ppm: 800,
  hubVolumeM3: 120, serviceVolumeM3: 30, minimumPressureKpa: 75, minimumOxygenKpa: 16,
  maximumCo2Ppm: 6000, recoveryCo2Ppm: 1600, minimumVerifiedPressureKpa: 90,
  leakConductanceMolPerMinKpa: .35, exchangeConductanceMolPerMinKpa: 4,
  regulatorMolPerMin: 12, atmosphereReserveMol: 700,
  crewOxygenMolPerMin: .073, crewCo2MolPerMin: .06, oxygenFeedMolPerMin: .073,
  scrubberMolPerMin: .12, scrubberCapacityMol: 40, backupRemovalMolPerMin: .09, backupCapacityMol: 8,
  fanKw: .3, scrubberKw: .5, regulatorKw: .8, backupKw: .4,
  faultMinute: 0, durationMinutes: 180, verificationMinutes: 5, defaultFault: 'seal-leak',
};
const levels = ['cadet', 'engineer', 'commander'] as const;
const make = (id: MissionId, title: string, durationHours: number) => ({ ...structuredClone(RED_STORM_CONFIG),
  scenarioId: id, title, durationHours, stormSolarGenerationKw: 10, normalSolarGenerationKw: 10 });
export const MISSIONS: MissionDefinition[] = [
  { id: RED_STORM_ID, version: 1, number: '01', title: 'The Red Storm', hazard: 'Dust storm · power and water', difficulty: 'Introductory',
    briefing: 'Chryse Planitia, 2045. A dust storm has reduced solar output to 4 kW. Four crew depend on your power plan. Watch for equipment warnings as the mission progresses.',
    objective: 'Compare generation and electrical demand, then apply a power plan.', destination: 'Power Room · east →',
    concept: 'Solar generation − supplied load determines whether stored battery energy rises or falls.',
    objectives: ['Conserve essential power', 'Diagnose low water recovery', 'Verify the intervention', 'Survive 72 hours'],
    systems: ['power', 'water', 'oxygen', 'food'], playerActions: ['SET_ENABLED','APPLY_POWER_PLAN','RUN_DIAGNOSTIC','TRAINING_STEP','RECORD_HYPOTHESIS'], gradingRules: ['System understanding','Scientific reasoning','Diagnosis','Planning','Procedure','Verification','Tradeoffs'], diagnosticTests: [], faultVariants: [], components: [], guidanceLevels: [...levels], config: RED_STORM_CONFIG,
    sourceUrls: [eclssSource], assumptions: ['One-hour fixed resource timestep; simplified habitat-wide consumption rates.'] },
  { id: 'mission-02-pressure-drop', version: 1, number: '02', title: 'Pressure Drop', hazard: 'Pressure anomaly · compartment isolation', difficulty: 'Intermediate',
    briefing: 'A pressure instrument reports an abnormal trend. Four crew are in the Central Hub. Compare the hub and service-zone readings, check isolation equipment, and establish whether gas is escaping or an instrument is misleading you.',
    objective: 'Compare compartment pressure with an independent instrument before choosing an intervention.', destination: 'Central Hub · atmospheric console',
    concept: 'At fixed temperature, pressure follows gas inventory divided by compartment volume: P = nRT/V. Stored oxygen is separate from cabin oxygen partial pressure.',
    objectives: ['Locate the anomaly', 'Record a supported diagnosis', 'Contain or repair the fault', 'Pass a five-minute pressure hold'],
    systems: ['power', 'pressure', 'oxygen', 'compartment-transfer'], playerActions: ['inspect','diagnostic','hypothesis','valve','exchange','crew','regulator','begin-repair','procedure','calibrate','verify','guidance'], gradingRules: ['Independent pressure evidence','Diagnosis','Safe isolation','Measured hold','Gas losses'], diagnosticTests: ['zone-survey', 'independent-analyzer', 'valve-test', 'leak-survey'],
    faultVariants: ['seal-leak','valve-stuck','pressure-sensor-drift'], components: ['seal', 'valve', 'pressure-sensor'], guidanceLevels: [...levels], config: make('mission-02-pressure-drop', 'Pressure Drop', 3), emergency: { ...rules },
    sourceUrls: [gasSource, eclssSource], assumptions: ['Two well-mixed, fixed-volume compartments at 293.15 K.', 'All conductances, limits, reserves and procedure durations are fictional educational calibration, not spacecraft safety standards.'] },
  { id: 'mission-03-silent-air', version: 1, number: '03', title: 'Silent Air', hazard: 'CO₂ accumulation · air treatment', difficulty: 'Advanced',
    briefing: 'An atmospheric monitor reports elevated CO₂ while stored oxygen looks adequate. Investigate circulation, treatment performance and independent gas measurements. Restore safe air and prove the recovery with a monitored test.',
    objective: 'Compare CO₂ instruments, fan operation and treatment performance.', destination: 'Life Support · west ←',
    concept: 'Crew respiration adds CO₂; powered treatment removes it. Oxygen supply and CO₂ removal have separate inventories and safety limits.',
    objectives: ['Measure airflow and gas composition', 'Distinguish process failure from sensor drift', 'Restore treatment', 'Verify safe, non-rising CO₂ for ten minutes'],
    systems: ['power', 'oxygen', 'co2', 'ventilation', 'scrubber'], playerActions: ['inspect','diagnostic','hypothesis','fan','scrubber','backup','begin-repair','procedure','calibrate','verify','guidance'], gradingRules: ['Independent gas evidence','Diagnosis','Actual removal','Measured recovery','Consumable costs'], diagnosticTests: ['independent-analyzer', 'fan-test', 'scrubber-test'],
    faultVariants: ['fan-failure','media-exhausted','co2-sensor-drift'], components: ['fan', 'scrubber', 'co2-sensor'], guidanceLevels: [...levels], config: make('mission-03-silent-air', 'Silent Air', 12),
    emergency: { ...rules, defaultFault: 'fan-failure', faultMinute: 15, durationMinutes: 720, verificationMinutes: 10, hubVolumeM3: 60, serviceVolumeM3: 0 },
    sourceUrls: [gasSource, eclssSource], assumptions: ['One well-mixed cabin; fan flow determines contact with the scrubber rather than providing outside air.', 'CO₂ limits and consumable capacities are educational calibration. No human exposure certification is claimed.'] },
];
export function getMission(id: string): MissionDefinition {
  const mission = MISSIONS.find(m => m.id === id);
  if (!mission) throw new RangeError(`Unknown mission: ${id}`);
  return mission;
}
export function isMissionId(id: string): id is MissionId { return MISSIONS.some(m => m.id === id); }
