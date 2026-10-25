import type { MissionState } from '../types';
import { getRecyclerOperation } from './recycler';

export type GuidanceStage =
  | 'free'
  | 'power-plan'
  | 'monitor'
  | 'diagnose-start'
  | 'diagnose-conclude'
  | 'plan-repair'
  | 'repair'
  | 'verify'
  | 'retry'
  | 'recovered'
  | 'concluded';

export interface Guidance {
  stage: GuidanceStage;
  objective: string;
  /** Shown to Cadet only. Nudges toward where to look, never the answer. */
  hint?: string;
  /** Short science explanation (Cadet and Engineer). */
  concept?: string;
}

/** Derives the current learning objective purely from authoritative state. */
export function getGuidance(state: MissionState): Guidance {
  const t = state.training;
  const mode = t?.mode ?? 'commander';
  const shape = (g: Guidance): Guidance => ({
    stage: g.stage,
    objective: g.objective,
    hint: mode === 'cadet' ? g.hint : undefined,
    concept: mode === 'commander' ? undefined : g.concept,
  });

  if (state.status === 'success' || state.status === 'failed') {
    return shape({ stage: 'concluded', objective: 'Mission over. Open the Debrief to see what your decisions caused, then rewind to try a different approach.' });
  }
  if (!t) return shape({ stage: 'free', objective: 'Keep all four crew safe for 72 hours.' });

  const r = t.recycler;
  const p = r.procedure;
  const op = getRecyclerOperation(state);

  if (r.faultOnsetHour === null) {
    if (t.powerPlanAppliedHour === null) {
      return shape({
        stage: 'power-plan',
        objective: 'A dust storm cut solar power to 4.0 kW. Work out which systems the colony can afford to run, then apply a power plan.',
        hint: 'Open the Power tab. Which loads keep people alive, and which only help the mission goals?',
        concept: 'Batteries only store energy that panels already made. If demand is higher than generation, the battery drains.',
      });
    }
    return shape({
      stage: 'monitor',
      objective: 'Power plan applied. Advance time and watch the battery and water trends. Be ready to investigate any new warning.',
      hint: 'Use +1h or +6h and compare the battery with your forecast.',
      concept: 'A forecast is only a prediction. Checking it against what really happens is how engineers find problems early.',
    });
  }

  if (p.phase === 'completed' && !op.activeFault) {
    return shape({ stage: 'recovered', objective: 'Water recovery is back in range. Keep the colony running to the end of the mission and then review your debrief.', concept: 'Verifying with measurements is what proves a repair worked.' });
  }
  if (p.verification && !p.verification.passed && p.phase === 'failed-verification') {
    return shape({
      stage: 'retry',
      objective: 'The startup test did not pass. Look at the readings again: what do they say is still wrong?',
      hint: 'Compare each reading with its expected range. Is the part you replaced the one the evidence pointed to?',
      concept: 'If a measurement is still wrong after a repair, the root cause was not fixed.',
    });
  }
  if (p.testReady) {
    return shape({ stage: 'verify', objective: 'Run the startup test and compare each reading with its expected range.', hint: 'The test is on the control panel.', concept: 'A repair is only finished when measurements return to normal.' });
  }
  if (p.maintenanceMode || p.hatchOpen || p.held) {
    return shape({
      stage: 'repair',
      objective: 'Service the unit: make it safe, pick the right tools, swap the part your evidence points to, secure it and close up.',
      hint: 'The checklist shows what is done. Some steps need a specific tool.',
      concept: 'Equipment is stopped and confirmed inactive before anyone opens it. The clock keeps running, so water recovery is zero while the unit is down.',
    });
  }
  if (t.hypotheses.length > 0) {
    return shape({
      stage: 'plan-repair',
      objective: 'You have a diagnosis. Decide whether to service the unit, which part to replace, and whether you have the spare and the time.',
      hint: 'Check the spare parts count and what the repair costs in hours and water.',
      concept: 'Planning compares the cost of acting with the cost of waiting.',
    });
  }
  if (t.evidence.length === 0) {
    return shape({
      stage: 'diagnose-start',
      objective: 'Water recovery has dropped below the expected range. Find out why without guessing: inspect the recycler and collect measurements.',
      hint: 'Select the recycler, open its service view, and run a diagnostic test. Each test takes simulated time.',
      concept: 'A symptom (low recovery) can have several different causes. Evidence tells them apart.',
    });
  }
  return shape({
    stage: 'diagnose-conclude',
    objective: 'Compare your readings. Which part best explains all of them? Record your diagnosis with the evidence that supports it.',
    hint: 'Does the pump turn? Is pressure building? Does the sensor agree with the clean tank?',
    concept: 'A good diagnosis fits every measurement, not just one.',
  });
}
