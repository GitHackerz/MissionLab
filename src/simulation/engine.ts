import {
  ActionResult,
  MissionAction,
  MissionConfig,
  MissionState,
} from './types';
import { RED_STORM_CONFIG, INITIAL_MODULES } from './config';
import { getAvailableActions, isTrainingAction, validateAction } from './actions';
import { applyTrainingAction, createInitialTraining, syncRecyclerModule } from './training/apply';
import { getWaterRecoveryLph } from './training/recycler';
import { applyPlanToState, forecastPowerPlan, type PowerForecast } from './training/power';
import type { PlanLoadId } from './training/types';
import { RED_STORM_SCHEDULED_EVENTS } from './events';

const FOOD_USE_PER_HOUR = 0.25;
const FOOD_GROWN_PER_LIT_HOUR = 1 / 6;

/**
 * Creates a brand new initial MissionState from a scenario configuration.
 */
export function createInitialMission(
  config: MissionConfig = RED_STORM_CONFIG
): MissionState {
  const initialModules = JSON.parse(JSON.stringify(INITIAL_MODULES));

  return {
    scenarioId: config.scenarioId,
    branchId: 'main-branch',
    hour: 0,
    durationHours: config.durationHours,
    status: 'running',
    // Mission 01 opens under the dust storm (the briefing is about surviving it).
    stormActive: true,
    crewCount: config.crewCount,
    resources: {
      batteryKwh: config.initialResources.batteryKwh,
      batteryCapacityKwh: config.initialResources.batteryCapacityKwh,
      oxygenKg: config.initialResources.oxygenKg,
      waterLiters: config.initialResources.waterLiters,
      foodRations: config.initialResources.foodRations,
      sparePumps: config.initialResources.sparePumps,
    },
    modules: initialModules,
    events: [
      {
        id: 'evt-init',
        hour: 0,
        type: 'MISSION_INITIALIZED',
        severity: 'info',
        message: `${config.title} initialized. Objective: Keep 4 crew members safe for ${config.durationHours} hours.`,
      },
      {
        id: 'evt-storm-arrival',
        hour: 0,
        type: 'DUST_STORM_ARRIVAL',
        severity: 'warning',
        moduleId: 'solar-array',
        message: 'Martian dust storm arrived. Solar generation collapsed from 10.0 kW to 4.0 kW.',
      },
    ],
    scienceScore: 0,
    training: createInitialTraining(),
  };
}

export { getAvailableActions };

/** Forecast a proposed power plan by running THIS engine on a copy of the state. */
export function forecastPlan(state: MissionState, loads: Partial<Record<PlanLoadId, boolean>>): PowerForecast {
  return forecastPowerPlan(state, loads, advanceMission);
}

/**
 * Applies a player or session action to the mission state.
 */
export function applyMissionAction(
  state: MissionState,
  action: MissionAction
): ActionResult {
  if (isTrainingAction(action)) {
    if (action.type === 'APPLY_POWER_PLAN') {
      if (state.status === 'success' || state.status === 'failed') {
        return { ok: false, reason: 'Mission has concluded. Use Rewind or Reset to continue.', state };
      }
      const next = applyPlanToState(state, action.loads);
      if (next.training) {
        next.training.log.push({ hour: next.hour, minute: next.training.minuteOfHour, action: 'APPLY_POWER_PLAN', ok: true, detail: JSON.stringify(action.loads) });
      }
      return {
        ok: true,
        state: next,
        message: 'Power plan applied.',
        feedback: { kind: 'success', title: 'Power plan applied', body: 'Loads were switched. Watch the battery trend to confirm the plan works.' },
      };
    }
    const outcome = applyTrainingAction(state, action as Parameters<typeof applyTrainingAction>[1], advanceMission);
    return outcome.ok
      ? { ok: true, state: outcome.state, message: outcome.feedback.title, feedback: outcome.feedback }
      : { ok: false, reason: outcome.feedback.body, state: outcome.state, feedback: outcome.feedback };
  }

  const validation = validateAction(state, action);
  if (!validation.valid) {
    return { ok: false, reason: validation.reason || 'Invalid action', state };
  }

  // Clone state to preserve immutability
  const next: MissionState = JSON.parse(JSON.stringify(state));

  switch (action.type) {
    case 'SET_ENABLED': {
      const mod = next.modules[action.moduleId];
      mod.enabled = action.enabled;
      mod.status = action.enabled ? 'operational' : 'offline';
      mod.suppliedPowerKw = action.enabled ? mod.powerDemandKw : 0;

      next.events.push({
        id: `evt-act-${next.hour}-${Date.now().toString(36)}`,
        hour: next.hour,
        type: action.enabled ? 'MODULE_ENABLED' : 'MODULE_SUSPENDED',
        severity: 'info',
        moduleId: action.moduleId,
        message: `${mod.name} ${action.enabled ? 'resumed' : 'suspended'} by Commander. Power demand changed by ${action.enabled ? '+' : '-'}${mod.powerDemandKw} kW.`,
      });

      return {
        ok: true,
        state: next,
        message: `${mod.name} is now ${action.enabled ? 'active' : 'offline'}.`,
      };
    }

    case 'REPAIR_WATER_RECYCLER': {
      const recycler = next.modules['water-recycler'];
      next.resources.sparePumps -= 1;
      recycler.status = 'repairing';
      recycler.repairHoursRemaining = RED_STORM_CONFIG.waterRecyclerRepairDurationHours;

      next.events.push({
        id: `evt-act-${next.hour}-${Date.now().toString(36)}`,
        hour: next.hour,
        type: 'REPAIR_COMMENCED',
        severity: 'info',
        moduleId: 'water-recycler',
        message: `Commander dispatched technician to replace pump. 1 spare consumed; estimated completion in ${recycler.repairHoursRemaining} hours.`,
      });

      return {
        ok: true,
        state: next,
        message: 'Water recycler repair started using 1 spare pump.',
      };
    }

    case 'ADVANCE_TIME': {
      const advanced = advanceMission(next, action.hours);
      return { ok: true, state: advanced };
    }

    case 'RESET_MISSION': {
      const reset = createInitialMission(RED_STORM_CONFIG);
      return { ok: true, state: reset, message: 'Mission reset to initial conditions.' };
    }

    case 'REWIND_TO': {
      return { ok: true, state: next };
    }

    default:
      return { ok: false, reason: 'Unrecognized action type.', state };
  }
}

/**
 * Deterministically steps the simulation forward by `hours` time steps.
 */
export function advanceMission(state: MissionState, hours: number): MissionState {
  if (state.status === 'success' || state.status === 'failed') {
    return state;
  }

  const next: MissionState = JSON.parse(JSON.stringify(state));

  for (let step = 0; step < hours; step++) {
    if (next.status === 'success' || next.status === 'failed') {
      break;
    }

    next.hour += 1;

    // 1. Evaluate scheduled events
    for (const evt of RED_STORM_SCHEDULED_EVENTS) {
      if (evt.hour === next.hour && evt.trigger(next)) {
        next.events.push(evt.createEvent(next));
        evt.applyEffect(next);
      }
    }

    // 2. Handle repairs in progress
    const recycler = next.modules['water-recycler'];
    if (recycler.status === 'repairing' && recycler.repairHoursRemaining !== undefined) {
      recycler.repairHoursRemaining -= 1;
      if (recycler.repairHoursRemaining <= 0) {
        recycler.status = 'operational';
        recycler.health = 0.95;
        delete recycler.repairHoursRemaining;
        recycler.powerDemandKw = 1.2;
        recycler.suppliedPowerKw = 1.2;
        next.events.push({
          id: `evt-rep-done-${next.hour}`,
          hour: next.hour,
          type: 'REPAIR_COMPLETED',
          severity: 'info',
          moduleId: 'water-recycler',
          message: 'Water recycler pump replacement complete. Water recovery restored to 0.42 L/h.',
        });
      }
    }

    // 3. Power balance calculation
    const solarGeneration = next.stormActive
      ? RED_STORM_CONFIG.stormSolarGenerationKw
      : RED_STORM_CONFIG.normalSolarGenerationKw;

    let totalDemand = 0;
    for (const mod of Object.values(next.modules)) {
      if (mod.enabled && mod.status !== 'offline') {
        totalDemand += mod.powerDemandKw;
      }
    }

    const netPowerKw = solarGeneration - totalDemand;
    next.resources.batteryKwh = Math.max(
      0,
      Math.min(
        RED_STORM_CONFIG.initialResources.batteryCapacityKwh,
        next.resources.batteryKwh + netPowerKw
      )
    );

    // 4. Water balance calculation
    // With the training model the recovery rate comes from the component state; legacy fixtures keep the old rule.
    const waterRecovery = next.training
      ? getWaterRecoveryLph(next)
      : recycler.status === 'operational' && recycler.enabled
      ? RED_STORM_CONFIG.normalWaterRecoveryLitersPerHour
      : 0;
    const netWaterLoss = RED_STORM_CONFIG.crewWaterUseLitersPerHour - waterRecovery;
    next.resources.waterLiters = Math.max(0, next.resources.waterLiters - netWaterLoss);

    // 5. Oxygen balance calculation
    const lifeSupport = next.modules['life-support'];
    let oxygenGen = 0;
    if (lifeSupport.enabled && lifeSupport.status === 'operational' && next.resources.batteryKwh > 0) {
      oxygenGen = RED_STORM_CONFIG.normalOxygenGenKgPerHour;
    }
    const netOxygenGain = oxygenGen - RED_STORM_CONFIG.crewOxygenUseKgPerHour;
    next.resources.oxygenKg = Math.max(0, next.resources.oxygenKg + netOxygenGain);

    // 5b. Food model (educational): crew eat 0.25 rations/h; lit greenhouse crops add 1/6 ration/h.
    next.resources.foodRations = Math.max(0, next.resources.foodRations - FOOD_USE_PER_HOUR);
    const gh = next.modules['greenhouse'];
    if (gh.enabled && gh.status !== 'offline' && next.resources.batteryKwh > 0) {
      next.resources.foodRations += FOOD_GROWN_PER_LIT_HOUR;
      if (next.training) next.training.cropGrowthHours += 1;
    }
    next.resources.foodRations = Number(next.resources.foodRations.toFixed(3));

    // 6. Science Score progression if research lab is powered
    if (next.modules['research-lab'].enabled && next.resources.batteryKwh > 0) {
      next.scienceScore += 1;
    }

    // 7. Check threshold warnings and failure conditions
    if (next.resources.batteryKwh <= 0) {
      next.status = 'failed';
      next.failureReason =
        'Total electrical power blackout. ECLSS Life Support and Habitat thermal heating collapsed.';
      next.modules['life-support'].status = 'offline';
      next.modules['life-support'].suppliedPowerKw = 0;
      next.modules['battery-bank'].status = 'offline';
      next.events.push({
        id: `evt-fail-power-${next.hour}`,
        hour: next.hour,
        type: 'TOTAL_POWER_EXHAUSTION',
        severity: 'critical',
        message: 'Battery exhausted. Habitat blackout triggered life-support shutdown.',
      });
      break;
    }

    if (next.resources.waterLiters < RED_STORM_CONFIG.waterSafetyThresholdLiters) {
      if (next.resources.waterLiters <= 0) {
        next.status = 'failed';
        next.failureReason = 'Colony water reserves exhausted. Crew hydration failure.';
        next.events.push({
          id: `evt-fail-water-${next.hour}`,
          hour: next.hour,
          type: 'WATER_EXHAUSTION',
          severity: 'critical',
          message: 'Potable water reserve reached 0 L. Mission terminated.',
        });
        break;
      }
    }

    if (next.resources.oxygenKg < RED_STORM_CONFIG.oxygenSafetyThresholdKg) {
      if (next.resources.oxygenKg <= 0) {
        next.status = 'failed';
        next.failureReason = 'Colony oxygen reserves depleted. Asphyxiation hazard.';
        break;
      }
    }

    syncRecyclerModule(next);

    // 8. Check success condition at 72 hours
    if (next.hour >= RED_STORM_CONFIG.durationHours) {
      // Resource-integrity directive (docs/03 §1.2): surviving is not enough if reserves end below safety thresholds.
      const unsafe =
        next.resources.waterLiters < RED_STORM_CONFIG.waterSafetyThresholdLiters
          ? `Water reserve ended at ${next.resources.waterLiters.toFixed(1)} L, below the ${RED_STORM_CONFIG.waterSafetyThresholdLiters} L safety threshold. Crew hydration was no longer safe.`
          : next.resources.oxygenKg < RED_STORM_CONFIG.oxygenSafetyThresholdKg
          ? `Oxygen reserve ended below the ${RED_STORM_CONFIG.oxygenSafetyThresholdKg} kg safety threshold.`
          : next.resources.batteryKwh < RED_STORM_CONFIG.batterySafetyThresholdKwh
          ? `Battery ended below the ${RED_STORM_CONFIG.batterySafetyThresholdKwh} kWh safety reserve.`
          : null;
      if (unsafe) {
        next.status = 'failed';
        next.failureReason = unsafe;
        next.events.push({ id: `evt-fail-reserve-${next.hour}`, hour: next.hour, type: 'RESERVE_BELOW_SAFETY', severity: 'critical', message: unsafe });
        break;
      }
      next.status = 'success';
      next.events.push({
        id: `evt-success-${next.hour}`,
        hour: next.hour,
        type: 'MISSION_ACCOMPLISHED',
        severity: 'info',
        message: 'All 72 hours survived with crew safety and habitat integrity intact.',
      });
      break;
    }
  }

  return next;
}
