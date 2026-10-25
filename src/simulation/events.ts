import type { MissionEvent, MissionState } from './types';
import { getMissionConfig } from './config';
import { syncRecyclerModule } from './training/apply';

/** Mutating helpers are internal to an already cloned transition. */
export function recordEvent(state: MissionState, event: Omit<MissionEvent, 'id' | 'hour'>): MissionEvent {
  const result = { ...event, id: `${state.branchId}:event:${state.events.length}`, hour: state.hour };
  state.events.push(result);
  return result;
}

export interface ScheduledEvent {
  hour: number;
  trigger: (state: MissionState) => boolean;
  createEvent: (state: MissionState) => MissionEvent;
  applyEffect: (state: MissionState) => void;
}

export const RED_STORM_SCHEDULED_EVENTS: ScheduledEvent[] = [
  {
    hour: 0,
    trigger: s => !s.events.some(e => e.type === 'DUST_STORM_ARRIVAL'),
    createEvent: s => ({ id: 'evt-storm-arrival', hour: 0, type: 'DUST_STORM_ARRIVAL', severity: 'warning',
      moduleId: 'solar-array', message: `Dust storm reduces solar generation to ${getMissionConfig(s).stormSolarGenerationKw} kW.` }),
    applyEffect: s => {
      s.stormActive = true;
      s.modules['solar-array'].status = 'warning';
      s.modules['solar-array'].health = 0.65;
    },
  },
  {
    hour: 30,
    // A negative onset marks a forecast copy that assumes no unforeseen faults (training/power.ts).
    trigger: s => !s.events.some(e => e.type === 'PUMP_MECHANICAL_FAULT' || e.type === 'WATER_RECOVERY_LOW')
      && (s.training ? s.training.recycler.faultOnsetHour === null : true),
    createEvent: s => s.training
      // Training missions report the symptom only; the root cause is for the learner to diagnose.
      ? { id: 'evt-recovery-low', hour: 30, type: 'WATER_RECOVERY_LOW', severity: 'critical',
          moduleId: 'water-recycler', message: 'Water recovery rate has fallen below the expected operating range (0.42 L/h nominal). Inspect the water recycler.' }
      : { id: 'evt-pump-fault', hour: 30, type: 'PUMP_MECHANICAL_FAULT', severity: 'critical',
          moduleId: 'water-recycler', message: 'Recycler pump seized. Water recovery is 0 L/h until repair completes.' },
    applyEffect: s => {
      if (s.training) {
        s.training.recycler.faultOnsetHour = s.hour;
        syncRecyclerModule(s);
        return;
      }
      s.modules['water-recycler'].status = 'degraded';
      s.modules['water-recycler'].health = 0.35;
    },
  },
];

export function processScheduledEvents(state: MissionState): void {
  if (state.scenarioId !== 'mission-01-red-storm') return;
  for (const event of RED_STORM_SCHEDULED_EVENTS) {
    if (event.hour === state.hour && event.trigger(state)) {
      state.events.push(event.createEvent(state));
      event.applyEffect(state);
    }
  }
}
