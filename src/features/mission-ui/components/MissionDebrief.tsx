'use client';

import React, { useMemo } from 'react';
import { History, Undo2, ScrollText } from 'lucide-react';
import { useMissionStore } from '@/state/missionStore';
import { assessLearning, type Rating } from '@/simulation/training/assessment';
import { getMissionSummary } from '@/simulation/debrief';
import type { MissionSnapshot } from '@/simulation/types';
import { soundManager } from '@/features/audio/soundManager';


const RATING: Record<Rating, { label: string; cls: string }> = {
  proficient: { label: 'Proficient', cls: 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300' },
  developing: { label: 'Developing', cls: 'border-amber-500/50 bg-amber-950/40 text-amber-300' },
  'not-demonstrated': { label: 'Not yet shown', cls: 'border-stone-600 bg-stone-900 text-stone-400' },
};

function describe(s: MissionSnapshot): string | null {
  const a = s.actionTaken;
  if (!a) return null;
  switch (a.type) {
    case 'APPLY_POWER_PLAN': return 'Applied a power plan';
    case 'RUN_DIAGNOSTIC': return `Ran test: ${a.testId.replace(/-/g, ' ')}`;
    case 'RECORD_HYPOTHESIS': return `Recorded diagnosis: ${a.kind.replace(/-/g, ' ')}`;
    case 'TRAINING_STEP': {
      const st = a.step.step;
      return ['INSTALL_COMPONENT', 'RUN_STARTUP_TEST', 'ENTER_MAINTENANCE_MODE'].includes(st) ? `Procedure: ${st.replace(/_/g, ' ').toLowerCase()}` : null;
    }
    case 'SET_ENABLED': return `${a.moduleId} ${a.enabled ? 'on' : 'off'}`;
    default: return null;
  }
}

export const MissionDebrief: React.FC = () => {
  const { missionState, history, branches, applyAction } = useMissionStore();
  const assessment = useMemo(() => assessLearning(missionState), [missionState]);
  const decisions = useMemo(() => history.map((s, i) => ({ s, i, text: describe(s) })).filter((d) => d.text), [history]);
  const summary = useMemo(() => getMissionSummary(history), [history]);
  const previous = branches.length ? getMissionSummary(branches[branches.length - 1].snapshots) : null;
  const startResources = history[0].state.resources;
  const nextExperiment = summary.rootCause?.kind === 'power' ? 'Compare the forecast after changing an optional electrical load. Keep essential air and heating supplied.' : summary.rootCause?.kind === 'water' ? 'Investigate the first low-recovery warning earlier. Compare independent readings before using a spare.' : summary.rootCause?.kind === 'oxygen' ? 'Check actual Life Support allocation and oxygen production before waiting again.' : 'Try keeping more scientific work active while preserving safe air, water and battery margins.';
  const concluded = missionState.status === 'success' || missionState.status === 'failed';

  return (
    <div className="space-y-5 p-4 text-xs">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-stone-100"><ScrollText className="h-4 w-4 text-orange-400" /> Mission Autopsy</h2>
        <p className="mt-1 leading-relaxed text-stone-300">
          {concluded ? (missionState.status === 'success' ? 'Mission accomplished.' : `Mission failed: ${missionState.failureReason ?? ''}`) : 'The mission is still running. This debrief updates as you act, and every statement comes from what you actually did.'}
        </p>
      </div>

      <section aria-label="Mission evidence summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Mission clock', `${missionState.hour.toFixed(1)} / ${missionState.durationHours} h`],
          ['Water reserve', `${missionState.resources.waterLiters.toFixed(1)} L`],
          ['Evidence collected', `${missionState.training?.evidence.length ?? 0} tests`],
          ['Startup verification', missionState.training?.recycler.procedure.verification ? (missionState.training.recycler.procedure.verification.passed ? 'Passed' : 'Failed') : 'Not yet run'],
        ].map(([label, value]) => <div key={label} className="rounded border border-sky-300/20 bg-sky-950/20 p-3"><div className="text-xs text-stone-400">{label}</div><div className="mt-1 text-lg text-sky-100">{value}</div></div>)}
      </section>
      <section aria-label="Resource changes" className="rounded border border-white/15 p-4">
        <h3 className="mb-3 text-base font-semibold">What changed on this branch?</h3>
        <table className="w-full text-sm"><thead className="text-left text-xs text-stone-400"><tr><th>Reserve</th><th className="text-right">First recorded</th><th className="text-right">Now</th></tr></thead><tbody>{[
          ['Battery', `${startResources.batteryKwh.toFixed(1)} kWh`, `${summary.finalResources.batteryKwh.toFixed(1)} kWh`],
          ['Water', `${startResources.waterLiters.toFixed(1)} L`, `${summary.finalResources.waterLiters.toFixed(1)} L`],
          ['Oxygen', `${startResources.oxygenKg.toFixed(1)} kg`, `${summary.finalResources.oxygenKg.toFixed(1)} kg`],
        ].map(([label, start, end]) => <tr key={label} className="border-t border-white/10"><td className="py-2 text-stone-300">{label}</td><td className="text-right font-mono text-stone-400">{start}</td><td className="text-right font-mono text-sky-100">{end}</td></tr>)}</tbody></table>
        <p className="mt-3 text-xs text-stone-400">Lowest water margin above the failure limit: {summary.minimumMargins.waterLiters.toFixed(2)} L. Rewinding restores recorded state; used parts and elapsed time are compared on their actual branches.</p>
      </section>
      {concluded && <section className="rounded border border-orange-200/25 bg-orange-950/15 p-4"><h3 className="text-base font-semibold text-orange-100">Your next experiment</h3><p className="mt-2 text-sm leading-relaxed text-stone-300">{nextExperiment} Choose a recorded decision below and rewind before it.</p></section>}
      <details className="rounded border border-mars-border p-3"><summary className="cursor-pointer text-sm text-orange-200">Trace the outcome to its causes</summary><ol className="mt-3 list-decimal space-y-2 pl-4 leading-relaxed text-stone-300">{summary.autopsyCauseChain.map((cause, i) => <li key={i}>{cause}</li>)}</ol></details>
      <p className="text-sm leading-relaxed text-stone-300">Reflect: which measurement changed your mind? Rewind a decision below and test one change. Compare the reserve margins with your earlier attempt.</p>
      {assessment && (
        <details className="rounded border border-white/15 p-4"><summary className="mb-3 cursor-pointer text-sm font-semibold text-sky-100">Learning record · evidence, concepts and consequences</summary>
          <ul className="space-y-2" aria-label="Learning assessment">
            {assessment.dimensions.map((d) => (
              <li key={d.id} className="rounded border border-mars-border bg-black/30 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-stone-100">{d.label}</span>
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${RATING[d.rating].cls}`}>{RATING[d.rating].label}</span>
                </div>
                <p className="mt-1 leading-snug text-stone-300">{d.explanation}</p>
              </li>
            ))}
          </ul>

          {assessment.consequences.length > 0 && (
            <section>
              <h3 className="mb-1 font-mono text-[11px] uppercase tracking-wider text-stone-400">Consequences</h3>
              <ul className="list-disc space-y-1 pl-4 text-stone-300">{assessment.consequences.map((c) => <li key={c}>{c}</li>)}</ul>
            </section>
          )}

          <section>
            <h3 className="mb-1 font-mono text-[11px] uppercase tracking-wider text-stone-400">What happened, in order</h3>
            <ol className="list-decimal space-y-1 pl-4 text-stone-300">{assessment.causalChain.map((c, i) => <li key={i}>{c}</li>)}</ol>
          </section>
        </details>
      )}

      <section>
        <h3 className="mb-1 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-stone-400"><History className="h-3.5 w-3.5" /> Decisions: rewind to try another approach</h3>
        {decisions.length === 0 ? (
          <p className="text-stone-500">No decisions yet.</p>
        ) : (
          <ul className="space-y-1">
            {decisions.map(({ s, i, text }) => (
              <li key={s.snapshotId} className="flex items-center justify-between gap-2 rounded border border-mars-border/60 bg-black/20 px-2 py-1">
                <span><span className="font-mono text-stone-500">H{s.hour}</span> {text}</span>
                <button type="button" onClick={() => {
                  soundManager.playClick();
                  const before = history[Math.max(0, i - 1)];
                  applyAction({ type: 'REWIND_TO', hour: before.hour, branchFrom: missionState.branchId, snapshotId: before.snapshotId });
                }} className="flex items-center gap-1 rounded border border-stone-600 px-1.5 py-0.5 text-[10px] text-stone-200 hover:bg-stone-800">
                  <Undo2 className="h-3 w-3" aria-hidden /> Rewind before this
                </button>

              </li>
            ))}
          </ul>
        )}
      </section>

      {previous && (
        <section>
          <h3 className="mb-1 font-mono text-[11px] uppercase tracking-wider text-stone-400">Compare with your earlier attempt</h3>
          <table className="w-full font-mono text-[11px]">
            <thead><tr className="text-left text-stone-500"><th className="font-normal" /><th className="font-normal">Earlier</th><th className="font-normal">Now</th></tr></thead>
            <tbody className="text-stone-200">
              <tr><td className="text-stone-400">Outcome</td><td>{previous.status}</td><td>{summary.status}</td></tr>
              <tr><td className="text-stone-400">Hour reached</td><td>{previous.finalHour}</td><td>{summary.finalHour}</td></tr>
              <tr><td className="text-stone-400">Battery (kWh)</td><td>{previous.finalResources.batteryKwh.toFixed(1)}</td><td>{summary.finalResources.batteryKwh.toFixed(1)}</td></tr>
              <tr><td className="text-stone-400">Water (L)</td><td>{previous.finalResources.waterLiters.toFixed(1)}</td><td>{summary.finalResources.waterLiters.toFixed(1)}</td></tr>
              <tr><td className="text-stone-400">Lowest water (L)</td><td>{previous.minWaterLiters}</td><td>{summary.minWaterLiters}</td></tr>
              <tr><td className="text-stone-400">Science</td><td>{previous.scienceScore}</td><td>{summary.scienceScore}</td></tr>
            </tbody>
          </table>
          <p className="mt-1 text-stone-400">Both runs start from the same saved state, so any difference comes from the decisions you changed.</p>
        </section>
      )}
    </div>
  );
};
