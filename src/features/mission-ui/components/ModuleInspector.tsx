'use client';

import React from 'react';
import { useMissionStore } from '@/state/missionStore';
import { ALL_MODULE_IDS, ModuleStatus, MissionAction } from '@/simulation/types';
import {
  Wrench,
  Power,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from 'lucide-react';

const STATUS_CONFIG: Record<
  ModuleStatus,
  { label: string; color: string; border: string; icon: React.ReactNode }
> = {
  operational: {
    label: 'OPERATIONAL',
    color: 'text-emerald-400 bg-emerald-950/60',
    border: 'border-emerald-500/40',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  },
  warning: {
    label: 'WARNING',
    color: 'text-amber-400 bg-amber-950/60',
    border: 'border-amber-500/40',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  },
  degraded: {
    label: 'DEGRADED',
    color: 'text-orange-400 bg-orange-950/60',
    border: 'border-orange-500/40',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />,
  },
  offline: {
    label: 'OFFLINE',
    color: 'text-red-400 bg-red-950/60',
    border: 'border-red-500/40',
    icon: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  },
  repairing: {
    label: 'REPAIRING',
    color: 'text-cyan-400 bg-cyan-950/60',
    border: 'border-cyan-500/40',
    icon: <Clock className="w-3.5 h-3.5 text-cyan-400 animate-spin" />,
  },
};

export const ModuleInspector: React.FC = () => {
  const { missionState, selectedModuleId, selectModule, availableActions, applyAction } =
    useMissionStore();

  const selectedModule = selectedModuleId
    ? missionState.modules[selectedModuleId]
    : missionState.modules['water-recycler'];

  const statusInfo = STATUS_CONFIG[selectedModule.status] || STATUS_CONFIG.operational;

  // Filter actions applicable to the selected module
  const relevantActions = availableActions.filter((act) => {
    if (selectedModule.id === 'greenhouse' && act.id === 'toggle-greenhouse') return true;
    if (selectedModule.id === 'research-lab' && act.id === 'toggle-research-lab') return true;
    if (selectedModule.id === 'water-recycler' && act.id === 'repair-water-recycler') return true;
    return false;
  });

  return (
    <aside id="tour-inspector" className="w-full lg:w-80 bg-[#150a08] border-l border-mars-border flex flex-col h-full select-none">
      {/* Header & Quick Selector */}
      <div className="p-3 border-b border-mars-border bg-black/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-orange-400" />
            Habitat Inspection
          </span>
          <span className="text-[10px] font-mono text-stone-500">7 Subsystems</span>
        </div>

        {/* Quick Module Selection Pills (Bidirectional Sync) */}
        <div className="flex flex-wrap gap-1">
          {ALL_MODULE_IDS.map((id) => {
            const isCurrent = selectedModule.id === id;
            const mod = missionState.modules[id];
            return (
              <button
                key={id}
                onClick={() => selectModule(id)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded transition ${
                  isCurrent
                    ? 'bg-orange-600 text-white font-bold'
                    : 'bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800'
                }`}
              >
                {mod.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Module Overview Details */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* Module Title & Status */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-stone-100">{selectedModule.name}</h2>
          </div>
          <div className="font-mono text-[11px] text-stone-500 uppercase tracking-wider mb-2">
            ID: {selectedModule.id}
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono font-semibold ${statusInfo.color} ${statusInfo.border}`}
          >
            {statusInfo.icon}
            {statusInfo.label}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-stone-300 leading-relaxed bg-black/30 p-2.5 rounded border border-mars-border/50">
          {selectedModule.description}
        </p>

        {/* Telemetry Metrics */}
        <div className="space-y-2.5 text-xs font-mono">
          {/* Health Bar */}
          <div>
            <div className="flex justify-between text-stone-400 mb-1">
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-orange-400" /> Equipment Health
              </span>
              <span className="text-stone-200">{(selectedModule.health * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-stone-900 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full ${
                  selectedModule.health < 0.5
                    ? 'bg-red-500'
                    : selectedModule.health < 0.8
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${selectedModule.health * 100}%` }}
              />
            </div>
          </div>

          {/* Power Demand vs Supplied */}
          <div className="p-2 rounded bg-black/40 border border-mars-border/60 space-y-1">
            <div className="flex justify-between text-stone-400">
              <span className="flex items-center gap-1">
                <Power className="w-3.5 h-3.5 text-amber-400" /> Power Demand:
              </span>
              <span className="text-stone-200">{selectedModule.powerDemandKw} kW</span>
            </div>
            <div className="flex justify-between text-stone-400">
              <span>Supplied Power:</span>
              <span className={selectedModule.suppliedPowerKw > 0 ? 'text-emerald-400' : 'text-stone-500'}>
                {selectedModule.suppliedPowerKw} kW
              </span>
            </div>
          </div>

          {selectedModule.repairHoursRemaining !== undefined && (
            <div className="p-2 rounded bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Work Remaining:
              </span>
              <span className="font-bold">{selectedModule.repairHoursRemaining} Hours</span>
            </div>
          )}
        </div>

        {/* Operational Actions Section */}
        <div className="pt-2 border-t border-mars-border">
          <div className="text-[11px] font-mono uppercase tracking-wider text-stone-400 mb-2 flex items-center gap-1">
            <Wrench className="w-3.5 h-3.5 text-orange-400" />
            Operational Decisions
          </div>

          {relevantActions.length === 0 ? (
            <div className="text-xs text-stone-500 italic p-3 bg-black/20 rounded border border-stone-800">
              No operational overrides required for this subsystem in the current mission state.
            </div>
          ) : (
            <div className="space-y-2">
              {relevantActions.map((act) => (
                <div
                  key={act.id}
                  className="p-3 bg-black/40 border border-mars-border rounded space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-200">{act.label}</span>
                    {act.powerDeltaKw !== undefined && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          act.powerDeltaKw < 0
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {act.powerDeltaKw > 0 ? `+${act.powerDeltaKw}` : act.powerDeltaKw} kW
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400 leading-snug">{act.description}</p>
                  <button
                    onClick={() => {
                      if (act.payload) {
                        applyAction(act.payload as MissionAction);
                      }
                    }}
                    disabled={!act.enabled}
                    className="w-full py-1.5 px-3 bg-orange-600 hover:bg-orange-500 disabled:bg-stone-800 disabled:text-stone-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition"
                  >
                    {act.enabled ? 'Confirm Decision' : act.disabledReason || 'Unavailable'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
