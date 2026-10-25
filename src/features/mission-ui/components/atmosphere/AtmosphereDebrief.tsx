'use client';
import { useMissionStore } from '@/state/missionStore';
import { getAtmosphericSummary } from '@/simulation/missions/debrief';
import { compareBranches } from '@/simulation/debrief';
import { getMission } from '@/simulation/missions/registry';
import { EmergencyTelemetry } from './EmergencyTelemetry';

export function AtmosphereDebrief() {
  const {missionState:s,history,branches,applyAction}=useMissionStore();
  if (!s.emergency) return null;
  const summary=getAtmosphericSummary(history), def=getMission(s.scenarioId), previous=branches.at(-1);
  const comparison=previous?compareBranches(previous,{branchId:s.branchId,forkHour:0,snapshots:history,finalStatus:s.status}):null;
  const points=summary.timeline.map((x,i)=>`${i/Math.max(1,summary.timeline.length-1)*300},${100-Math.min(1,(s.emergency!.kind==='pressure'?x.pressureKpa/110:x.co2Ppm/def.emergency!.maximumCo2Ppm))*95}`).join(' ');
  return <div className="space-y-5 p-4 text-sm">
    <h2 className="text-xl font-semibold">Mission Autopsy · {def.title}</h2><p>{s.status.toUpperCase()} · {summary.terminationMinute} simulated minutes</p>{s.failureReason&&<p className="text-red-200">{s.failureReason}</p>}
    <EmergencyTelemetry compact/>
    <section><h3 className="font-semibold">What happened?</h3><p className="mt-2">{summary.rootCause?`Root cause: ${summary.rootCause}.`:'Root cause remains hidden while you investigate.'} {summary.verified?`Recovery was measured over ${summary.stableMinutes} consecutive safe minutes.`:'No successful monitored recovery is recorded.'}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><dt>Minimum occupied pressure</dt><dd>{summary.minimumPressureKpa.toFixed(2)} kPa</dd><dt>Maximum CO₂</dt><dd>{summary.maximumCo2Ppm.toFixed(0)} ppm</dd><dt>Minimum O₂ partial pressure</dt><dd>{summary.minimumOxygenKpa.toFixed(2)} kPa</dd><dt>Gas / cabin oxygen lost</dt><dd>{summary.gasLostMol.toFixed(2)} / {summary.oxygenLostMol.toFixed(2)} mol</dd><dt>CO₂ removed</dt><dd>{summary.co2RemovedMol.toFixed(2)} mol</dd></dl>
    </section>
    <section><h3 className="font-semibold">{s.emergency.kind==='pressure'?'Pressure':'CO₂'} timeline · actual occupied atmosphere</h3><svg role="img" aria-label="Atmospheric history plot" viewBox="0 0 300 105" className="mt-2 w-full rounded border border-white/20 bg-black/30"><polyline points={points} fill="none" stroke="#67e8f9" strokeWidth="2"/></svg><p className="text-xs text-stone-400">Time increases left to right. The table gives measured values; this plot is a schematic view of the recorded timeline.</p>
      <details className="mt-2"><summary className="cursor-pointer">Show recorded pressure / CO₂ values</summary><div className="max-h-48 overflow-auto"><table className="w-full text-xs"><thead><tr><th>Minute</th><th>Pressure kPa</th><th>CO₂ ppm</th></tr></thead><tbody>{summary.timeline.map((x,i)=><tr key={i}><td>{x.minute}</td><td>{x.pressureKpa.toFixed(2)}</td><td>{x.co2Ppm.toFixed(0)}</td></tr>)}</tbody></table></div></details>
    </section>
    <section><h3 className="font-semibold">Evidence, decisions and consequences</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-xs">{s.events.map(event=><li key={event.id}>Minute {(event.hour*60).toFixed(0)} · {event.message}</li>)}</ol></section>
    <section><h3 className="font-semibold">Learning performance · separate from survival</h3><ul className="mt-3 space-y-3">{summary.assessments.map(a=><li key={a.label} className="rounded border border-white/15 p-3"><b>{a.label}: {a.rating}</b><p className="mt-2 text-xs text-stone-300">{a.evidence}</p></li>)}</ul></section>
    <section><h3 className="font-semibold">Try another approach</h3><p className="mt-2 text-xs text-stone-300">Select a minute or the state before a decision. The original branch remains preserved.</p>
      <label className="mt-3 block">Rewind point<select aria-label="Atmospheric rewind point" defaultValue="" onChange={event=>{
        const snap=history.find(x=>x.snapshotId===event.target.value); if(snap)applyAction({type:'REWIND_TO',hour:snap.hour,branchFrom:s.branchId,snapshotId:snap.snapshotId});
      }} className="mt-2 w-full rounded border border-white/30 bg-slate-900 p-2"><option value="" disabled>Select an earlier point</option>{history.map((snap,i)=><option key={snap.snapshotId} value={snap.snapshotId}>{i} · minute {snap.state.emergency?.minute??0} · {snap.actionTaken?.type??'Initial state'}</option>)}</select></label>
    </section>
    {comparison&&<section aria-label="Atmospheric branch comparison"><h3 className="font-semibold">Earlier attempt versus this branch</h3><p className="mt-2 text-xs">{comparison.outcomeDiffDescription}</p><table className="mt-3 w-full text-xs"><thead><tr><th>Metric</th><th>Earlier</th><th>Now</th></tr></thead><tbody><tr><td>Outcome</td><td>{comparison.branchA.status}</td><td>{comparison.branchB.status}</td></tr><tr><td>Termination minute</td><td>{comparison.branchA.finalHour*60}</td><td>{comparison.branchB.finalHour*60}</td></tr><tr><td>Battery kWh</td><td>{comparison.branchA.finalResources.batteryKwh.toFixed(2)}</td><td>{comparison.branchB.finalResources.batteryKwh.toFixed(2)}</td></tr></tbody></table></section>}
    <p className="text-xs text-stone-400">{def.assumptions.join(' ')}</p>
  </div>;
}
