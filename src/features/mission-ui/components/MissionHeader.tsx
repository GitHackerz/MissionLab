'use client';

import { getMission } from '@/simulation/missions/registry';
import React from 'react';
import { FIXTURES_ENABLED, useMissionStore } from '@/state/missionStore';
import { Play, RotateCcw, FastForward, AlertTriangle, ShieldCheck, Skull } from 'lucide-react';

export const MissionHeader: React.FC<{ account?: React.ReactNode; onTrainingMenu?:()=>void }> = ({ account, onTrainingMenu }) => {
  const { missionState, advanceTime, applyAction, resetMission, loadFixture, activeFixtureKey, autoRunning, setAutoRunning } =
    useMissionStore();

  const getStatusBadge = () => {
    switch (missionState.status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-semibold uppercase">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Mission Accomplished
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-semibold uppercase">
            <Skull className="w-3.5 h-3.5 text-red-400" />
            Mission Failed
          </span>
        );
      case 'running':
      default:
        return missionState.stormActive ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300 text-xs font-semibold uppercase">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Storm Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-950/80 border border-blue-500/50 text-blue-300 text-xs font-semibold uppercase">
            {missionState.emergency ? 'Atmospheric monitoring' : 'Nominal State'}
          </span>
        );
    }
  };

  return (
    <header className="bg-[#140806] border-b border-mars-border px-4 py-3 flex flex-wrap items-center justify-between gap-4 select-none">
      {/* Brand & Mission Title */}
      <div className="flex items-center space-x-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-base tracking-widest text-orange-500 uppercase">
              MissionLab
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-800 font-mono">
              LUMEN 2.0
            </span>
          </div>
          <h1 className="text-sm font-semibold text-stone-200">
            Mission {getMission(missionState.scenarioId).number}: {getMission(missionState.scenarioId).title} (2045)
          </h1>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {/* Center: Mission Time Clock */}
      <div id="tour-clock" className="flex items-center space-x-3 bg-black/40 border border-mars-border px-4 py-1.5 rounded-lg">
        <div className="text-right">
          <div className="text-[10px] uppercase font-mono tracking-wider text-stone-400">
            Simulation Clock
          </div>
          <div className="text-lg font-mono font-bold text-amber-400">
            HOUR {missionState.emergency ? missionState.hour.toFixed(2) : missionState.hour.toString().padStart(2, '0')}{' '}
            <span className="text-xs text-stone-500 font-normal">/ {missionState.durationHours}h</span>
          </div>
        </div>

        {/* Time Steppers */}
        <div className="flex items-center space-x-1 pl-2 border-l border-mars-border">
          <button
            onClick={() => missionState.emergency ? applyAction({ type:'ADVANCE_MINUTES', minutes:1 }) : advanceTime(1)}
            disabled={missionState.status === 'success' || missionState.status === 'failed'}
            className="flex items-center gap-1 px-2.5 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:pointer-events-none rounded text-xs font-mono text-stone-200 transition"
            title="Advance 1 simulation hour"
          >
            <Play className="w-3 h-3 text-emerald-400" />
            {missionState.emergency ? '+1m' : '+1h'}
          </button>
          <button
            onClick={() => missionState.emergency ? applyAction({ type:'ADVANCE_MINUTES', minutes:5 }) : advanceTime(6)}
            disabled={missionState.status === 'success' || missionState.status === 'failed'}
            className="flex items-center gap-1 px-2.5 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:pointer-events-none rounded text-xs font-mono text-stone-200 transition"
            title="Fast-forward 6 simulation hours"
          >
            <FastForward className="w-3 h-3 text-amber-400" />
            {missionState.emergency ? '+5m' : '+6h'}
          </button>
          <button disabled={missionState.status !== 'running'} className="game-button text-xs" onClick={()=>setAutoRunning(!autoRunning)}>{autoRunning?'Pause auto-run':'Auto-run'}</button>
          <button
            onClick={resetMission}
            className="flex items-center gap-1 px-2.5 py-1 bg-stone-900 hover:bg-stone-800 border border-stone-700 rounded text-xs font-mono text-stone-300 transition"
            title="Reset mission to initial conditions"
          >
            <RotateCcw className="w-3 h-3 text-stone-400" />
            Reset
          </button>
        </div>
      </div>

      {/* Right: dev-only fixture switcher, then the account area */}
      <div className="flex items-center gap-3">
        {FIXTURES_ENABLED && !missionState.emergency && (
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono uppercase text-stone-400">
              Dev Fixture:
            </span>
            <select
              value={activeFixtureKey}
              onChange={(e) => loadFixture(e.target.value)}
              className="bg-black/70 border border-mars-border text-xs rounded px-2.5 py-1 text-stone-300 focus:outline-none focus:border-orange-500 font-mono"
            >
              <option value="initial">Live Engine State</option>
              <option value="demo-fault">Demo: Recycler Fault (engine, 30h)</option>
              <option value="normal">Fixture: Normal</option>
              <option value="storm">Fixture: Storm (4h)</option>
              <option value="water-recycler-degraded">Fixture: Recycler Fault (30h)</option>
              <option value="critical-energy">Fixture: Critical Energy (22h)</option>
              <option value="success">Fixture: Mission Success (72h)</option>
              <option value="failed">Fixture: Life Support Blackout</option>
            </select>
          </div>
        )}
        {onTrainingMenu&&<button className="game-button text-xs" onClick={onTrainingMenu}>Training menu</button>}
        {account}
      </div>
    </header>
  );
};
