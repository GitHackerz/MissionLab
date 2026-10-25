import 'server-only';
import { createInitialMission } from '@/simulation/engine';
import { createSnapshot, recordMissionAction } from '@/simulation/history';
import { getMissionSummary } from '@/simulation/debrief';
import { RED_STORM_CONFIG } from '@/simulation/config';
import type { MissionAction, MissionSummary } from '@/simulation/types';

/**
 * Sample-class results are produced by running the real deterministic engine,
 * so even demo data shows outcomes the model actually produces.
 */
export type SamplePlan = 'all-on' | 'shed-no-repair' | 'shed-and-repair' | 'late-shed';

const SHED: MissionAction[] = [
  { type: 'SET_ENABLED', moduleId: 'greenhouse', enabled: false },
  { type: 'SET_ENABLED', moduleId: 'research-lab', enabled: false },
];

const PLANS: Record<SamplePlan, Record<number, MissionAction[]>> = {
  'all-on': {},
  'shed-no-repair': { 0: SHED },
  'shed-and-repair': { 0: SHED, 30: [{ type: 'REPAIR_WATER_RECYCLER' }] },
  'late-shed': { 12: SHED, 30: [{ type: 'REPAIR_WATER_RECYCLER' }] },
};

const cache = new Map<SamplePlan, MissionSummary>();

export function simulateSamplePlan(plan: SamplePlan): MissionSummary {
  const cached = cache.get(plan);
  if (cached) return cached;

  let state = createInitialMission(RED_STORM_CONFIG);
  let history = [createSnapshot(state)];
  for (let guard = 0; state.status === 'running' && guard < 200; guard++) {
    for (const action of PLANS[plan][state.hour] ?? []) {
      const step = recordMissionAction(state, history, action);
      if (step.result.ok) {
        state = step.result.state;
        history = step.history;
      }
    }
    const step = recordMissionAction(state, history, { type: 'ADVANCE_TIME', hours: 1 });
    state = step.result.state;
    history = step.history;
  }
  const summary = getMissionSummary(history);
  cache.set(plan, summary);
  return summary;
}
