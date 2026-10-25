/**
 * Event-driven proactive guidance. Conditions are derived from validated mission state (never from
 * raw per-tick numbers), deduplicated by key, and passed through a priority/cooldown gate.
 * Messages are authored, so common moments need no Gemini call.
 */
import type { MissionState } from '@/simulation/types';
import { getGuidance } from '@/simulation/training/guidance';
import type { NovaEmotion, NovaVisualAction } from './types';

export type EventPriority = 1 | 2 | 3;

export interface NovaEvent {
  key: string;
  priority: EventPriority;
  message: string;
  emotion: NovaEmotion;
  visualAction: NovaVisualAction;
  /** Shows the amber warning state. */
  warning?: boolean;
}

const BATTERY_LOW_KWH = 15;
const WATER_LOW_L = 14;

/** Every proactive condition that is true for this state right now. */
export function deriveEvents(m: MissionState): NovaEvent[] {
  const out: NovaEvent[] = [];
  const stage = getGuidance(m).stage;
  if (m.status === 'success') {
    return [{ key: 'concluded:success', priority: 3, message: 'Mission accomplished. All four crew are safe. Open Mission Autopsy and we can look at which decisions mattered.', emotion: 'encouraging', visualAction: { type: 'point', targetId: 'station:mission-console' } }];
  }
  if (m.status === 'failed') {
    return [{ key: 'concluded:failed', priority: 3, message: 'The mission has stopped for crew safety. That is a result to learn from. Mission Autopsy shows the chain of causes, and you can rewind to try another approach.', emotion: 'concerned', visualAction: { type: 'point', targetId: 'station:mission-console' } }];
  }
  if (m.stormActive && stage === 'power-plan') {
    out.push({ key: 'storm', priority: 2, message: 'Solar energy is decreasing. We should investigate how the habitat uses electricity. I marked the Power Room.', emotion: 'concerned', visualAction: { type: 'point', targetId: 'station:power-console' } });
  }
  if (m.resources.batteryKwh < BATTERY_LOW_KWH) {
    out.push({ key: 'battery-low', priority: 3, message: 'The battery is running low. Check what the habitat is using against what the panels make.', emotion: 'concerned', warning: true, visualAction: { type: 'point', targetId: 'station:power-console' } });
  }
  if (m.resources.waterLiters < WATER_LOW_L) {
    out.push({ key: 'water-low', priority: 3, message: 'Water reserves are getting low. Recovery matters now.', emotion: 'concerned', warning: true, visualAction: { type: 'point', targetId: 'station:water-recycler' } });
  }
  if (m.events.some((e) => e.type === 'WATER_RECOVERY_LOW' || e.type === 'PUMP_MECHANICAL_FAULT')) {
    out.push({ key: 'recovery-low', priority: 3, message: 'Water recovery has dropped below its normal range. Let us find out why, using measurements. The recycler is in Life Support.', emotion: 'concerned', warning: true, visualAction: { type: 'point', targetId: 'station:water-recycler' } });
  }
  const v = m.training?.recycler.procedure.verification;
  if (v && !v.passed) out.push({ key: `verify-failed:${v.hour}`, priority: 2, message: 'The startup test did not pass. Compare each reading with its expected range and think about what they are telling you.', emotion: 'curious', visualAction: { type: 'none' } });
  if (v?.passed) out.push({ key: 'verify-passed', priority: 2, message: 'The readings are back in range. That is how we know the repair worked: measurements, not hope.', emotion: 'encouraging', visualAction: { type: 'show_concept', conceptId: 'verify-with-measurement' } });
  return out;
}

export interface GateConfig {
  /** Minimum gap between proactive messages. */
  cooldownMs: number;
  /** Minimum gap for priority-3 (safety) messages. */
  criticalGapMs: number;
}

export const DEFAULT_GATE: GateConfig = { cooldownMs: 12_000, criticalGapMs: 3_000 };

export type GateDecision = 'deliver' | 'queue' | 'drop';

/** Pure decision: should this event be shown now, held for later, or dropped? */
export function gateDecision(
  ev: Pick<NovaEvent, 'priority'>,
  s: { now: number; lastDeliveredAt: number; interacting: boolean; proactiveEnabled: boolean; busy: boolean },
  cfg: GateConfig = DEFAULT_GATE,
): GateDecision {
  if (!s.proactiveEnabled && ev.priority < 3) return 'drop';
  // Never talk over an active manipulation or over the learner's own conversation.
  if (s.interacting || s.busy) return ev.priority >= 2 ? 'queue' : 'drop';
  const gap = s.now - s.lastDeliveredAt;
  if (ev.priority === 3) return gap >= cfg.criticalGapMs ? 'deliver' : 'queue';
  return gap >= cfg.cooldownMs ? 'deliver' : ev.priority === 2 ? 'queue' : 'drop';
}

/** Tracks which event keys have fired, so repeated state never repeats narration. */
export class EventLedger {
  private seen = new Set<string>();
  /** Marks currently-true conditions as already known (after load, rewind or reset) without narrating them. */
  seed(events: NovaEvent[]) {
    this.seen = new Set(events.map((e) => e.key));
  }
  fresh(events: NovaEvent[]): NovaEvent[] {
    return events.filter((e) => !this.seen.has(e.key));
  }
  mark(key: string) {
    this.seen.add(key);
  }
  clear() {
    this.seen.clear();
  }
}
