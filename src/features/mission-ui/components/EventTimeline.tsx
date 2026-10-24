'use client';

import React from 'react';
import { useMissionStore } from '@/state/missionStore';
import { AlertTriangle, Info, AlertOctagon, Radio } from 'lucide-react';
import { EventSeverity } from '@/simulation/types';

export const EventTimeline: React.FC = () => {
  const { missionState } = useMissionStore();

  const getSeverityIcon = (sev: EventSeverity) => {
    switch (sev) {
      case 'critical':
        return <AlertOctagon className="w-3.5 h-3.5 text-red-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    }
  };

  const reversedEvents = [...missionState.events].reverse();

  return (
    <div className="bg-[#120705] border-t border-mars-border px-4 py-2.5 h-36 flex flex-col select-none">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
          Mission Event Stream & Telemetry Log
        </span>
        <span className="text-[10px] font-mono text-stone-500">
          {missionState.events.length} Recorded Events
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {reversedEvents.map((evt) => (
          <div
            key={evt.id}
            className={`flex items-start space-x-2 text-xs p-1.5 rounded border ${
              evt.severity === 'critical'
                ? 'bg-red-950/40 border-red-500/40 text-red-200'
                : evt.severity === 'warning'
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                : 'bg-black/30 border-stone-800 text-stone-300'
            }`}
          >
            {getSeverityIcon(evt.severity)}
            <span className="font-mono text-[10px] text-stone-400 shrink-0">
              [H{evt.hour.toString().padStart(2, '0')}]
            </span>
            {evt.moduleId && (
              <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-stone-900 text-stone-400 shrink-0 uppercase">
                {evt.moduleId}
              </span>
            )}
            <span className="text-xs leading-tight flex-1">{evt.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
