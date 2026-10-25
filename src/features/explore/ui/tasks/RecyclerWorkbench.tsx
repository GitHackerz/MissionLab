'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronRight, Droplets, Lightbulb, Wrench, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';
import { useMissionStore } from '@/state/missionStore';
import { useExploreStore } from '../../store';
import { COMPONENT_INFO, DIAGNOSTIC_TESTS, FAULT_LABEL, MINUTES, NOMINAL_RECOVERY_LPH, PART_LABEL, getRecyclerOperation } from '@/simulation/training/recycler';
import type { Measurement, RecyclerComponentId, RecyclerFaultKind, TrainingAction } from '@/simulation/training/types';
import { nextRepairInstruction, proposedPart, REPAIR_STEPS } from './recyclerWorkflow';
import { soundManager } from '@/features/audio/soundManager';

function Readings({ readings }: { readings: Measurement[] }) {
  return (
    <table className="instrument-readings w-full text-xs">
      <thead>
        <tr className="text-left text-stone-400">
          <th className="py-2 font-normal">Measurement</th>
          <th className="text-right font-normal">Actual / expected</th>
        </tr>
      </thead>
      <tbody>
        {readings.map((r) => (
          <tr key={r.id} className="border-t border-white/10">
            <td className="py-2 pr-2 text-stone-200">{r.label}</td>
            <td className={`py-2 text-right font-mono ${r.inRange ? 'text-emerald-200' : 'text-amber-200'}`}>
              <span>{r.value} {r.unit} {r.inRange ? '✓' : '▲'}</span>
              <div className="mt-1 text-[11px] text-stone-400">{r.expectedMin}–{r.expectedMax} {r.unit}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const FAULTS: RecyclerFaultKind[] = ['pump-seized', 'filter-clogged', 'sensor-drift'];

const FAULT_DETAILS: Record<RecyclerFaultKind, { symptom: string; mechanism: string }> = {
  'pump-seized': {
    symptom: '0 rpm rotation, high power draw (0.9 kW), zero pressure difference across filter.',
    mechanism: 'Mechanical bearing seizure locks the impeller rotor; electrical power is dissipated as stall heat.',
  },
  'filter-clogged': {
    symptom: 'Normal pump speed, high inlet pressure (320 kPa) and low outlet pressure (105 kPa).',
    mechanism: 'Particulate obstruction creates a massive 215 kPa pressure drop, restricting downstream flow to 0.105 L/h.',
  },
  'sensor-drift': {
    symptom: 'Sensor reports 0.10 L/h, but clean tank independent inflow confirms nominal 0.42 L/h.',
    mechanism: 'Flow sensor transducer calibration failure; physical filtration and water recovery remain fully functional.',
  },
};

const PURPOSE: Record<RecyclerComponentId, string> = {
  'wastewater-tank': 'Collects used hygiene water & atmospheric condensate',
  'pump-cartridge': 'Pumps pressurized water through filtration stages',
  'filter-cartridge': 'Traps micro-particles, sediment, and organic solids',
  'treatment-stage': 'Catalytic oxidation & UV purification stage',
  'flow-sensor': 'Measures clean water output recovery rate (L/h)',
  'clean-tank': 'Stores certified potable water for the crew',
  'service-hatch': 'Pressure-sealed door protecting cartridge bays',
  'control-panel': 'Electrical isolation, startup testing, and diagnostics',
};

export function RecyclerWorkbench() {
  const mission = useMissionStore((s) => s.missionState);
  const act = useMissionStore((s) => s.applyAction);
  const selected = useMissionStore((s) => s.selectedComponentId);
  const select = useMissionStore((s) => s.selectComponent);
  const feedback = useMissionStore((s) => s.lastFeedback);
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [hypothesis, setHypothesis] = useState<RecyclerFaultKind | null>(null);
  const [reviewEvidence, setReviewEvidence] = useState(false);

  const t = mission.training;
  if (!t) return <p className="p-5 text-sm">This fixture has no training model. Start The Red Storm to use the workbench.</p>;

  const p = t.recycler.procedure;
  const part = proposedPart(mission);
  const operation = getRecyclerOperation(mission);
  const diagnosis = t.hypotheses.at(-1);
  const next = nextRepairInstruction(mission);
  const concluded = mission.status !== 'running';
  const repairing =
    ['preparing', 'intervention', 'verifying'].includes(p.phase) ||
    p.maintenanceMode ||
    p.hatchOpen ||
    p.testReady ||
    (p.phase === 'diagnosis-recorded' && p.completedSteps.includes('identify-equipment'));
  const result = p.verification && (p.phase === 'completed' || p.phase === 'failed-verification');
  const stage = reviewEvidence
    ? 'Investigate'
    : result
    ? 'Reflect'
    : repairing
    ? p.testReady
      ? 'Verify'
      : 'Execute'
    : diagnosis
    ? 'Plan'
    : t.evidence.length
    ? 'Understand'
    : t.inspectedComponents.length
    ? 'Investigate'
    : 'Discover';

  const send = (action: TrainingAction) => {
    soundManager.playToolAction();
    const outcome = act(action);
    if (outcome.ok && action.type === 'TRAINING_STEP' && action.step.step === 'IDENTIFY_EQUIPMENT') {
      select(proposedPart(outcome.state));
    }
    if (outcome.ok && action.type === 'TRAINING_STEP' && action.step.step === 'RUN_STARTUP_TEST') {
      if (outcome.state.training?.recycler.procedure.verification?.passed) {
        soundManager.playSuccess();
      } else {
        soundManager.playWarning();
      }
    }
    if (outcome.ok && action.type !== 'RUN_DIAGNOSTIC' && action.type !== 'INSPECT_COMPONENT') {
      setReviewEvidence(false);
    }
  };

  const inspect = (id: RecyclerComponentId) => {
    soundManager.playClick();
    select(id);
    send({ type: 'INSPECT_COMPONENT', componentId: id });
  };

  const spareCount =
    part === 'pump-cartridge'
      ? mission.resources.sparePumps
      : part === 'filter-cartridge'
      ? t.inventory.filterCartridges
      : t.inventory.flowSensors;
  const diagnosticView =
    reviewEvidence || (!repairing && !diagnosis && (t.inspectedComponents.length > 0 || t.evidence.length > 0));
  const readings = t.evidence.at(-1)?.readings ?? [];
  const firstRepair = t.log.find((e) => e.ok && e.action === 'IDENTIFY_EQUIPMENT');
  const elapsed = firstRepair
    ? Math.round((mission.hour - firstRepair.hour) * 60 + t.minuteOfHour - firstRepair.minute)
    : null;
  const incompatible = p.held && p.held.part !== part;
  const otherEmpty = Object.entries(p.slots).some(([id, slot]) => id !== part && slot.occupant === 'empty');
  const partsTaken = t.log.filter((e) => e.ok && e.action.startsWith('TAKE_SPARE:')).length;

  return (
    <div className="workbench space-y-4 p-5 text-sm">
      <header className="border-b border-white/10 pb-4">
        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-sky-200">
          <span>{stage} / Water systems</span>
          <span>H{mission.hour}:{String(t.minuteOfHour).padStart(2, '0')}</span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-stone-300">
          <Droplets size={15} className="text-cyan-300" />
          <span>
            {operation.reason === 'blackout'
              ? 'Insufficient electrical supply'
              : operation.reason === 'maintenance'
              ? 'Isolated for maintenance'
              : operation.reason === 'switched-off'
              ? 'Electrical load switched off'
              : `Recovery ${operation.recoveryLph.toFixed(2)} L/h · expected ${NOMINAL_RECOVERY_LPH} L/h`}
          </span>
        </div>
      </header>

      {concluded && (
        <div className="rounded border border-amber-300/40 bg-amber-950/30 p-4">
          <h3 className="font-semibold">The mission has ended</h3>
          <p className="mt-2 text-sm text-stone-300">
            Equipment actions are locked. Review the outcome and rewind a decision to try another approach.
          </p>
          <button
            className="game-button mt-3"
            onClick={() => {
              soundManager.playClick();
              useExploreStore.getState().openDebrief();
            }}
          >
            Open Mission Autopsy
          </button>
        </div>
      )}

      {(operation.reason === 'blackout' || operation.reason === 'switched-off') && (
        <p className="rounded border border-amber-300/30 p-3 text-sm text-amber-100">
          This machine lacks operating power. Check its circuit in the Power Room before interpreting a stopped pump as an internal fault.
        </p>
      )}

      {(incompatible || otherEmpty) && (
        <div className="rounded border border-amber-300/40 p-4 text-sm text-amber-100">
          <p>
            {incompatible
              ? 'The spare in your hand does not match the component in your diagnosis.'
              : 'Another bay was emptied during this intervention.'}{' '}
            This simplified procedure cannot return a removed original cartridge. Use the recorded maintenance decision to rewind and try a different intervention; parts and time stay recorded on this branch.
          </p>
          <button
            className="game-button mt-3 w-full"
            onClick={() => {
              soundManager.playClick();
              useExploreStore.getState().openDebrief();
            }}
          >
            Review and rewind this intervention
          </button>
        </div>
      )}

      {/* STAGE 7: Reflect & Learn */}
      {!reviewEvidence && result ? (
        <section aria-label="Repair result" className="space-y-4">
          <div
            className={`rounded border p-4 ${
              p.verification!.passed ? 'border-emerald-300/40 bg-emerald-950/25' : 'border-amber-300/40 bg-amber-950/25'
            }`}
          >
            <div className="flex items-center gap-2">
              {p.verification!.passed ? (
                <ShieldCheck size={20} className="text-emerald-400" />
              ) : (
                <AlertTriangle size={20} className="text-amber-400" />
              )}
              <h3 className="text-xl font-semibold">
                {p.verification!.passed ? 'Water recovery restored' : 'The startup test did not pass'}
              </h3>
            </div>
            <p className="mt-2 leading-relaxed text-stone-300">
              {p.verification!.passed
                ? 'The instrument readings are back in range. Measurements, rather than the replacement animation, prove the repair worked.'
                : 'A replacement alone does not prove the diagnosis. Compare the measurements and reconsider which component explains the symptom.'}
            </p>
          </div>
          <p className="text-xs text-stone-400">
            Startup measurements recorded at hour {p.verification!.hour}. Compare them with the expected ranges below.
          </p>
          <Readings readings={p.verification!.readings} />
          {p.verification!.remainingIssues.map((issue) => (
            <p key={issue} className="text-amber-200">
              {issue}
            </p>
          ))}
          {p.verification!.passed && (
            <>
              <div className="rounded border border-white/10 bg-black/30 p-3 space-y-2 text-xs">
                <p className="text-stone-200">
                  <b>{t.recycler.faultOnsetHour === null ? 'Baseline check:' : 'Root cause:'}</b>{' '}
                  {t.recycler.faultOnsetHour === null
                    ? 'No fault had occurred; measurements confirm nominal operation. Keep monitoring.'
                    : `${FAULT_LABEL[t.recycler.faultKind]}.`}{' '}
                  Your replacement was {PART_LABEL[part].toLowerCase()}.
                </p>
                <p className="text-stone-400">
                  {elapsed !== null ? `${elapsed} simulated minutes since identification · ` : ''}
                  {partsTaken} spare part{partsTaken === 1 ? '' : 's'} taken this mission. The colony now recovers{' '}
                  {operation.recoveryLph.toFixed(2)} L/h; crew water use and oxygen processing still consume water.
                </p>
              </div>
              <p className="rounded bg-sky-950/40 p-3 leading-relaxed text-sky-100 text-xs">
                <strong>Engineering lesson:</strong> A single symptom (low water output) can stem from multiple independent causes (pump seizure, filter blockage, or sensor drift). Only systematic telemetry diagnostics ensure you replace the correct component on Mars without wasting precious spare parts.
              </p>
            </>
          )}
          {!p.verification!.passed && (
            <>
              <button
                disabled={concluded}
                className="game-button w-full"
                onClick={() => send({ type: 'TRAINING_STEP', step: { step: 'RESTORE_TEST_READY' } })}
              >
                Prepare verification-only retest
              </button>
              <p className="text-xs text-stone-400">
                If power was the problem, restore the circuit in the Power Room before testing again. A retest still fails if the fault remains.
              </p>
              <button className="game-button w-full" onClick={() => setReviewEvidence(true)}>
                Review evidence and diagnosis
              </button>
              <button
                disabled={concluded}
                className="workbench-action"
                onClick={() => send({ type: 'TRAINING_STEP', step: { step: 'ENTER_MAINTENANCE_MODE' } })}
              >
                Begin another safe intervention
              </button>
              <p className="text-xs text-stone-400">
                Used spares stay consumed. A new attempt uses the same validated procedure and the latest diagnosis.
              </p>
            </>
          )}
          <button
            className="workbench-action"
            onClick={() => {
              soundManager.playClick();
              useExploreStore.getState().endTask();
            }}
          >
            Return to habitat <ChevronRight size={17} />
          </button>
        </section>
      ) : !reviewEvidence && repairing ? (
        /* STAGE 5: Perform (Guided 16-step maintenance) */
        <section aria-label="Current repair instruction" className="space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>
              {p.testReady
                ? 'Verify operation'
                : next && next.index < 6
                ? 'Step 1: Safe Equipment Isolation'
                : 'Step 2: Component Replacement & Securing'}
            </span>
            <span className="font-mono text-sky-300">
              Step {p.completedSteps.length} of 16
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-300 transition-all duration-300"
              style={{ width: `${(p.completedSteps.length / 16) * 100}%` }}
            />
          </div>
          {next ? (
            <>
              <h3 className="text-2xl font-semibold leading-tight">{next.title}</h3>
              <p className="leading-relaxed text-stone-300">{next.instruction}</p>
              <div className="rounded border border-sky-300/20 bg-sky-950/25 p-3 text-sm text-sky-100 flex items-center justify-between">
                <div>
                  <span className="font-semibold">Target Bay: {PART_LABEL[part]}</span>
                  <div className="text-xs text-stone-300 mt-0.5">
                    {p.held
                      ? `In hand: ${PART_LABEL[p.held.part]} (${p.held.orientation}° notch)`
                      : p.tool
                      ? `Active tool: ${p.tool.replace(/-/g, ' ')}`
                      : 'No tool or part in hand'}
                  </div>
                </div>
                <Wrench size={18} className="text-sky-300 shrink-0" />
              </div>
              <button
                data-testid="current-engine-action"
                disabled={concluded}
                className="workbench-action"
                onClick={() => send(next.action)}
              >
                <span>{next.label}</span>
                <ChevronRight size={17} />
              </button>
              {t.mode === 'cadet' && (
                <p className="flex gap-2 text-xs leading-relaxed text-amber-100">
                  <Lightbulb size={15} className="shrink-0 text-amber-300" />
                  Cadet Guide: You can also click the highlighted part in the 3D viewport. The button executes the identical validated step.
                </p>
              )}
            </>
          ) : (
            <p>Review the current readings and procedure log below.</p>
          )}
          <details className="workbench-details">
            <summary>Procedure checklist · review all 16 instructions</summary>
            <ol className="mt-3 space-y-2">
              {REPAIR_STEPS.map((step, i) => (
                <li key={step.id} className="text-xs flex items-start gap-2">
                  <span className={p.completedSteps.includes(step.id) ? 'text-emerald-300 font-bold' : 'text-stone-500'}>
                    {p.completedSteps.includes(step.id) ? '✓' : '○'}
                  </span>
                  <div>
                    <span className={p.completedSteps.includes(step.id) ? 'text-emerald-200' : 'text-stone-300'}>
                      {i + 1}. {step.title}
                    </span>
                    <p className="text-[11px] text-stone-400 mt-0.5">{step.instruction}</p>
                  </div>
                </li>
              ))}
            </ol>
          </details>
          <details className="workbench-details">
            <summary>Need help or need to abort?</summary>
            <p className="mt-3 text-xs leading-relaxed text-stone-300">
              Pressing Esc exits this focused screen without resetting the procedure. Your progress, open bays, and parts remain intact. Aborting requests a safe return to service; the engine rejects it if the machine cannot safely close.
            </p>
            <button
              disabled={concluded}
              className="game-button mt-3"
              onClick={() => send({ type: 'TRAINING_STEP', step: { step: 'ABORT_PROCEDURE' } })}
            >
              Request safe return to service
            </button>
          </details>
        </section>
      ) : !reviewEvidence && diagnosis ? (
        /* STAGE 4: Plan Maintenance */
        <section aria-label="Intervention plan" className="space-y-4">
          <h3 className="text-2xl font-semibold">Plan your intervention</h3>
          <p className="leading-relaxed text-stone-300">
            Your diagnosis is <b className="text-white">{FAULT_LABEL[diagnosis.kind].toLowerCase()}</b>. The proposed replacement is the{' '}
            <b className="text-white">{PART_LABEL[part].toLowerCase()}</b>.
          </p>
          <div className="rounded border border-white/15 p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span>Compatible spares in habitat stock:</span>
              <strong className={`font-mono text-base ${spareCount > 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                {spareCount} available
              </strong>
            </div>
            <div className="text-xs space-y-1 text-stone-300 border-t border-white/10 pt-2">
              <div className="flex justify-between">
                <span>Estimated duration:</span>
                <span className="font-mono text-stone-200">~120 simulated minutes</span>
              </div>
              <div className="flex justify-between">
                <span>System impact:</span>
                <span className="text-amber-300">Water recovery paused during isolation</span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-stone-400">
              The procedure requires electrical isolation, hatch key unlocking, retainer driver clip release, replacement part alignment (0° notch), and formal post-install startup verification.
            </p>
          </div>
          {diagnosis.support !== 'strong' && (
            <p className="text-sm text-amber-200 flex items-start gap-1.5">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>
                Your selected evidence provides only {diagnosis.support === 'none' ? 'weak' : 'partial'} confirmation. You can collect more telemetry or proceed to test this diagnosis.
              </span>
            </p>
          )}
          <button
            data-testid="current-engine-action"
            disabled={concluded || spareCount === 0}
            className="workbench-action"
            onClick={() => send({ type: 'TRAINING_STEP', step: { step: 'IDENTIFY_EQUIPMENT', moduleId: 'water-recycler' } })}
          >
            <span>Identify recycler and begin preparation</span>
            <ChevronRight size={17} />
          </button>
          {spareCount === 0 && (
            <p className="text-amber-200">
              No compatible spare remains. Review the evidence or use Mission Autopsy to rewind an earlier decision.
            </p>
          )}
          <button className="game-button w-full" onClick={() => setReviewEvidence(true)}>
            Review evidence before committing
          </button>
        </section>
      ) : diagnosticView ? (
        /* STAGE 2 & 3: Investigate & Diagnose */
        <section aria-label="Diagnostic investigation" className="space-y-4">
          <h3 className="text-2xl font-semibold">
            {operation.recoveryLph < NOMINAL_RECOVERY_LPH
              ? 'What is limiting water recovery?'
              : 'Investigate Water Recycler Telemetry'}
          </h3>
          <p className="leading-relaxed text-stone-300">
            Compare pump telemetry, differential pressure across the filtration bed, and the inline flow sensor against the independent clean-tank measurement.
          </p>
          <button
            disabled={concluded}
            className="workbench-action"
            onClick={() => send({ type: 'RUN_DIAGNOSTIC', testId: 'run-diagnostic-cycle' })}
          >
            <span>Run full diagnostic cycle (30 min)</span>
            <ChevronRight size={17} />
          </button>
          {readings.length > 0 && (
            <>
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>Latest instrument scan</span>
                <span className="font-mono">
                  Hour {t.evidence.at(-1)!.hour}:{String(t.evidence.at(-1)!.minute).padStart(2, '0')}
                </span>
              </div>
              <Readings readings={readings} />

              <fieldset className="space-y-3 pt-2">
                <legend className="mb-2 text-base font-semibold text-cream">
                  Which hypothesis fits the telemetry evidence?
                </legend>
                {FAULTS.map((kind) => (
                  <label
                    key={kind}
                    className={`flex cursor-pointer items-start gap-3 rounded border p-3 transition ${
                      hypothesis === kind
                        ? 'border-flare bg-flare/10 text-cream'
                        : 'border-white/15 bg-black/20 text-stone-300 hover:border-white/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="workbench-hypothesis"
                      aria-label={FAULT_LABEL[kind]}
                      checked={hypothesis === kind}
                      onChange={() => {
                        soundManager.playClick();
                        setHypothesis(kind);
                      }}
                      className="accent-flare mt-0.5"
                    />

                    <div>
                      <div className="font-semibold text-sm">{FAULT_LABEL[kind]}</div>
                      <div className="text-xs text-stone-400 mt-1">{FAULT_DETAILS[kind].symptom}</div>
                      <div className="text-[11px] text-stone-500 mt-0.5">{FAULT_DETAILS[kind].mechanism}</div>
                    </div>
                  </label>
                ))}
              </fieldset>

              <fieldset className="pt-2">
                <legend className="mb-2 text-xs font-semibold text-stone-300">
                  Select the measurements supporting your diagnosis:
                </legend>
                <div className="space-y-2">
                  {t.evidence.map((e) => (
                    <label key={e.id} className="flex items-center gap-3 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={evidenceIds.includes(e.id)}
                        onChange={(event) => {
                          soundManager.playClick();
                          setEvidenceIds(
                            event.target.checked
                              ? [...evidenceIds, e.id]
                              : evidenceIds.filter((id) => id !== e.id)
                          );
                        }}
                        className="accent-flare"
                      />
                      <span>
                        {e.title} · Hour {e.hour}:{String(e.minute).padStart(2, '0')}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <button
                disabled={concluded || !hypothesis || evidenceIds.length === 0}
                className="workbench-action"
                onClick={() => {
                  if (hypothesis) send({ type: 'RECORD_HYPOTHESIS', kind: hypothesis, evidenceIds });
                }}
              >
                <span>Record evidence-backed diagnosis</span>
                <ChevronRight size={17} />
              </button>
              <p className="text-xs text-stone-400">
                A hypothesis requires supporting evidence to be accepted. Recording a hypothesis commits your engineering diagnosis before maintenance begins.
              </p>
            </>
          )}

          <details className="workbench-details">
            <summary>Inspect individual components or run targeted tests</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['pump-cartridge', 'filter-cartridge', 'flow-sensor'] as RecyclerComponentId[]).map((id) => (
                <button
                  className="game-button"
                  key={id}
                  aria-pressed={selected === id}
                  onClick={() => inspect(id)}
                >
                  {COMPONENT_INFO[id].name}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {(['check-pump', 'read-pressure', 'compare-output'] as const).map((id) => (
                <button
                  key={id}
                  disabled={concluded}
                  className="game-button block w-full text-left"
                  onClick={() => send({ type: 'RUN_DIAGNOSTIC', testId: id })}
                >
                  {DIAGNOSTIC_TESTS[id].title} · {MINUTES.RUN_DIAGNOSTIC[id]} min
                </button>
              ))}
            </div>
          </details>

          {reviewEvidence && (
            <button className="game-button w-full" onClick={() => setReviewEvidence(false)}>
              Back to intervention
            </button>
          )}
        </section>
      ) : (
        /* STAGE 1: Understand */
        <section aria-label="Understand the equipment" className="space-y-4">
          <h3 className="text-2xl font-semibold">Turn used water into potable water.</h3>
          <p className="leading-relaxed text-stone-300">
            Water is the heaviest resource to transport to Mars. The water recycler recovers up to 84% of graywater through continuous filtration, catalytic oxidation, and inline quality verification.
          </p>

          <ol className="water-flow grid grid-cols-3 gap-2 text-center text-xs" aria-label="Water flow path">
            {[
              { num: '01', title: 'Input Tank', desc: 'Wastewater & hygiene condensate' },
              { num: '02', title: 'Pump → Filter', desc: 'Pressure drive & particulate mesh' },
              { num: '03', title: 'Clean Tank', desc: 'Independent tank & flow sensor' },
            ].map(({ num, title, desc }) => (
              <li key={title} className="rounded border border-cyan-300/25 bg-cyan-950/25 p-3">
                <span className="mb-1 block font-mono text-cyan-200 font-bold">{num}</span>
                <strong className="text-stone-100 block">{title}</strong>
                <span className="text-[10px] text-stone-400 mt-1 block">{desc}</span>
              </li>
            ))}
          </ol>

          <p className="rounded border border-amber-200/20 p-3 text-sm text-amber-100 flex items-start gap-2">
            <HelpCircle size={16} className="shrink-0 text-amber-300 mt-0.5" />
            <span>
              {t.recycler.faultOnsetHour !== null
                ? 'Observed symptom: recovery is below its expected range. Find out why using measurements.'
                : 'No fault alert yet. You can learn the equipment and collect baseline readings before a warning occurs.'}
            </span>

          </p>

          <button disabled={concluded} className="workbench-action" onClick={() => inspect('wastewater-tank')}>
            <span>Inspect the flow path (2 min)</span>
            <ChevronRight size={17} />
          </button>
          <button
            disabled={concluded}
            className="game-button w-full"
            onClick={() => send({ type: 'RUN_DIAGNOSTIC', testId: 'run-diagnostic-cycle' })}
          >
            Run full diagnostic cycle (30 min)
          </button>
        </section>
      )}

      {selected && (
        <details className="workbench-details" open>
          <summary className="font-semibold text-stone-200">
            Selected Component: {COMPONENT_INFO[selected].name}
          </summary>
          <p className="mt-2 text-sm text-stone-300">
            {PURPOSE[selected]}. {COMPONENT_INFO[selected].purpose}
          </p>
        </details>
      )}

      {feedback && (feedback.kind === 'rejected' || feedback.kind === 'warning') && (
        <div role="status" className="rounded border border-amber-300/40 bg-amber-950/25 p-3 text-sm leading-relaxed text-amber-100">
          <b>{feedback.title}</b>
          <p className="mt-1">{feedback.body}</p>
        </div>
      )}

      {p.completedSteps.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-stone-400">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span>Progress is saved to the local mission state. Leaving this view does not discard your steps.</span>
        </p>
      )}
    </div>
  );
}

export default RecyclerWorkbench;
