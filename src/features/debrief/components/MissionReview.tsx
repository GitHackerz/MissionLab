'use client';

import { useState } from 'react';
import { useMissionStore } from '@/state/missionStore';
import { compareBranches, getMissionSummary } from '@/simulation/debrief';

/** Thin consumer of engine evidence and session history; no physical calculations. */
export function MissionReview() {
  const { missionState, history, branches, applyAction } = useMissionStore();
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const summary = getMissionSummary(history);
  const previous = branches.at(-1);
  const comparison = previous ? compareBranches(previous, {
    branchId: missionState.branchId, forkHour: history.find(s => s.branchId === missionState.branchId)?.hour ?? 0,
    snapshots: history, finalStatus: missionState.status,
  }) : undefined;
  const selected = history.find(s => s.snapshotId === targetId) ?? history[0];

  return (
    <details className="fixed bottom-4 right-4 z-20 max-w-xl rounded border border-mars-border bg-[#140806] text-stone-200 shadow-xl">
      <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">Mission Autopsy &amp; Rewind</summary>
      <div className="max-h-[70vh] overflow-auto space-y-4 px-4 pb-4 text-sm">
        <p>{summary.status.toUpperCase()} · Hour {summary.finalHour} · {missionState.branchId}</p>
        {summary.failureReason && <p className="text-amber-300">{summary.failureReason}</p>}
        <table className="w-full text-left text-xs">
          <caption className="text-left pb-2">Resource reserves and safety margins</caption>
          <thead><tr><th>Resource</th><th>Final</th><th>Minimum margin</th></tr></thead>
          <tbody>
            <tr><th>Battery (kWh)</th><td>{summary.finalResources.batteryKwh.toFixed(2)}</td><td>{summary.minimumMargins.batteryKwh.toFixed(2)} (warning)</td></tr>
            <tr><th>Water (L)</th><td>{summary.finalResources.waterLiters.toFixed(2)}</td><td>{summary.minimumMargins.waterLiters.toFixed(2)}</td></tr>
            <tr><th>Oxygen (kg)</th><td>{summary.finalResources.oxygenKg.toFixed(2)}</td><td>{summary.minimumMargins.oxygenKg.toFixed(2)}</td></tr>
          </tbody>
        </table>
        <label className="block">Earlier hour or decision
          <select value={selected.snapshotId} onChange={e => setTargetId(e.target.value)} className="block w-full bg-stone-900 border border-stone-600 rounded p-2 mt-1">
            {history.map((snapshot, index) => <option key={snapshot.snapshotId} value={snapshot.snapshotId}>
              {index}: Hour {snapshot.hour} · {snapshot.actionTaken ? JSON.stringify(snapshot.actionTaken) : 'State'}
            </option>)}
          </select>
        </label>
        <button className="rounded bg-stone-700 px-3 py-2" onClick={() => {
          const result = applyAction({ type: 'REWIND_TO', hour: selected.hour,
            branchFrom: missionState.branchId, snapshotId: selected.snapshotId });
          setReason(result.ok ? 'Independent branch created. Choose alternative actions in the module inspector.' : result.reason);
          if (result.ok) setTargetId('');
        }}>Create alternative branch</button>
        {reason && <p role="status">{reason}</p>}
        {comparison && <section className="space-y-2">
          <h2 className="font-semibold">Comparison with {previous!.branchId}</h2>
          <p>{comparison.outcomeDiffDescription}</p>
          <p>Final changes: battery {comparison.resourceDelta.batteryKwh.toFixed(2)} kWh; water {comparison.resourceDelta.waterLiters.toFixed(2)} L; oxygen {comparison.resourceDelta.oxygenKg.toFixed(2)} kg; science {comparison.resourceDelta.scienceScore}.</p>
        </section>}
        <section><h2 className="font-semibold mb-2">Recorded causes and explanations</h2>
          <ul className="list-disc pl-4 space-y-2">{summary.autopsyCauseChain.map((line, i) => <li key={i}>{line}</li>)}</ul>
        </section>
      </div>
    </details>
  );
}
