import { getMissionConfig } from './config';
import type { AvailableAction, MissionAction, MissionState } from './types';

/**
 * Determine which player actions are currently valid in the given simulation state.
 */
export function getAvailableActions(state: MissionState): AvailableAction[] {
  const actions: AvailableAction[] = [];
  const config = getMissionConfig(state);

  // If mission has already terminated, no in-world actions are available
  if (state.status === 'success' || state.status === 'failed') {
    return actions;
  }

  // 1. Greenhouse toggle
  const gh = state.modules['greenhouse'];
  actions.push({
    id: 'toggle-greenhouse',
    type: 'SET_ENABLED',
    label: gh.enabled ? 'Suspend Greenhouse Lighting' : 'Restore Greenhouse Operation',
    description: gh.enabled
      ? 'Saves 2.5 kW by pausing hydroponic lighting. May lower end-mission agricultural score.'
      : 'Restores 2.5 kW power load to continue crop cultivation.',
    enabled: true,
    powerDeltaKw: gh.enabled ? -2.5 : 2.5,
    payload: {
      type: 'SET_ENABLED',
      moduleId: 'greenhouse',
      enabled: !gh.enabled,
    },
  });

  // 2. Research Lab toggle
  const lab = state.modules['research-lab'];
  actions.push({
    id: 'toggle-research-lab',
    type: 'SET_ENABLED',
    label: lab.enabled ? 'Pause Scientific Research' : 'Resume Scientific Research',
    description: lab.enabled
      ? 'Saves 1.5 kW by pausing sample spectrometers and computation.'
      : 'Restores 1.5 kW load to resume science mission objectives.',
    enabled: true,
    powerDeltaKw: lab.enabled ? -1.5 : 1.5,
    payload: {
      type: 'SET_ENABLED',
      moduleId: 'research-lab',
      enabled: !lab.enabled,
    },
  });

  // 3. Repair Water Recycler
  const recycler = state.modules['water-recycler'];
  const hasSpare = state.resources.sparePumps > 0;
  const isDamaged = (recycler.status === 'degraded' || recycler.status === 'offline') && recycler.health < 0.5;
  const isAlreadyRepairing = recycler.status === 'repairing';

  actions.push({
    id: 'repair-water-recycler',
    type: 'REPAIR_WATER_RECYCLER',
    label: isAlreadyRepairing ? 'Repair in Progress' : 'Repair Water Recycler',
    description: isAlreadyRepairing
      ? `Technician actively replacing pump (${recycler.repairHoursRemaining ?? 0}h remaining).`
      : hasSpare
      ? `Consumes 1 spare pump assembly. Requires ${config.waterRecyclerRepairDurationHours} simulated hours of technician work.`
      : 'Cannot repair: No spare pump assemblies remaining in habitat inventory.',
    enabled: isDamaged && hasSpare && !isAlreadyRepairing,
    disabledReason: isAlreadyRepairing ? 'Repair is already in progress.' : !isDamaged
      ? 'Recycler is already operating nominally.'
      : !hasSpare
      ? 'No spare pump assemblies available.'
      : isAlreadyRepairing
      ? 'Repair is already in progress.'
      : undefined,
    costSparePumps: 1,
    durationHours: config.waterRecyclerRepairDurationHours,
    payload: {
      type: 'REPAIR_WATER_RECYCLER',
    },
  });

  // 4. Advance Time
  actions.push({
    id: 'advance-time-1h',
    type: 'ADVANCE_TIME',
    label: 'Advance Simulation (+1h)',
    description: 'Simulates habitat physical processes and resource consumption for 1 hour.',
    enabled: true,
    durationHours: 1,
    payload: {
      type: 'ADVANCE_TIME',
      hours: 1,
    },
  });

  actions.push({
    id: 'advance-time-6h',
    type: 'ADVANCE_TIME',
    label: 'Fast-Forward (+6h)',
    description: 'Simulates physical processes for 6 consecutive hours.',
    enabled: true,
    durationHours: 6,
    payload: {
      type: 'ADVANCE_TIME',
      hours: 6,
    },
  });

  return actions;
}

/**
 * Validates whether a specific action can be applied to the given state.
 */
export function validateAction(
  state: MissionState,
  action: MissionAction
): { valid: boolean; reason?: string } {
  if (state.status === 'success' || state.status === 'failed') {
    if (action.type !== 'REWIND_TO' && action.type !== 'RESET_MISSION') {
      return { valid: false, reason: 'Mission has concluded. Use Rewind or Reset to continue.' };
    }
  }

  switch (action.type) {
    case 'SET_ENABLED': {
      if (!['greenhouse', 'research-lab'].includes(action.moduleId) || typeof action.enabled !== 'boolean') {
        return { valid: false, reason: 'Only greenhouse and research-lab accept a boolean enabled value.' };
      }
      const mod = state.modules[action.moduleId];
      if (!mod) {
        return { valid: false, reason: `Unknown module: ${action.moduleId}` };
      }
      return { valid: true };
    }

    case 'REPAIR_WATER_RECYCLER': {
      const recycler = state.modules['water-recycler'];
      if (recycler.status === 'repairing') {
        return { valid: false, reason: 'Repair is already underway.' };
      }
      if (!['degraded', 'offline'].includes(recycler.status) || recycler.health >= 0.5) {
        return { valid: false, reason: 'Water recycler is operating nominally.' };
      }
      if (state.resources.sparePumps <= 0) {
        return { valid: false, reason: 'No spare pumps available in inventory.' };
      }
      return { valid: true };
    }

    case 'ADVANCE_TIME': {
      if (!Number.isSafeInteger(action.hours) || action.hours <= 0) {
        return { valid: false, reason: 'Advance duration must be a positive safe integer of hours.' };
      }
      return { valid: true };
    }

    case 'REWIND_TO': {
      if (!Number.isSafeInteger(action.hour) || action.hour < 0 || action.hour > state.hour) {
        return { valid: false, reason: 'Rewind target must be between Hour 0 and current hour.' };
      }
      return { valid: true };
    }

    case 'RESET_MISSION':
      return { valid: true };

    default:
      return { valid: false, reason: 'Unrecognized action type.' };
  }
}
