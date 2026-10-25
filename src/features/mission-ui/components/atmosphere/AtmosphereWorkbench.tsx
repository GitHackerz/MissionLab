'use client';
import { useState } from 'react';
import { useMissionStore } from '@/state/missionStore';
import { getMission } from '@/simulation/missions/registry';
import { COMPONENT_LABELS, FAULT_COMPONENT, PROCEDURE_STEPS, TEST_LABELS } from '@/simulation/missions/emergency';
import { getEmergencyObjective } from '@/simulation/missions/presentation';
import type { ComponentId, EmergencyCommand, FaultId } from '@/simulation/missions/types';
import { EmergencyTelemetry } from './EmergencyTelemetry';
import { FankouchCompanion } from './FankouchCompanion';

const FAULT_NAMES: Record<FaultId,string> = { 'seal-leak':'Damaged hatch seal', 'valve-stuck':'Isolation valve stuck open', 'pressure-sensor-drift':'Pressure instrument drift', 'fan-failure':'Circulation fan failure', 'media-exhausted':'Scrubber media exhausted', 'co2-sensor-drift':'CO₂ instrument drift' };
export function AtmosphereWorkbench() {
  const {missionState:s,applyAction,setAutoRunning,lastFeedback}=useMissionStore();
  const [evidence,setEvidence]=useState<string[]>([]), [hypothesis,setHypothesis]=useState<FaultId|null>(null), [part,setPart]=useState<ComponentId|null>(null);
  const e=s.emergency;
  if (!e) return null;
  const def=getMission(s.scenarioId), objective=getEmergencyObjective(s), ended=s.status!=='running';
  const send=(command:EmergencyCommand)=>{setAutoRunning(false);applyAction({type:'EMERGENCY_ACTION',command});};
  const chosen=part ?? (e.hypotheses.at(-1)?FAULT_COMPONENT[e.hypotheses.at(-1)!.fault]:def.components[0]);
  return <div className="space-y-5 p-4 text-sm">
    <header><div className="text-xs uppercase tracking-widest text-cyan-200">{def.title} · {objective.stage}</div><h2 className="mt-2 text-xl font-semibold">Atmospheric engineering console</h2><p className="mt-2 text-stone-300">{objective.title}</p>{e.mode!=='commander'&&<p className="mt-2 text-xs text-stone-400">{objective.detail}</p>}<p className="mt-2 font-mono text-xs">H{s.hour.toFixed(2)} · {e.minute} mission minutes · crew: {e.crewZone}</p></header>
    <div className="sticky top-0 z-10 bg-[#111e26]"><EmergencyTelemetry compact/></div>
    <FankouchCompanion/>
    <fieldset className="flex flex-wrap gap-3"><legend className="mb-2 text-xs text-stone-400">Guidance · same physics</legend>{(['cadet','engineer','commander'] as const).map(mode=><label key={mode}><input type="radio" name="atmospheric-guidance" checked={e.mode===mode} onChange={()=>send({kind:'guidance',mode})}/><span className="ml-1 capitalize">{mode}</span></label>)}</fieldset>
    {ended&&<p role="status" className="rounded border border-amber-300 p-3">{s.status==='success'?'Verified recovery.':s.failureReason} Open Debrief to inspect evidence or rewind.</p>}
    <section aria-label="Inspectable equipment"><h3 className="mb-2 font-semibold">Trace the equipment</h3><div className="flex flex-wrap gap-2">{def.components.map(component=><button disabled={ended} key={component} className="game-button text-xs" onClick={()=>{setPart(component);send({kind:'inspect',component});}}>Inspect {COMPONENT_LABELS[component]} (1 min)</button>)}</div></section>
    <section aria-label="Atmospheric diagnostics"><h3 className="mb-2 font-semibold">Collect evidence</h3><p className="mb-3 text-xs text-stone-400">Readings are stamped at collection time. Every diagnostic takes 2 simulated minutes; all environmental processes continue.</p><div className="grid gap-2">{def.diagnosticTests.map(test=><button disabled={ended} key={test} className="game-button text-left" onClick={()=>send({kind:'diagnostic',test})}>{TEST_LABELS[test]} (2 min)</button>)}</div>
      {e.evidence.map(record=><div key={record.id} className="mt-3 rounded border border-white/20 p-3"><label className="flex gap-2"><input type="checkbox" checked={evidence.includes(record.id)} onChange={ev=>setEvidence(ev.target.checked?[...evidence,record.id]:evidence.filter(id=>id!==record.id))}/><span>{TEST_LABELS[record.test]} · minute {record.minute}</span></label><table className="mt-2 w-full text-xs"><tbody>{record.readings.map(r=><tr key={r.label}><th className="py-1 text-left font-normal text-stone-400">{r.label}</th><td className="text-right font-mono">{r.value.toFixed(3)} {r.unit}</td></tr>)}</tbody></table></div>)}
    </section>
    <fieldset className="space-y-2 rounded border border-white/20 p-3"><legend className="px-1">What explains the observations?</legend>{(Object.keys(FAULT_NAMES) as FaultId[]).filter(f=>def.components.includes(FAULT_COMPONENT[f])).map(f=><label key={f} className="block"><input type="radio" name="atmospheric-hypothesis" checked={hypothesis===f} onChange={()=>setHypothesis(f)}/> {FAULT_NAMES[f]}</label>)}
      <button disabled={ended||!hypothesis||!evidence.length} className="game-button w-full" onClick={()=>hypothesis&&send({kind:'hypothesis',fault:hypothesis,evidenceIds:evidence})}>Record supported hypothesis (1 min)</button>{!evidence.length&&<p className="text-xs text-stone-400">Collect and select at least one evidence record first.</p>}
    </fieldset>
    <section aria-label="Emergency response controls" className="space-y-2"><h3 className="font-semibold">Act on the system</h3>
      {e.kind==='pressure'?<>
        <button disabled={ended} className="game-button w-full" onClick={()=>send({kind:'valve',open:!e.valveCommandOpen})}>{e.valveCommandOpen?'Close isolation valve':'Open isolation valve'} (1 min)</button><p className="text-xs text-stone-300">Command: {e.valveCommandOpen?'open':'closed'} · actual: {e.valveActualOpen?'open':'closed'}</p>
        <button disabled={ended} className="game-button w-full" onClick={()=>send({kind:'exchange',enabled:!e.exchangeEnabled})}>{e.exchangeEnabled?'Isolate secondary air exchange':'Restore secondary air exchange'} (1 min)</button>
        <button disabled={ended} className="game-button w-full" onClick={()=>send({kind:'regulator',enabled:!e.regulatorEnabled})}>{e.regulatorEnabled?'Stop':'Activate'} backup pressure regulator (1 min)</button>
        <button disabled={ended} className="game-button w-full" onClick={()=>send({kind:'crew',zone:e.crewZone==='hub'?'service':'hub'})}>Move crew to {e.crewZone==='hub'?'service':'hub'} (1 min)</button>
      </>:<>{(['fan','scrubber','backup'] as const).map(kind=><button key={kind} disabled={ended} className="game-button w-full" onClick={()=>send({kind,enabled:!(kind==='fan'?e.fanEnabled:kind==='scrubber'?e.scrubberEnabled:e.backupEnabled)})}>{kind==='fan'?(e.fanEnabled?'Stop circulation fan':'Start circulation fan'):kind==='scrubber'?(e.scrubberEnabled?'Stop scrubber':'Start scrubber'):(e.backupEnabled?'Stop backup treatment':'Activate backup treatment')} (1 min)</button>)}</>}
    </section>
    <section aria-label="Atmospheric maintenance" className="space-y-3"><h3 className="font-semibold">Plan the intervention</h3><label className="block">Component to service<select aria-label="Component to service" value={chosen} onChange={event=>setPart(event.target.value as ComponentId)} className="mt-2 w-full rounded border border-white/30 bg-slate-900 p-2">{def.components.map(component=><option key={component} value={component}>{COMPONENT_LABELS[component]} · {e.spares[component]} spare</option>)}</select></label>
      {chosen.endsWith('sensor')?<button disabled={ended} className="game-button w-full" onClick={()=>send({kind:'calibrate',component:chosen})}>Calibrate against reference (3 min)</button>:<button disabled={ended||Boolean(e.procedure)} className="game-button w-full" onClick={()=>send({kind:'begin-repair',component:chosen})}>Begin {COMPONENT_LABELS[chosen]} service (1 min)</button>}
      {e.procedure&&<div className="rounded border border-cyan-300/50 p-4"><p className="font-semibold">{COMPONENT_LABELS[e.procedure.component]} · step {e.procedure.step+1} / {PROCEDURE_STEPS.length}</p>{e.mode==='cadet'&&<p className="mt-2 text-xs text-stone-300">{e.kind==='pressure'?'Keep crew in the hub and isolate the service zone. Use the sealed remote maintenance port.':'Stop the fan and scrubber before opening their service cover. Keep life support powered.'}</p>}<button data-testid="atmospheric-procedure-action" disabled={ended} className="game-button mt-3 w-full" onClick={()=>send({kind:'procedure',step:e.procedure!.step})}>{PROCEDURE_STEPS[e.procedure.step].label} ({PROCEDURE_STEPS[e.procedure.step].minutes} min)</button></div>}
    </section>
    <section className="space-y-2"><h3 className="font-semibold">Prove the recovery</h3><button disabled={ended||Boolean(e.procedure)} className="game-button w-full" onClick={()=>send({kind:'verify'})}>Run monitored {e.kind==='pressure'?'pressure-hold':'air-recovery'} test ({def.emergency!.verificationMinutes} min)</button><p className="text-xs text-stone-400">All safety, trend and physical conditions must hold throughout the window. A wrong replacement does not clear the fault.</p>{e.verification&&<p role="status">{e.verification.passed?'Verification passed.':e.verification.reason} Stable minutes: {e.stableMinutes}.</p>}</section>
    <section className="flex flex-wrap gap-2" aria-label="Wait controls">{[1,5,15].map(minutes=><button disabled={ended} key={minutes} className="game-button" onClick={()=>applyAction({type:'ADVANCE_MINUTES',minutes})}>Wait +{minutes} min</button>)}</section>
    {lastFeedback&&<div role="status" className="rounded border border-orange-300/30 p-3 text-xs"><b>{lastFeedback.title}</b><p className="mt-2">{lastFeedback.body}</p></div>}
  </div>;
}
