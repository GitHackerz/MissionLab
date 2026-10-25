'use client';

import { RecyclerWorkbench } from '@/features/explore/ui/tasks/RecyclerWorkbench';
import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, FlaskConical, Lightbulb, Microscope, Wrench, XCircle, Box } from 'lucide-react';
import { useMissionStore } from '@/state/missionStore';
import { getGuidance } from '@/simulation/training/guidance';
import {
  COMPONENT_INFO,
  DIAGNOSTIC_TESTS,
  FAULT_LABEL,
  FAULT_SLOT,
  MINUTES,
  PART_LABEL,
} from '@/simulation/training/recycler';
import {
  REPLACEABLE_IDS,
  type DiagnosticTestId,
  type LearningMode,
  type ProcedureStepId,
  type RecyclerComponentId,
  type RecyclerFaultKind,
  type ReplaceableId,
  type ToolId,
  type TrainingAction,
  type TrainingStepAction,
} from '@/simulation/training/types';
import { forecastPlan } from '@/simulation/engine';
import { currentPlan } from '@/simulation/training/power';

const COMPONENT_TESTS: Partial<Record<RecyclerComponentId, DiagnosticTestId[]>> = {
  'pump-cartridge': ['check-pump'],
  'filter-cartridge': ['read-pressure'],
  'flow-sensor': ['read-flow-sensor'],
  'clean-tank': ['compare-output'],
};

const TOOL_LABEL: Record<ToolId, string> = { 'hatch-key': 'Hatch key', 'retainer-driver': 'Retainer driver', 'sample-kit': 'Sample kit' };

const MODES: { id: LearningMode; label: string; note: string }[] = [
  { id: 'cadet', label: 'Cadet', note: 'Guided: hints and highlights' },
  { id: 'engineer', label: 'Engineer', note: 'Objective and documentation' },
  { id: 'commander', label: 'Commander', note: 'Symptoms only' },
];

const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section className="space-y-2">
    <h3 className="flex items-center gap-1.5 border-b border-mars-border pb-1 font-mono text-[11px] uppercase tracking-wider text-stone-400">
      {icon}
      {title}
    </h3>
    {children}
  </section>
);

interface StepRow {
  id: ProcedureStepId;
  label: string;
  detail: string;
}

const STEPS: StepRow[] = [
  { id: 'identify-equipment', label: '1. Identify the equipment', detail: 'Confirm the water recycler is the unit to service.' },
  { id: 'review-isolation', label: '2. Review isolation steps', detail: 'Read the (training) checklist for making it safe.' },
  { id: 'maintenance-mode', label: '3. Maintenance mode', detail: 'Stop the unit at the control panel. Water recovery pauses.' },
  { id: 'confirm-inactive', label: '4. Confirm it is inactive', detail: 'Check the pump reads 0 rpm.' },
  { id: 'select-tool', label: '5. Select a tool', detail: 'Each job needs the right tool.' },
  { id: 'open-hatch', label: '6. Open the service hatch', detail: 'Needs the hatch key.' },
  { id: 'locate-component', label: '7. Locate the cartridge', detail: 'Find the bay you want to service.' },
  { id: 'release-retainers', label: '8. Release the retainers', detail: 'Needs the retainer driver.' },
  { id: 'remove-component', label: '9. Remove the cartridge', detail: 'Slide it out of its bay.' },
  { id: 'retrieve-spare', label: '10. Retrieve a spare', detail: 'Take a compatible part from the tray.' },
  { id: 'inspect-orient-spare', label: '11. Inspect and orient', detail: 'Check the label, align the keying notch to 0°.' },
  { id: 'install-component', label: '12. Install the part', detail: 'Seat it in the empty bay.' },
  { id: 'secure-component', label: '13. Secure it', detail: 'Lock the retainers.' },
  { id: 'close-hatch', label: '14. Close the hatch', detail: 'All bays filled and locked.' },
  { id: 'restore-test-ready', label: '15. Restore to test-ready', detail: 'Control panel.' },
  { id: 'startup-test', label: '16. Run the startup test', detail: 'Then compare readings with expected ranges.' },
];

export const LegacyTrainingPanel: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { missionState, applyAction, viewMode, setViewMode, selectModule, selectedComponentId, selectComponent } = useMissionStore();
  const t = missionState.training;
  const [slot, setSlot] = useState<ReplaceableId | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [hypothesis, setHypothesis] = useState<RecyclerFaultKind>('pump-seized');

  const guidance = useMemo(() => getGuidance(missionState), [missionState]);
  const outlook = useMemo(() => (t ? forecastPlan(missionState, currentPlan(missionState)) : null), [missionState, t]);

  if (!t) {
    return <div className="p-4 text-xs text-stone-400">This state has no training model (fixture). Reset the mission or choose the engine demo.</div>;
  }
  const p = t.recycler.procedure;
  const nextStep = STEPS.find(s => !p.completedSteps.includes(s.id));
  const lastHyp = t.hypotheses[t.hypotheses.length - 1];
  const chosenSlot: ReplaceableId = slot ?? (lastHyp ? FAULT_SLOT[lastHyp.kind] : 'pump-cartridge');
  const faultSeen = t.recycler.faultOnsetHour !== null;
  const act = (a: TrainingAction) => applyAction(a);
  const step = (s: TrainingStepAction) => act({ type: 'TRAINING_STEP', step: s });
  const selected = selectedComponentId ? COMPONENT_INFO[selectedComponentId] : null;
  const tests = selectedComponentId ? COMPONENT_TESTS[selectedComponentId] ?? [] : [];
  const enterService = () => {
    selectModule('water-recycler');
    setViewMode('service');
    step({ step: 'IDENTIFY_EQUIPMENT', moduleId: 'water-recycler' });
  };

  const rowAction = (id: ProcedureStepId): React.ReactNode => {
    const btn = (label: string, onClick: () => void) => (
      <button type="button" onClick={onClick} className="rounded border border-stone-600 bg-stone-900 px-2 py-0.5 text-[10px] text-stone-200 hover:bg-stone-800">
        {label}
      </button>
    );
    switch (id) {
      case 'identify-equipment': return btn('Identify', () => step({ step: 'IDENTIFY_EQUIPMENT', moduleId: 'water-recycler' }));
      case 'review-isolation': return btn('Read', () => step({ step: 'REVIEW_ISOLATION' }));
      case 'maintenance-mode': return btn('Stop unit', () => step({ step: 'ENTER_MAINTENANCE_MODE' }));
      case 'confirm-inactive': return btn('Check pump', () => step({ step: 'CONFIRM_INACTIVE' }));
      case 'select-tool':
        return (
          <span className="flex flex-wrap gap-1">
            {(Object.keys(TOOL_LABEL) as ToolId[]).map((tool) => (
              <button key={tool} type="button" aria-pressed={p.tool === tool} onClick={() => step({ step: 'SELECT_TOOL', tool })} className={`rounded border px-2 py-0.5 text-[10px] ${p.tool === tool ? 'border-sky-400 bg-sky-950 text-sky-200' : 'border-stone-600 bg-stone-900 text-stone-200 hover:bg-stone-800'}`}>
                {TOOL_LABEL[tool]}
              </button>
            ))}
          </span>
        );
      case 'open-hatch': return btn(p.hatchOpen ? 'Open' : 'Open hatch', () => step({ step: 'OPEN_HATCH' }));
      case 'locate-component': return btn('Locate', () => step({ step: 'LOCATE_COMPONENT', slot: chosenSlot }));
      case 'release-retainers': return btn('Release', () => step({ step: 'RELEASE_RETAINERS', slot: chosenSlot }));
      case 'remove-component': return btn('Remove', () => step({ step: 'REMOVE_COMPONENT', slot: chosenSlot }));
      case 'retrieve-spare': return btn('Take spare', () => step({ step: 'TAKE_SPARE', part: chosenSlot }));
      case 'inspect-orient-spare':
        return (
          <span className="flex gap-1">
            {btn('Inspect', () => step({ step: 'INSPECT_SPARE' }))}
            {btn(`Rotate${p.held ? ` (${p.held.orientation}°)` : ''}`, () => step({ step: 'ROTATE_PART' }))}
          </span>
        );
      case 'install-component': return btn('Install', () => step({ step: 'INSTALL_COMPONENT', slot: chosenSlot }));
      case 'secure-component': return btn('Secure', () => step({ step: 'SECURE_COMPONENT', slot: chosenSlot }));
      case 'close-hatch': return btn('Close hatch', () => step({ step: 'CLOSE_HATCH' }));
      case 'restore-test-ready': return btn('Restore', () => step({ step: 'RESTORE_TEST_READY' }));
      case 'startup-test': return btn('Run test', () => step({ step: 'RUN_STARTUP_TEST' }));
    }
  };

  return (
    <div className="space-y-5 p-4 text-xs">
      {embedded && <div className="sticky -top-4 z-10 -mx-4 border-b border-sky-300/20 bg-[#142733]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between text-xs text-sky-200"><span>ENGINEERING WORKBENCH</span><span>{p.completedSteps.length} / {STEPS.length} steps</span></div>
        <div className="mt-2 h-1 overflow-hidden rounded bg-white/10"><div className="h-full bg-sky-300 transition-all" style={{ width: `${p.completedSteps.length / STEPS.length * 100}%` }} /></div>
        <p className="mt-2 text-sm font-semibold">{p.verification?.passed ? 'Verified: water recovery restored' : nextStep ? nextStep.label : 'Review the startup readings'}</p>
        <p className="mt-1 text-xs text-stone-300">{p.tool ? `Tool: ${TOOL_LABEL[p.tool]}` : 'No tool selected'} · {p.held ? `Holding: ${PART_LABEL[p.held.part]}` : 'Hands free'} · {p.maintenanceMode ? 'Unit isolated' : 'Unit in service'}</p>
      </div>}
      {/* Objective */}
      <div className="rounded border border-orange-500/40 bg-orange-950/20 p-3">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-orange-400">Current objective</div>
        <p className="leading-relaxed text-stone-100">{guidance.objective}</p>
        {guidance.hint && (
          <p className="mt-2 flex gap-1.5 leading-snug text-amber-200">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span><span className="font-semibold">Hint: </span>{guidance.hint}</span>
          </p>
        )}
        {guidance.concept && <p className="mt-2 leading-snug text-sky-200"><span className="font-semibold">Science: </span>{guidance.concept}</p>}
        <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Learning mode">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={t.mode === m.id} title={m.note} onClick={() => act({ type: 'SET_LEARNING_MODE', mode: m.id })} className={`rounded px-2 py-0.5 font-mono text-[10px] ${t.mode === m.id ? 'bg-orange-600 text-white' : 'border border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Service view launcher + component browser */}
      <Section title="Water recycler" icon={<Microscope className="h-3.5 w-3.5 text-orange-400" />}>
        {!embedded && (
          <button type="button" onClick={viewMode === 'service' ? () => setViewMode('colony') : enterService} className="w-full rounded bg-sky-700 px-3 py-2 font-semibold text-white hover:bg-sky-600">
            {viewMode === 'service' ? 'Leave service view (back to colony)' : 'Enter service view (3D)'}
          </button>
        )}
        <p className="text-[11px] leading-snug text-stone-400">
          {embedded ? 'Click the machine in the 3D view to learn what each part does, read instruments, pick tools and swap cartridges.' : 'In the service view, click parts to learn what they do, read instruments, pick tools and swap cartridges.'} Everything can also be done with the buttons here.
        </p>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Recycler components">
          {(Object.keys(COMPONENT_INFO) as RecyclerComponentId[]).map((id) => (
            <button key={id} type="button" aria-pressed={selectedComponentId === id} onClick={() => { selectComponent(id); act({ type: 'INSPECT_COMPONENT', componentId: id }); }} className={`rounded border px-2 py-0.5 text-[10px] ${selectedComponentId === id ? 'border-sky-400 bg-sky-950 text-sky-200' : 'border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800'} ${t.inspectedComponents.includes(id) ? '' : 'opacity-90'}`}>
              {t.inspectedComponents.includes(id) && <span aria-label="inspected">✓ </span>}
              {COMPONENT_INFO[id].name}
            </button>
          ))}
        </div>
        {selected && (
          <div className="rounded border border-mars-border bg-black/30 p-2.5">
            <div className="font-semibold text-stone-100">{selected.name}</div>
            <p className="mt-1 leading-snug text-stone-300">{selected.purpose}</p>
            <ul className="mt-1.5 list-disc pl-4 text-[11px] text-stone-400">{selected.observable.map((o) => <li key={o}>{o}</li>)}</ul>
            {tests.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tests.map((id) => (
                  <button key={id} type="button" onClick={() => act({ type: 'RUN_DIAGNOSTIC', testId: id })} className="rounded bg-orange-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-orange-500">
                    {DIAGNOSTIC_TESTS[id].title} ({MINUTES.RUN_DIAGNOSTIC[id]} min)
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Evidence */}
      <Section title="Evidence notebook" icon={<FlaskConical className="h-3.5 w-3.5 text-orange-400" />}>
        {!faultSeen && t.evidence.length === 0 && <p className="text-stone-500">The recycler is working normally. Tests are available any time, but each one takes simulated time.</p>}
        <button type="button" onClick={() => act({ type: 'RUN_DIAGNOSTIC', testId: 'run-diagnostic-cycle' })} className="w-full rounded border border-stone-600 bg-stone-900 px-2 py-1.5 text-stone-200 hover:bg-stone-800">
          Run full diagnostic cycle ({MINUTES.RUN_DIAGNOSTIC['run-diagnostic-cycle']} min)
        </button>
        <ul className="space-y-2">
          {t.evidence.map((e) => (
            <li key={e.id} className="rounded border border-mars-border bg-black/30 p-2">
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" className="mt-0.5 accent-orange-500" checked={picked.includes(e.id)} onChange={(ev) => setPicked(ev.target.checked ? [...picked, e.id] : picked.filter((x) => x !== e.id))} />
                <span className="flex-1">
                  <span className="font-semibold text-stone-200">{e.title}</span>
                  <span className="ml-1 font-mono text-[10px] text-stone-500">hour {e.hour}</span>
                  <table className="mt-1 w-full font-mono text-[11px]">
                    <tbody>
                      {e.readings.map((r) => (
                        <tr key={r.id}>
                          <td className="pr-2 text-stone-400">{r.label}</td>
                          <td className="text-right text-stone-100">{r.value} {r.unit}</td>
                          <td className={`pl-2 text-right ${r.inRange ? 'text-emerald-400' : 'text-amber-400'}`}>{r.inRange ? '✓ in range' : '▲ out of range'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {t.evidence.length > 0 && (
          <fieldset className="rounded border border-mars-border bg-black/30 p-2.5">
            <legend className="px-1 font-mono text-[10px] uppercase text-stone-400">Diagnosis: what is the most likely cause?</legend>
            {(['pump-seized', 'filter-clogged', 'sensor-drift'] as RecyclerFaultKind[]).map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 py-0.5">
                <input type="radio" name="hyp" className="accent-orange-500" checked={hypothesis === k} onChange={() => setHypothesis(k)} />
                {FAULT_LABEL[k]}
              </label>
            ))}
            <button type="button" disabled={picked.length === 0} onClick={() => act({ type: 'RECORD_HYPOTHESIS', kind: hypothesis, evidenceIds: picked })} className="mt-2 w-full rounded bg-orange-600 px-2 py-1.5 font-semibold text-white hover:bg-orange-500 disabled:bg-stone-800 disabled:text-stone-500">
              {picked.length === 0 ? 'Tick the evidence that supports it' : `Record diagnosis (${picked.length} reading${picked.length > 1 ? 's' : ''})`}
            </button>
          </fieldset>
        )}
        {t.hypotheses.map((h) => (
          <div key={h.id} className="rounded border border-mars-border bg-black/20 p-2 text-[11px] text-stone-300">
            Hour {h.hour}: <span className="font-semibold">{FAULT_LABEL[h.kind]}</span> — evidence fit: <span className={h.support === 'strong' ? 'text-emerald-400' : h.support === 'partial' ? 'text-amber-400' : 'text-red-400'}>{h.support}</span>
          </div>
        ))}
      </Section>

      {/* Plan */}
      {t.hypotheses.length > 0 && (
        <Section title="Repair plan" icon={<Box className="h-3.5 w-3.5 text-orange-400" />}>
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-left text-stone-500"><th className="font-normal">Part</th><th className="font-normal">Spares</th></tr>
            </thead>
            <tbody>
              {REPLACEABLE_IDS.map((id) => {
                const n = id === 'pump-cartridge' ? missionState.resources.sparePumps : id === 'filter-cartridge' ? t.inventory.filterCartridges : t.inventory.flowSensors;
                return (
                  <tr key={id}><td className="text-stone-300">{PART_LABEL[id]}</td><td className={n > 0 ? 'text-emerald-400' : 'text-red-400'}>{n} {n > 0 ? 'available' : 'none left'}</td></tr>
                );
              })}
            </tbody>
          </table>
          <p className="leading-snug text-stone-400">
            A full swap takes roughly 1½–2 simulated hours. While the unit is stopped it recovers 0 L/h, so the crew uses about 0.5 L of water every hour. {outlook && <>Outlook if nothing else changes: water ends at <span className="text-stone-200">{outlook.samples[outlook.samples.length - 1].waterLiters.toFixed(1)} L</span> ({outlook.outcome === 'failed' ? 'mission fails' : 'mission survives'}).</>}
          </p>
        </Section>
      )}

      {/* Procedure */}
      <Section title="Maintenance procedure" icon={<Wrench className="h-3.5 w-3.5 text-orange-400" />}>
        <p className="text-[11px] leading-snug text-stone-500">Simplified classroom procedure, not real spacecraft maintenance instructions. Steps can be done in the 3D view or with these buttons.</p>
        <label className="flex items-center gap-2 text-stone-300">
          Part to service:
          <select value={chosenSlot} onChange={(e) => setSlot(e.target.value as ReplaceableId)} className="rounded border border-mars-border bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-stone-200">
            {REPLACEABLE_IDS.map((id) => <option key={id} value={id}>{PART_LABEL[id]}</option>)}
          </select>
        </label>
        <ol className="space-y-1.5">
          {STEPS.map((s) => {
            const done = p.completedSteps.includes(s.id);
            return (
              <li key={s.id} className={`flex items-start gap-2 rounded border p-2.5 ${nextStep?.id === s.id ? 'border-sky-300/60 bg-sky-950/40' : 'border-mars-border/60 bg-black/20'}`}>
                {done ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label="done" /> : <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-600" aria-label="not done" />}
                <div className="flex-1">
                  <div className={done ? 'text-stone-400' : 'text-stone-200'}>{s.label}</div>
                  {!done && t.mode !== 'commander' && <div className="text-[10px] text-stone-500">{s.detail}</div>}
                  {done && s.id !== 'select-tool' ? <details className="mt-1 text-stone-400"><summary className="cursor-pointer text-xs">Completed · review action</summary><div className="mt-2">{rowAction(s.id)}</div></details> : <div className="mt-2">{rowAction(s.id)}</div>}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="font-mono text-[11px] text-stone-400">
          Hatch: {p.hatchOpen ? 'open' : 'closed'} · Mode: {p.maintenanceMode ? 'maintenance' : p.testReady ? 'test-ready' : 'running'} · Tool: {p.tool ? TOOL_LABEL[p.tool] : 'none'} · In hand: {p.held ? `${PART_LABEL[p.held.part]} (${p.held.orientation}°)` : 'nothing'}
        </div>
        <button type="button" onClick={() => step({ step: 'ABORT_PROCEDURE' })} className="rounded border border-stone-700 px-2 py-1 text-stone-300 hover:bg-stone-800">Stop procedure and return unit to service</button>
      </Section>

      {/* Verification */}
      {p.verification && (
        <Section title="Verification" icon={p.verification.passed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}>
          <div className={`rounded border p-2.5 ${p.verification.passed ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-red-500/40 bg-red-950/20'}`}>
            <div className="font-semibold">{p.verification.passed ? 'Startup test passed' : 'Startup test failed'} (hour {p.verification.hour})</div>
            <table className="mt-1 w-full font-mono text-[11px]">
              <tbody>
                {p.verification.readings.map((r) => (
                  <tr key={r.id}>
                    <td className="pr-2 text-stone-400">{r.label}</td>
                    <td className="text-right text-stone-100">{r.value} {r.unit}</td>
                    <td className={`pl-2 text-right ${r.inRange ? 'text-emerald-400' : 'text-red-400'}`}>{r.inRange ? '✓' : '✗'} {r.expectedMin}–{r.expectedMax}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {p.verification.remainingIssues.map((i) => <p key={i} className="mt-1 text-red-200">{i}</p>)}
          </div>
        </Section>
      )}
    </div>
  );
};


export const TrainingPanel: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [advanced, setAdvanced] = useState(false);
  const viewMode = useMissionStore(s => s.viewMode);
  const setView = useMissionStore(s => s.setViewMode);
  const select = useMissionStore(s => s.selectModule);
  if (embedded) return <RecyclerWorkbench />;
  return <div>
    <div className="p-4 pb-0"><button type="button" className="game-button w-full" onClick={() => { select('water-recycler'); setView(viewMode === 'service' ? 'colony' : 'service'); }}>{viewMode === 'service' ? 'Return to Colony Overview' : 'Open equipment focus'}</button></div>
    <RecyclerWorkbench />
    <details className="m-4 border-t border-white/10 pt-3" onToggle={event => setAdvanced(event.currentTarget.open)}><summary className="cursor-pointer text-xs text-stone-400">Advanced training controls · development</summary>{advanced && <LegacyTrainingPanel />}</details>
  </div>;
};
