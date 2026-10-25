import type { MissionState } from '@/simulation/types';
import { getGuidance } from '@/simulation/training/guidance';
import type { RoomId } from './world/layout';

export type ObjectiveStatus = 'available' | 'active' | 'completed' | 'failed' | 'retry';
export function getObjectives(state: MissionState) {
  const t = state.training;
  const power = t?.powerPlanAppliedHour != null;
  const fault = t?.recycler.faultOnsetHour != null;
  const diagnosis = (t?.hypotheses.length ?? 0) > 0;
  const verification = t?.recycler.procedure.verification;
  const ended = state.status !== 'running';
  const status = (complete: boolean, active: boolean, retry = false): ObjectiveStatus => complete ? 'completed' : ended ? 'failed' : retry ? 'retry' : active ? 'active' : 'available';
  return [
    { id: 'power', title: 'Investigate energy and apply a power plan', destination: 'Power Room · east', status: status(power, true) },
    { id: 'observe', title: 'Observe the station as time passes', destination: 'Explore / use Wait', status: status(fault, power) },
    { id: 'diagnose', title: 'Collect evidence and record a diagnosis', destination: 'Life Support · west', status: status(diagnosis, fault) },
    { id: 'repair', title: 'Intervene safely and verify the result', destination: 'Water Recycler', status: status(Boolean(verification?.passed), diagnosis, Boolean(verification && !verification.passed)) },
    { id: 'survive', title: `Keep the crew safe through hour ${state.durationHours}`, destination: 'Mission Control / Autopsy', status: status(state.status === 'success', Boolean(verification?.passed)) },
  ];
}
export function getPlayerObjective(state: MissionState, room: RoomId | null) {
  const stage = getGuidance(state).stage;
  if (state.status !== 'running') return { title: state.status === 'success' ? 'Mission accomplished' : 'Mission stopped', detail: 'Review the outcome and trace your decisions in Mission Autopsy. Rewind to test another approach.', destination: 'Mission Autopsy', wait: false };
  if (stage === 'power-plan') return { title: 'Investigate the energy shortage', detail: room === 'power' ? 'Approach the distribution board and press E. Compare generation, demand and the forecast before applying a plan.' : 'Solar supply has dropped. Visit the Power Room and investigate which systems the station can afford to run.', destination: 'Power Room · east →', wait: false };
  if (stage === 'monitor' || stage === 'recovered') return { title: stage === 'monitor' ? 'Observe the consequences' : 'Keep the habitat running', detail: stage === 'monitor' ? 'Inspect affected rooms, then use Wait to advance mission time. Watch for a new equipment warning.' : 'The startup test passed. Wait and monitor the station through the end of the mission.', destination: 'Explore · Mission Control north ↑', wait: true };
  const titles: Record<string, string> = { 'diagnose-start': 'Investigate low water recovery', 'diagnose-conclude': 'Explain the measurements', 'plan-repair': 'Plan a safe intervention', repair: 'Complete the intervention', verify: 'Verify the repair', retry: 'Reconsider the diagnosis' };
  return { title: titles[stage] ?? 'Investigate the habitat', detail: room === 'life-support' ? 'Approach the water recycler and press E. The workbench shows the current investigation or repair action.' : 'Find the water recycler in Life Support. Use measurements to explain the warning before replacing a part.', destination: 'Life Support · west ←', wait: false };
}
