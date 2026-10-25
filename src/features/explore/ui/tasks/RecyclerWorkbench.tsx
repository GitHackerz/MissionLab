'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronRight, Droplets, Lightbulb } from 'lucide-react';
import { useMissionStore } from '@/state/missionStore';
import { useExploreStore } from '../../store';
import { COMPONENT_INFO, DIAGNOSTIC_TESTS, FAULT_LABEL, MINUTES, NOMINAL_RECOVERY_LPH, PART_LABEL, getRecyclerOperation } from '@/simulation/training/recycler';
import type { Measurement, RecyclerComponentId, RecyclerFaultKind, TrainingAction } from '@/simulation/training/types';
import { nextRepairInstruction, proposedPart, REPAIR_STEPS } from './recyclerWorkflow';

function Readings({ readings }: { readings: Measurement[] }) {
  return <table className="instrument-readings w-full text-xs"><thead><tr className="text-left text-stone-400"><th className="py-2 font-normal">Measurement</th><th className="text-right font-normal">Actual / expected</th></tr></thead><tbody>{readings.map(r => <tr key={r.id} className="border-t border-white/10"><td className="py-2 pr-2 text-stone-200">{r.label}</td><td className={`py-2 text-right font-mono ${r.inRange ? 'text-emerald-200' : 'text-amber-200'}`}><span>{r.value} {r.unit} {r.inRange ? '✓' : '▲'}</span><div className="mt-1 text-[11px] text-stone-400">{r.expectedMin}–{r.expectedMax} {r.unit}</div></td></tr>)}</tbody></table>;
}
const FAULTS: RecyclerFaultKind[] = ['pump-seized', 'filter-clogged', 'sensor-drift'];
const PURPOSE: Record<RecyclerComponentId, string> = {
  'wastewater-tank': 'Collects used water', 'pump-cartridge': 'Moves water through the system', 'filter-cartridge': 'Traps particles', 'treatment-stage': 'Cleans the filtered water', 'flow-sensor': 'Measures how much water returns', 'clean-tank': 'Stores recovered water', 'service-hatch': 'Protects the cartridge bays', 'control-panel': 'Stops, restarts and tests the unit',
};

/** A stage is derived from engine records. Local state only chooses which notes to view. */
export function RecyclerWorkbench() {
  const mission = useMissionStore(s => s.missionState);
  const act = useMissionStore(s => s.applyAction);
  const selected = useMissionStore(s => s.selectedComponentId);
  const select = useMissionStore(s => s.selectComponent);
  const feedback = useMissionStore(s => s.lastFeedback);
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
  const repairing = ['preparing', 'intervention', 'verifying'].includes(p.phase) || p.maintenanceMode || p.hatchOpen || p.testReady || p.phase === 'diagnosis-recorded' && p.completedSteps.includes('identify-equipment');
  const result = p.verification && (p.phase === 'completed' || p.phase === 'failed-verification');
  const stage = reviewEvidence ? 'Investigate' : result ? 'Reflect' : repairing ? (p.testReady ? 'Verify' : 'Execute') : diagnosis ? 'Plan' : t.evidence.length ? 'Understand' : t.inspectedComponents.length ? 'Investigate' : 'Discover';
  const send = (action: TrainingAction) => { const outcome = act(action); if (outcome.ok && action.type === 'TRAINING_STEP' && action.step.step === 'IDENTIFY_EQUIPMENT') select(proposedPart(outcome.state)); if (outcome.ok && action.type !== 'RUN_DIAGNOSTIC' && action.type !== 'INSPECT_COMPONENT') setReviewEvidence(false); };
  const inspect = (id: RecyclerComponentId) => { select(id); send({ type: 'INSPECT_COMPONENT', componentId: id }); };
  const spareCount = part === 'pump-cartridge' ? mission.resources.sparePumps : part === 'filter-cartridge' ? t.inventory.filterCartridges : t.inventory.flowSensors;
  const diagnosticView = reviewEvidence || (!repairing && !diagnosis && (t.inspectedComponents.length > 0 || t.evidence.length > 0));
  const readings = t.evidence.at(-1)?.readings ?? [];
  const firstRepair = t.log.find(e => e.ok && e.action === 'IDENTIFY_EQUIPMENT');
  const elapsed = firstRepair ? Math.round((mission.hour - firstRepair.hour) * 60 + t.minuteOfHour - firstRepair.minute) : null;
  const partsTaken = t.log.filter(e => e.ok && e.action.startsWith('TAKE_SPARE:')).length;
  return <div className="workbench space-y-4 p-5 text-sm">
    <header className="border-b border-white/10 pb-4">
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-sky-200"><span>{stage} / Water systems</span><span>H{mission.hour}:{String(t.minuteOfHour).padStart(2, '0')}</span></div>
      <div className="mt-3 flex items-center gap-2 text-xs text-stone-300"><Droplets size={15} className="text-cyan-300" /><span>{operation.reason === 'blackout' ? 'Insufficient electrical supply' : operation.reason === 'maintenance' ? 'Isolated for maintenance' : operation.reason === 'switched-off' ? 'Electrical load switched off' : `Recovery ${operation.recoveryLph.toFixed(2)} L/h · expected ${NOMINAL_RECOVERY_LPH} L/h`}</span></div>
    </header>

    {concluded && <div className="rounded border border-amber-300/40 bg-amber-950/30 p-4"><h3 className="font-semibold">The mission has ended</h3><p className="mt-2 text-sm text-stone-300">Equipment actions are locked. Review the outcome and rewind a decision to try another approach.</p><button className="game-button mt-3" onClick={() => useExploreStore.getState().openDebrief()}>Open Mission Autopsy</button></div>}

    {operation.reason === 'blackout' || operation.reason === 'switched-off' ? <p className="rounded border border-amber-300/30 p-3 text-sm text-amber-100">This machine lacks operating power. Check its circuit in the Power Room before interpreting a stopped pump as an internal fault.</p> : null}
    {!reviewEvidence && result ? <section aria-label="Repair result" className="space-y-4">
      <div className={`rounded border p-4 ${p.verification!.passed ? 'border-emerald-300/40 bg-emerald-950/25' : 'border-amber-300/40 bg-amber-950/25'}`}><h3 className="text-xl font-semibold">{p.verification!.passed ? 'Water recovery restored' : 'The startup test did not pass'}</h3><p className="mt-2 leading-relaxed text-stone-300">{p.verification!.passed ? 'The instrument readings are back in range. Measurements, rather than the replacement animation, prove the repair worked.' : 'A replacement alone does not prove the diagnosis. Compare the measurements and reconsider which component explains the symptom.'}</p></div>
      <p className="text-xs text-stone-400">Startup measurements recorded at hour {p.verification!.hour}. Compare them with the expected ranges below.</p><Readings readings={p.verification!.readings} />
      {p.verification!.remainingIssues.map(issue => <p key={issue} className="text-amber-200">{issue}</p>)}
      {p.verification!.passed && <><p className="text-stone-200"><b>{t.recycler.faultOnsetHour === null ? 'Baseline check:' : 'Root cause:'}</b> {t.recycler.faultOnsetHour === null ? 'No fault had occurred; measurements confirm operation. Keep monitoring.' : `${FAULT_LABEL[t.recycler.faultKind]}.`} Your replacement was {PART_LABEL[part].toLowerCase()}.</p><p className="text-xs text-stone-400">{elapsed !== null ? `${elapsed} simulated minutes since identification · ` : ''}{partsTaken} spare part{partsTaken === 1 ? '' : 's'} taken this mission. The colony now recovers {operation.recoveryLph.toFixed(2)} L/h; crew water use and oxygen processing still consume water.</p><p className="rounded bg-sky-950/40 p-3 leading-relaxed text-sky-100">Engineering lesson: a symptom can have several causes. Use independent measurements, make a safe intervention, then verify against the same expected ranges.</p></>}
      {!p.verification!.passed && <><button disabled={concluded} className="game-button w-full" onClick={() => send({ type: 'TRAINING_STEP', step: { step: 'RESTORE_TEST_READY' } })}>Prepare verification-only retest</button><p className="text-xs text-stone-400">If power was the problem, restore the circuit in the Power Room before testing again. A retest still fails if the fault remains.</p><button className="game-button w-full" onClick={() => setReviewEvidence(true)}>Review evidence and diagnosis</button><button disabled={concluded} className="workbench-action" onClick={() => send({ type: 'TRAINING_STEP', step: { step: 'ENTER_MAINTENANCE_MODE' } })}>Begin another safe intervention</button><p className="text-xs text-stone-400">Used spares stay consumed. A new attempt uses the same validated procedure and the latest diagnosis.</p></>}
      <button className="workbench-action" onClick={() => useExploreStore.getState().endTask()}>Return to habitat <ChevronRight size={17} /></button>
    </section> : !reviewEvidence && repairing ? <section aria-label="Current repair instruction" className="space-y-4">
      <div className="flex items-center justify-between text-xs text-stone-400"><span>{p.testReady ? 'Verify operation' : next && next.index < 6 ? 'Make the equipment safe' : 'Replace and reassemble'}</span><span>{p.completedSteps.length} / 16 completed</span></div>
      <div className="h-1 rounded bg-white/10"><div className="h-full rounded bg-sky-300" style={{ width: `${p.completedSteps.length / 16 * 100}%` }} /></div>
      {next ? <><h3 className="text-2xl font-semibold leading-tight">{next.title}</h3><p className="leading-relaxed text-stone-300">{next.instruction}</p><div className="rounded border border-sky-300/20 bg-sky-950/25 p-3 text-sm text-sky-100">Working on: {PART_LABEL[part]}<br /><span className="text-xs text-stone-300">{p.held ? `In hand: ${PART_LABEL[p.held.part]} · ${p.held.orientation}°` : p.tool ? `Tool in hand: ${p.tool.replace(/-/g, ' ')}` : 'No tool in hand'}</span></div><button data-testid="current-engine-action" disabled={concluded} className="workbench-action" onClick={() => send(next.action)}>{next.label}<ChevronRight size={17} /></button>{t.mode === 'cadet' && <p className="flex gap-2 text-xs leading-relaxed text-amber-100"><Lightbulb size={15} className="shrink-0" />You can also use the highlighted part in the 3D view. The button requests the same engine action.</p>}</> : <p>Review the current readings and procedure log below.</p>}
      <details className="workbench-details"><summary>Optional checklist · review earlier instructions</summary><ol className="mt-3 space-y-3">{REPAIR_STEPS.map((step, i) => <li key={step.id} className="text-xs"><span className={p.completedSteps.includes(step.id) ? 'text-emerald-200' : 'text-stone-300'}>{p.completedSteps.includes(step.id) ? '✓' : '○'} {i + 1}. {step.title}</span><p className="mt-1 text-stone-400">{step.instruction}</p></li>)}</ol></details>
      <details className="workbench-details"><summary>Need help or need to stop?</summary><p className="mt-3 text-xs leading-relaxed text-stone-300">Esc leaves this view without changing the procedure. Isolation, open bays and used parts remain exactly as you left them. Aborting requests a safe return to service; the engine rejects it if the machine cannot safely close.</p><button disabled={concluded} className="game-button mt-3" onClick={() => send({ type: 'TRAINING_STEP', step: { step: 'ABORT_PROCEDURE' } })}>Request safe return to service</button></details>
    </section> : !reviewEvidence && diagnosis ? <section aria-label="Intervention plan" className="space-y-4">
      <h3 className="text-2xl font-semibold">Plan your intervention</h3><p className="leading-relaxed text-stone-300">Your diagnosis is <b className="text-white">{FAULT_LABEL[diagnosis.kind].toLowerCase()}</b>. The proposed replacement is the <b className="text-white">{PART_LABEL[part].toLowerCase()}</b>.</p>
      <div className="rounded border border-white/15 p-4"><div className="flex justify-between"><span>Matching spares</span><strong>{spareCount}</strong></div><p className="mt-3 text-xs leading-relaxed text-stone-300">Allow about two simulated hours for preparation, replacement and startup verification. Water recovery pauses while isolated. The hatch key opens the compartment; the retainer driver releases the cartridge clips.</p></div>
      {diagnosis.support !== 'strong' && <p className="text-sm text-amber-200">Your selected evidence only gives {diagnosis.support === 'none' ? 'weak' : 'partial'} support. You may collect more measurements or test this diagnosis through a real intervention.</p>}
      <button data-testid="current-engine-action" disabled={concluded || spareCount === 0} className="workbench-action" onClick={() => send({ type: 'TRAINING_STEP', step: { step: 'IDENTIFY_EQUIPMENT', moduleId: 'water-recycler' } })}>Identify recycler and begin preparation <ChevronRight size={17} /></button>
      {spareCount === 0 && <p className="text-amber-200">No compatible spare remains. Review the evidence or use Mission Autopsy to rewind a decision.</p>}
      <button className="game-button w-full" onClick={() => setReviewEvidence(true)}>Review evidence before committing</button>
    </section> : diagnosticView ? <section aria-label="Diagnostic investigation" className="space-y-4">
      <h3 className="text-2xl font-semibold">{operation.recoveryLph < NOMINAL_RECOVERY_LPH ? 'What is limiting recovery?' : 'Check how the recycler works'}</h3><p className="leading-relaxed text-stone-300">Test the pump, pressure across the filter, and the sensor against the independent clean-tank measurement. A low reading alone does not identify the failed part.</p>
      <button disabled={concluded} className="workbench-action" onClick={() => send({ type: 'RUN_DIAGNOSTIC', testId: 'run-diagnostic-cycle' })}>Run full diagnostic cycle (30 min)</button>
      {readings.length > 0 && <><p className="text-xs text-stone-400">Latest instrument scan · H{t.evidence.at(-1)!.hour}:{String(t.evidence.at(-1)!.minute).padStart(2, '0')}</p><Readings readings={readings} /><fieldset className="space-y-3"><legend className="mb-3 text-lg font-semibold">Which explanation fits the evidence?</legend>{FAULTS.map(kind => <label key={kind} className="flex cursor-pointer items-center gap-3 rounded border border-white/15 p-3"><input type="radio" name="workbench-hypothesis" checked={hypothesis === kind} onChange={() => setHypothesis(kind)} className="accent-orange-300" />{FAULT_LABEL[kind]}</label>)}</fieldset>
        <fieldset><legend className="mb-2 text-xs text-stone-400">Choose the measurements supporting your diagnosis</legend>{t.evidence.map(e => <label key={e.id} className="mb-2 flex items-center gap-3 text-sm"><input type="checkbox" checked={evidenceIds.includes(e.id)} onChange={event => setEvidenceIds(event.target.checked ? [...evidenceIds, e.id] : evidenceIds.filter(id => id !== e.id))} className="accent-orange-300" />{e.title} · H{e.hour}:{String(e.minute).padStart(2, '0')}</label>)}</fieldset>
        <button disabled={concluded || !hypothesis || evidenceIds.length === 0} className="workbench-action" onClick={() => { if (hypothesis) send({ type: 'RECORD_HYPOTHESIS', kind: hypothesis, evidenceIds }); }}>Record evidence-backed diagnosis</button><p className="text-xs text-stone-400">Choose a hypothesis and tick its evidence. Recording a hypothesis does not repair the equipment.</p>
      </>}
      <details className="workbench-details"><summary>Inspect a part or choose an individual test</summary><div className="mt-3 flex flex-wrap gap-2">{(['pump-cartridge', 'filter-cartridge', 'flow-sensor'] as RecyclerComponentId[]).map(id => <button className="game-button" key={id} aria-pressed={selected === id} onClick={() => inspect(id)}>{COMPONENT_INFO[id].name}</button>)}</div><div className="mt-3 space-y-2">{(['check-pump', 'read-pressure', 'compare-output'] as const).map(id => <button key={id} disabled={concluded} className="game-button block w-full text-left" onClick={() => send({ type: 'RUN_DIAGNOSTIC', testId: id })}>{DIAGNOSTIC_TESTS[id].title} · {MINUTES.RUN_DIAGNOSTIC[id]} min</button>)}</div></details>
      {reviewEvidence && <button className="game-button w-full" onClick={() => setReviewEvidence(false)}>Back to intervention</button>}
    </section> : <section aria-label="Understand the equipment" className="space-y-4">
      <h3 className="text-2xl font-semibold">Turn used water into drinking water.</h3><p className="leading-relaxed text-stone-300">The pump moves water through a filter and treatment stage. A sensor checks the returning flow. The clean tank gives an independent measurement.</p>
      <ol className="water-flow grid grid-cols-3 gap-2 text-center text-xs" aria-label="Water flow path">{['Used water', 'Pump → filter', 'Clean tank'].map((label, i) => <li key={label} className="rounded border border-cyan-300/25 bg-cyan-950/25 p-3"><span className="mb-2 block font-mono text-cyan-200">0{i + 1}</span>{label}</li>)}</ol>
      <p className="rounded border border-amber-200/20 p-3 text-sm text-amber-100">{t.recycler.faultOnsetHour !== null ? 'Observed symptom: recovery is below its expected range. Find out why using measurements.' : 'No fault alert yet. You can learn the equipment and collect baseline readings before a warning occurs.'}</p>
      <button disabled={concluded} className="workbench-action" onClick={() => inspect('wastewater-tank')}>Inspect the flow path (2 min)<ChevronRight size={17} /></button>
      <button disabled={concluded} className="game-button w-full" onClick={() => send({ type: 'RUN_DIAGNOSTIC', testId: 'run-diagnostic-cycle' })}>Run full diagnostic cycle (30 min)</button>
    </section>}

    {selected && <details className="workbench-details"><summary>Selected part: {COMPONENT_INFO[selected].name}</summary><p className="mt-3 text-sm text-stone-300">{PURPOSE[selected]}. {COMPONENT_INFO[selected].purpose}</p></details>}
    {feedback && (feedback.kind === 'rejected' || feedback.kind === 'warning') && <div role="status" className="rounded border border-amber-300/40 bg-amber-950/25 p-3 text-sm leading-relaxed text-amber-100"><b>{feedback.title}</b><p className="mt-1">{feedback.body}</p></div>}
    {p.completedSteps.length > 0 && <p className="flex items-center gap-2 text-xs text-stone-400"><CheckCircle2 size={14} />Progress is stored in the current mission. Leaving this view does not reset it.</p>}
  </div>;
}
