import { MissionEvent, MissionState } from './types';

export interface ScheduledEvent {
  hour: number;
  trigger: (state: MissionState) => boolean;
  createEvent: (state: MissionState) => MissionEvent;
  applyEffect: (state: MissionState) => void;
}

/**
 * Standard scheduled events for Mission 01: The Red Storm
 */
export const RED_STORM_SCHEDULED_EVENTS: ScheduledEvent[] = [
  {
    hour: 0,
    trigger: (s) => !s.stormActive,
    createEvent: () => ({
      id: 'evt-storm-arrival',
      hour: 0,
      type: 'DUST_STORM_ARRIVAL',
      severity: 'warning',
      moduleId: 'solar-array',
      message: 'Martian dust storm arrived. Solar generation collapsed from 10.0 kW to 4.0 kW.',
    }),
    applyEffect: (s) => {
      s.stormActive = true;
      if (s.modules['solar-array']) {
        s.modules['solar-array'].status = 'warning';
        s.modules['solar-array'].health = 0.65;
      }
    },
  },
  {
    hour: 30,
    trigger: (s) => s.modules['water-recycler'].status === 'operational',
    createEvent: () => ({
      id: 'evt-pump-fault',
      hour: 30,
      type: 'PUMP_MECHANICAL_FAULT',
      severity: 'critical',
      moduleId: 'water-recycler',
      message: 'Water recycler primary distillation pump impeller seized. Water recovery dropped to 0 L/h.',
    }),
    applyEffect: (s) => {
      const recycler = s.modules['water-recycler'];
      if (recycler && recycler.status === 'operational') {
        recycler.status = 'degraded';
        recycler.health = 0.35;
      }
    },
  },
];
