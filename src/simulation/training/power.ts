/**
 * Power-plan learning activity: the learner proposes which loads stay on, the
 * REAL engine is run on a copy of the state to forecast consequences, and only
 * then is the plan applied. No separate model, so forecast and outcome agree.
 */
import type { MissionState, MissionStatus } from '../types';
import { RED_STORM_CONFIG } from '../config';
import { syncRecyclerModule, type AdvanceFn } from './apply';
import type { PlanLoadId } from './types';

export interface PlanLoad {
  id: PlanLoadId;
  label: string;
  category: 'critical' | 'essential' | 'optional';
  /** Teaching note shown next to the switch. */
  why: string;
}

export const PLAN_LOADS: PlanLoad[] = [
  { id: 'life-support', label: 'Life support (ECLSS)', category: 'critical', why: 'Makes oxygen and scrubs CO2. Without it the crew has a few hours of air.' },
  { id: 'water-recycler', label: 'Water recycler', category: 'essential', why: 'Recovers about 84% of used water. Switching it off drains the tank faster.' },
  { id: 'greenhouse', label: 'Greenhouse lighting', category: 'optional', why: 'Plants need light to grow food. Switching it off saves power now but food comes only from stored rations.' },
  { id: 'research-lab', label: 'Research laboratory', category: 'optional', why: 'Science is the mission goal, but it is the first thing to pause in an emergency.' },
];

export type PlanRiskSeverity = 'critical' | 'warning' | 'info';

export interface ForecastSample {
  hour: number;
  batteryKwh: number;
  waterLiters: number;
  oxygenKg: number;
  foodRations: number;
}

export interface PowerForecast {
  plan: Record<PlanLoadId, boolean>;
  generationKw: number;
  demandKw: number;
  netKw: number;
  samples: ForecastSample[];
  outcome: MissionStatus;
  endHour: number;
  failureReason?: string;
  minBatteryKwh: number;
  risks: { severity: PlanRiskSeverity; text: string }[];
  cropGrowthHours: number;
}

export function currentPlan(state: MissionState): Record<PlanLoadId, boolean> {
  return {
    'life-support': state.modules['life-support'].enabled,
    'water-recycler': state.modules['water-recycler'].enabled,
    greenhouse: state.modules.greenhouse.enabled,
    'research-lab': state.modules['research-lab'].enabled,
  };
}

/** Pure: returns a copy of the state with the proposed switches applied. */
export function applyPlanToState(state: MissionState, loads: Partial<Record<PlanLoadId, boolean>>): MissionState {
  const next: MissionState = JSON.parse(JSON.stringify(state));
  for (const [id, enabled] of Object.entries(loads) as [PlanLoadId, boolean][]) {
    const mod = next.modules[id];
    if (!mod || mod.enabled === enabled) continue;
    mod.enabled = enabled;
    mod.status = enabled ? 'operational' : 'offline';
    mod.suppliedPowerKw = enabled ? mod.powerDemandKw : 0;
    next.events.push({
      id: `evt-plan-${next.hour}-${id}`,
      hour: next.hour,
      type: enabled ? 'MODULE_ENABLED' : 'MODULE_SUSPENDED',
      severity: 'info',
      moduleId: id,
      message: `${mod.name} ${enabled ? 'resumed' : 'suspended'} by power plan.`,
    });
  }
  if (next.training) {
    next.training.powerPlanAppliedHour = next.hour;
    syncRecyclerModule(next);
  }
  return next;
}

export function forecastPowerPlan(state: MissionState, loads: Partial<Record<PlanLoadId, boolean>>, advance: AdvanceFn): PowerForecast {
  const start = applyPlanToState(state, loads);
  // A forecast cannot know about faults that have not happened yet: assume equipment keeps working.
  if (start.training && start.training.recycler.faultOnsetHour === null) start.training.recycler.faultOnsetHour = -1;
  const plan = currentPlan(start);
  const generationKw = start.stormActive ? RED_STORM_CONFIG.stormSolarGenerationKw : RED_STORM_CONFIG.normalSolarGenerationKw;
  let demandKw = 0;
  for (const m of Object.values(start.modules)) if (m.enabled && m.status !== 'offline') demandKw += m.powerDemandKw;

  const samples: ForecastSample[] = [];
  const push = (s: MissionState) =>
    samples.push({ hour: s.hour, batteryKwh: s.resources.batteryKwh, waterLiters: s.resources.waterLiters, oxygenKg: s.resources.oxygenKg, foodRations: s.resources.foodRations });
  let cur = start;
  push(cur);
  let guard = 0;
  while (cur.status === 'running' && guard++ < 200) {
    cur = advance(cur, 1);
    push(cur);
  }

  const risks: PowerForecast['risks'] = [];
  const minBatteryKwh = Math.min(...samples.map((s) => s.batteryKwh));
  const belowReserve = samples.find((s) => s.batteryKwh < RED_STORM_CONFIG.batterySafetyThresholdKwh);
  if (!plan['life-support']) risks.push({ severity: 'critical', text: 'Life support is off: oxygen is no longer generated. The crew uses 0.14 kg of oxygen every hour, so the supply will not last the mission.' });
  if (!plan['water-recycler']) risks.push({ severity: 'warning', text: 'Water recycler is off: no water is recovered, so the tank drains at the full crew rate (0.50 L/h).' });
  if (belowReserve) risks.push({ severity: cur.status === 'failed' ? 'critical' : 'warning', text: `Battery falls below the ${RED_STORM_CONFIG.batterySafetyThresholdKwh} kWh safety reserve at hour ${belowReserve.hour}.` });
  if (!plan.greenhouse) risks.push({ severity: 'info', text: 'Greenhouse is dark: no crop growth. Food now comes only from stored rations (a long-term sustainability cost).' });
  if (!plan['research-lab']) risks.push({ severity: 'info', text: 'Research is paused: science points stop accumulating, but life-critical systems keep their power.' });
  if (cur.status === 'failed' && cur.failureReason) risks.push({ severity: 'critical', text: cur.failureReason });
  if (cur.status === 'success' && !risks.some((r) => r.severity === 'critical')) risks.push({ severity: 'info', text: 'Crew survives to the end of the mission in this forecast, assuming no new equipment faults.' });

  return {
    plan,
    generationKw,
    demandKw: Number(demandKw.toFixed(2)),
    netKw: Number((generationKw - demandKw).toFixed(2)),
    samples,
    outcome: cur.status,
    endHour: cur.hour,
    failureReason: cur.failureReason,
    minBatteryKwh: Number(minBatteryKwh.toFixed(1)),
    risks,
    cropGrowthHours: cur.training?.cropGrowthHours ?? 0,
  };
}
