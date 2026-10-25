'use client';

import React, { useState } from 'react';
import { useMissionStore } from '@/state/missionStore';
import { ModuleInspector } from './ModuleInspector';
import { TrainingPanel } from './TrainingPanel';
import { PowerPlanner } from './PowerPlanner';
import { MissionDebrief } from './MissionDebrief';

type Tab = 'systems' | 'training' | 'power' | 'debrief';

const TABS: { id: Tab; label: string }[] = [
  { id: 'training', label: 'Training' },
  { id: 'power', label: 'Power' },
  { id: 'systems', label: 'Systems' },
  { id: 'debrief', label: 'Debrief' },
];

/** Right-hand workspace: existing module inspector plus the learning panels. */
export const SidePanel: React.FC = () => {
  const [tab, setTab] = useState<Tab>('training');
  const { missionState } = useMissionStore();
  const t = missionState.training;
  const needsAttention = t && t.recycler.faultOnsetHour !== null && t.recycler.procedure.phase !== 'completed' && t.hypotheses.length === 0;
  const concluded = missionState.status === 'success' || missionState.status === 'failed';

  return (
    <aside className="flex h-full w-full flex-col border-l border-mars-border bg-[#150a08] lg:w-[24rem]">
      <div role="tablist" aria-label="Mission workspace" className="flex border-b border-mars-border bg-black/30">
        {TABS.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            id={`tab-${x.id}`}
            aria-controls={`panel-${x.id}`}
            onClick={() => setTab(x.id)}
            className={`relative flex-1 px-2 py-2 font-mono text-[11px] uppercase tracking-wider transition ${tab === x.id ? 'border-b-2 border-orange-500 bg-black/40 text-orange-300' : 'text-stone-400 hover:text-stone-200'}`}
          >
            {x.label}
            {((x.id === 'training' && needsAttention) || (x.id === 'debrief' && concluded)) && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" aria-label="needs attention" />}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'systems' && <ModuleInspector />}
        {tab === 'training' && <TrainingPanel />}
        {tab === 'power' && <PowerPlanner />}
        {tab === 'debrief' && <MissionDebrief />}
      </div>
    </aside>
  );
};
