'use client';

import React from 'react';
import { useMissionStore } from '@/state/missionStore';
import { RED_STORM_CONFIG } from '@/simulation/config';
import { ALL_MODULE_IDS } from '@/simulation/types';
import { Rocket, MousePointerClick, SlidersHorizontal, Clock, FileSearch, Info } from 'lucide-react';

const HOW_TO_PLAY = [
  { icon: MousePointerClick, text: 'Click a module in the 3D habitat (or the list) to inspect it.' },
  { icon: SlidersHorizontal, text: 'Make decisions: suspend optional loads, repair failed equipment.' },
  { icon: Clock, text: 'Advance time with +1h / +6h or Run. The clock pauses when something needs your attention.' },
  { icon: FileSearch, text: 'When the mission ends, review what happened and try a different strategy.' },
];

export const MissionBriefing: React.FC = () => {
  const startMission = useMissionStore((s) => s.startMission);
  const modules = useMissionStore((s) => s.missionState.modules);
  const cfg = RED_STORM_CONFIG;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-widest text-orange-500 uppercase">MissionLab</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-800 font-mono">
              Mission Briefing
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-stone-100">{cfg.title}</h1>
          <p className="text-stone-300 leading-relaxed max-w-2xl">
            Mars, 2045. You are acting commander of a small research outpost with a crew of{' '}
            {cfg.crewCount}. A severe dust storm is about to cut your solar power, and later the water
            recycler will develop a fault. Every system shares one battery.
          </p>
        </header>

        <section className="grid sm:grid-cols-3 gap-3">
          <div className="p-4 rounded border border-mars-border bg-black/30">
            <div className="text-[11px] font-mono uppercase text-stone-400">Objective</div>
            <div className="text-stone-100 font-semibold mt-1">
              Keep the crew safe for {cfg.durationHours} hours
            </div>
          </div>
          <div className="p-4 rounded border border-mars-border bg-black/30">
            <div className="text-[11px] font-mono uppercase text-stone-400">Starting battery</div>
            <div className="text-stone-100 font-semibold mt-1">
              {cfg.initialResources.batteryKwh} / {cfg.initialResources.batteryCapacityKwh} kWh
            </div>
          </div>
          <div className="p-4 rounded border border-mars-border bg-black/30">
            <div className="text-[11px] font-mono uppercase text-stone-400">Storm solar output</div>
            <div className="text-stone-100 font-semibold mt-1">
              {cfg.normalSolarGenerationKw} kW → {cfg.stormSolarGenerationKw} kW
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-mono uppercase tracking-wider text-stone-400 mb-3">Your habitat systems</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {ALL_MODULE_IDS.map((id) => (
              <li key={id} className="p-3 rounded border border-mars-border/70 bg-black/20">
                <div className="text-sm font-semibold text-stone-100">{modules[id].name}</div>
                <div className="text-xs text-stone-400 mt-0.5">{modules[id].description}</div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-mono uppercase tracking-wider text-stone-400 mb-3">How to play</h2>
          <ol className="space-y-2">
            {HOW_TO_PLAY.map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-stone-300">
                <Icon className="w-4 h-4 mt-0.5 text-orange-400 shrink-0" aria-hidden />
                {text}
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
          <button
            onClick={startMission}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded bg-orange-600 hover:bg-orange-500 text-white font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          >
            <Rocket className="w-4 h-4" aria-hidden />
            Start mission
          </button>
          <p className="text-xs text-stone-500 flex items-start gap-1.5 max-w-md">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
            Simplified educational model. All values are fictional gameplay parameters, not NASA
            specifications or astronaut safety limits.
          </p>
        </div>
      </div>
    </main>
  );
};
