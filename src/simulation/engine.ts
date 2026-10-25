import type { ActionResult, MissionAction, MissionConfig, MissionState, ModuleId } from './types';
import { RED_STORM_CONFIG, INITIAL_MODULES, getMissionConfig, validateConfig } from './config';
import { getAvailableActions, validateAction } from './actions';
import { processScheduledEvents, recordEvent } from './events';

export { getAvailableActions };
const PRIORITY: ModuleId[] = ['life-support', 'crew-habitat', 'water-recycler', 'greenhouse', 'research-lab'];
const EPSILON = 1e-9;

export function createInitialMission(config: MissionConfig = RED_STORM_CONFIG): MissionState {
  validateConfig(config);
  const state: MissionState = {
    scenarioId: config.scenarioId, branchId: 'main-branch', hour: 0,
    durationHours: config.durationHours, status: 'running', stormActive: false, crewCount: config.crewCount,
    resources: structuredClone(config.initialResources), modules: structuredClone(INITIAL_MODULES),
    config: structuredClone(config), events: [], scienceScore: 0,
  };
  recordEvent(state, { type: 'MISSION_INITIALIZED', severity: 'info', message: `${config.title}: survive ${config.durationHours} hours.` });
  processScheduledEvents(state);
  allocatePower(state, false);
  return state;
}

/** Priority allocation permits partial loads; only fully supplied machinery produces resources. */
function allocatePower(state: MissionState, consumeEnergy: boolean): void {
  const config = getMissionConfig(state);
  const solar = state.modules['solar-array'].enabled
    ? (state.stormActive ? config.stormSolarGenerationKw : config.normalSolarGenerationKw) : 0;
  const available = solar + state.resources.batteryKwh; // kWh / one hour
  let remaining = available;
  let requested = 0;
  let supplied = 0;
  for (const id of PRIORITY) {
    const mod = state.modules[id];
    const demand = mod.enabled ? mod.powerDemandKw : 0;
    mod.suppliedPowerKw = Math.min(demand, Math.max(0, remaining));
    remaining -= mod.suppliedPowerKw;
    requested += demand;
    supplied += mod.suppliedPowerKw;
    if (mod.status !== 'repairing' && mod.status !== 'degraded' && !(id === 'water-recycler' && mod.health < 0.5)) {
      mod.status = !mod.enabled || mod.suppliedPowerKw <= EPSILON ? 'offline'
        : mod.suppliedPowerKw + EPSILON < demand ? 'warning' : 'operational';
    }
  }
  state.power = { solarGenerationKw: solar, requestedPowerKw: requested, availablePowerKw: available,
    suppliedPowerKw: supplied, unservedPowerKw: Math.max(0, requested - supplied) };
  if (consumeEnergy) state.resources.batteryKwh = Math.max(0, Math.min(state.resources.batteryCapacityKwh,
    state.resources.batteryKwh + solar - supplied));
}

function fullyPowered(state: MissionState, id: ModuleId): boolean {
  const m = state.modules[id];
  return m.enabled && m.status === 'operational' && m.suppliedPowerKw + EPSILON >= m.powerDemandKw;
}

export function applyMissionAction(state: MissionState, action: MissionAction): ActionResult {
  const validation = validateAction(state, action);
  if (!validation.valid) return { ok: false, reason: validation.reason ?? 'Invalid action.', state };
  if (action.type === 'REWIND_TO') return { ok: false, reason: 'Rewind requires session history. Use the mission store or forkMission.', state };
  if (action.type === 'RESET_MISSION') return { ok: true, state: createInitialMission(getMissionConfig(state)) };
  if (action.type === 'ADVANCE_TIME') return { ok: true, state: advanceMission(state, action.hours) };
  const next = structuredClone(state);
  if (action.type === 'SET_ENABLED') {
    next.modules[action.moduleId].enabled = action.enabled;
    recordEvent(next, { type: action.enabled ? 'MODULE_ENABLED' : 'MODULE_SUSPENDED', severity: 'info',
      moduleId: action.moduleId, message: `${action.moduleId} ${action.enabled ? 'enabled' : 'suspended'} by commander.` });
  } else {
    next.resources.sparePumps--;
    const recycler = next.modules['water-recycler'];
    recycler.status = 'repairing';
    recycler.repairHoursRemaining = getMissionConfig(next).waterRecyclerRepairDurationHours;
    recordEvent(next, { type: 'REPAIR_COMMENCED', severity: 'info', moduleId: 'water-recycler',
      causeIds: next.events.filter(e => e.type === 'PUMP_MECHANICAL_FAULT').map(e => e.id),
      message: `One spare consumed; repair requires ${recycler.repairHoursRemaining} hours.` });
  }
  allocatePower(next, false);
  return { ok: true, state: next };
}

/** Return one independent state for every elapsed hour; stop immediately on a terminal outcome. */
export function advanceMissionSteps(state: MissionState, hours: number): MissionState[] {
  if (!Number.isSafeInteger(hours) || hours <= 0) throw new RangeError('Advance duration must be a positive safe integer of hours.');
  const results: MissionState[] = [];
  let current = state;
  for (let step = 0; step < hours && current.status === 'running'; step++) {
    const next = structuredClone(current);
    const c = getMissionConfig(next);
    const recycler = next.modules['water-recycler'];
    // Integrate [h,h+1); events at h+1 are applied at the resulting boundary.
    processScheduledEvents(next);
    allocatePower(next, true);
    const recovery = fullyPowered(next, 'water-recycler') ? c.normalWaterRecoveryLitersPerHour : 0;
    const waterAvailable = Math.max(0, next.resources.waterLiters + recovery - c.crewWaterUseLitersPerHour);
    const waterPerKg = c.oxygenProcessWaterLitersPerKg ?? 1.125;
    const oxygenGen = fullyPowered(next, 'life-support')
      ? Math.min(c.normalOxygenGenKgPerHour, waterPerKg > 0 ? waterAvailable / waterPerKg : Infinity) : 0;
    next.resources.waterLiters = Math.max(0, waterAvailable - oxygenGen * waterPerKg);
    next.resources.oxygenKg = Math.max(0, next.resources.oxygenKg + oxygenGen - c.crewOxygenUseKgPerHour);
    next.flows = { waterRecoveryLitersPerHour: recovery, oxygenProductionKgPerHour: oxygenGen,
      oxygenProcessWaterLitersPerHour: oxygenGen * waterPerKg,
      netWaterLitersPerHour: next.resources.waterLiters - current.resources.waterLiters,
      netOxygenKgPerHour: next.resources.oxygenKg - current.resources.oxygenKg };
    if (fullyPowered(next, 'research-lab')) next.scienceScore++;
    next.hour++;
    if (recycler.status === 'repairing' && recycler.repairHoursRemaining !== undefined) {
      recycler.repairHoursRemaining--;
      if (recycler.repairHoursRemaining === 0) {
        recycler.status = 'operational'; recycler.health = 0.95;
        delete recycler.repairHoursRemaining;
        recordEvent(next, { type: 'REPAIR_COMPLETED', severity: 'info', moduleId: 'water-recycler',
          causeIds: next.events.filter(e => e.type === 'REPAIR_COMMENCED').map(e => e.id),
          message: 'Pump replacement complete; recovery resumes in the next interval.' });
      }
    }
    processScheduledEvents(next);
    if (oxygenGen + EPSILON < c.crewOxygenUseKgPerHour && !next.events.some(e => e.type === 'OXYGEN_PRODUCTION_DEFICIT')) {
      recordEvent(next, { type: 'OXYGEN_PRODUCTION_DEFICIT', severity: 'warning', moduleId: 'life-support',
        message: `Oxygen production ${oxygenGen} kg/h was below crew use ${c.crewOxygenUseKgPerHour} kg/h; stored oxygen supplies the difference.` });
    }
    if (next.power!.requestedPowerKw > next.power!.solarGenerationKw + EPSILON
      && !next.events.some(e => e.type === 'POWER_DEFICIT')) {
      recordEvent(next, { type: 'POWER_DEFICIT', severity: 'warning',
        causeIds: next.events.filter(e => e.type === 'DUST_STORM_ARRIVAL').map(e => e.id),
        message: `Demand ${next.power!.requestedPowerKw} kW exceeds generation ${next.power!.solarGenerationKw} kW; battery buffers the deficit. Greenhouse requested ${next.modules.greenhouse.enabled ? next.modules.greenhouse.powerDemandKw : 0} kW; research requested ${next.modules['research-lab'].enabled ? next.modules['research-lab'].powerDemandKw : 0} kW.` });
    }
    if (next.power!.unservedPowerKw > EPSILON) {
      recordEvent(next, { type: 'POWER_SHORTAGE', severity: 'critical',
        causeIds: next.events.filter(e => ['DUST_STORM_ARRIVAL', 'MODULE_ENABLED'].includes(e.type)).map(e => e.id),
        message: `Requested ${next.power!.requestedPowerKw} kW; supplied ${next.power!.suppliedPowerKw} kW; unserved ${next.power!.unservedPowerKw} kW.` });
    }
    if (next.resources.batteryKwh <= c.batterySafetyThresholdKwh && !next.events.some(e => e.type === 'CRITICAL_BATTERY_RESERVE')) {
      recordEvent(next, { type: 'CRITICAL_BATTERY_RESERVE', severity: 'warning', moduleId: 'battery-bank',
        message: `Battery at or below warning reserve ${c.batterySafetyThresholdKwh} kWh.` });
    }
    next.modules['battery-bank'].status = next.resources.batteryKwh <= EPSILON ? 'offline'
      : next.resources.batteryKwh <= c.batterySafetyThresholdKwh ? 'warning' : 'operational';
    const essentialShortage = ['life-support', 'crew-habitat', 'water-recycler'].some(id => {
      const m = next.modules[id as ModuleId];
      return !m.enabled || m.suppliedPowerKw + EPSILON < m.powerDemandKw;
    });
    const kind = essentialShortage ? 'power' : next.resources.waterLiters <= c.waterSafetyThresholdLiters + EPSILON
      ? 'water' : next.resources.oxygenKg <= c.oxygenSafetyThresholdKg + EPSILON ? 'oxygen' : undefined;
    if (kind) {
      const evidenceTypes = kind === 'power' ? ['DUST_STORM_ARRIVAL', 'POWER_DEFICIT', 'CRITICAL_BATTERY_RESERVE', 'POWER_SHORTAGE']
        : kind === 'water' ? ['PUMP_MECHANICAL_FAULT', 'REPAIR_COMMENCED', 'REPAIR_COMPLETED'] : ['OXYGEN_PRODUCTION_DEFICIT', 'POWER_SHORTAGE'];
      const causes = next.events.filter(e => evidenceTypes.includes(e.type)).map(e => e.id);
      next.status = 'failed';
      next.failureReason = kind === 'power' ? 'Insufficient electrical supply for essential systems.'
        : kind === 'water' ? 'Water reserve reached the unsafe threshold.' : 'Oxygen reserve reached the unsafe threshold.';
      next.failure = { kind, hour: next.hour, resources: structuredClone(next.resources), causeIds: causes };
      recordEvent(next, { type: `MISSION_FAILED_${kind.toUpperCase()}`, severity: 'critical', message: next.failureReason, causeIds: causes });
    } else if (next.hour >= next.durationHours) {
      next.status = 'success';
      recordEvent(next, { type: 'MISSION_ACCOMPLISHED', severity: 'info', message: `Survived ${next.hour} hours with essential systems supplied and reserves safe.` });
    }
    results.push(next);
    current = next;
  }
  return results;
}

export function advanceMission(state: MissionState, hours: number): MissionState {
  return advanceMissionSteps(state, hours).at(-1) ?? structuredClone(state);
}
