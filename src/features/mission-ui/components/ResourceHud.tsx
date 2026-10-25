'use client';

import React from 'react';
import { useMissionStore } from '@/state/missionStore';
import { Zap, Droplets, Wind, Users, Award, AlertCircle } from 'lucide-react';
import { RED_STORM_CONFIG } from '@/simulation/config';

export const ResourceHud: React.FC = () => {
  const { missionState } = useMissionStore();
  const { resources } = missionState;

  const batteryPct = Math.min(
    100,
    Math.max(0, (resources.batteryKwh / resources.batteryCapacityKwh) * 100)
  );
  const isBatteryLow = resources.batteryKwh <= RED_STORM_CONFIG.batterySafetyThresholdKwh;
  const isWaterLow = resources.waterLiters <= RED_STORM_CONFIG.waterSafetyThresholdLiters;
  const isOxygenLow = resources.oxygenKg <= RED_STORM_CONFIG.oxygenSafetyThresholdKg;

  return (
    <div id="tour-resources" className="bg-[#180b08] border-b border-mars-border px-4 py-2.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 select-none">
      {/* 1. Electrical Power */}
      <div className={`p-2 rounded border ${isBatteryLow ? 'bg-red-950/40 border-red-500/60' : 'bg-black/30 border-mars-border/80'}`}>
        <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
          <span className="flex items-center gap-1">
            <Zap className={`w-3.5 h-3.5 ${isBatteryLow ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
            <span className="font-semibold text-stone-300">BATTERY</span>
          </span>
          <span className="font-mono text-[11px]">
            {resources.batteryKwh.toFixed(1)} / {resources.batteryCapacityKwh} kWh
          </span>
        </div>
        <div className="w-full bg-stone-900 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isBatteryLow ? 'bg-red-500' : batteryPct < 40 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${batteryPct}%` }}
          />
        </div>
        {isBatteryLow && (
          <div className="text-[10px] text-red-400 mt-1 flex items-center gap-1 font-mono">
            <AlertCircle className="w-3 h-3" /> &lt; 15 kWh Reserve!
          </div>
        )}
      </div>

      {/* 2. Potable Water */}
      <div className={`p-2 rounded border ${isWaterLow ? 'bg-red-950/40 border-red-500/60' : 'bg-black/30 border-mars-border/80'}`}>
        <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
          <span className="flex items-center gap-1">
            <Droplets className={`w-3.5 h-3.5 ${isWaterLow ? 'text-red-400' : 'text-cyan-400'}`} />
            <span className="font-semibold text-stone-300">WATER</span>
          </span>
          <span className="font-mono text-[11px] font-bold text-stone-200">
            {resources.waterLiters.toFixed(1)} L
          </span>
        </div>
        <div className="text-[10px] text-stone-400 flex justify-between font-mono">
          <span>Net: {missionState.modules['water-recycler'].status === 'operational' ? '-0.08 L/h' : '-0.50 L/h'}</span>
          <span>Spares: {resources.sparePumps}</span>
        </div>
      </div>

      {/* 3. Breathable Oxygen */}
      <div className={`p-2 rounded border ${isOxygenLow ? 'bg-red-950/40 border-red-500/60' : 'bg-black/30 border-mars-border/80'}`}>
        <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
          <span className="flex items-center gap-1">
            <Wind className={`w-3.5 h-3.5 ${isOxygenLow ? 'text-red-400' : 'text-sky-300'}`} />
            <span className="font-semibold text-stone-300">OXYGEN</span>
          </span>
          <span className="font-mono text-[11px] font-bold text-stone-200">
            {resources.oxygenKg.toFixed(2)} kg
          </span>
        </div>
        <div className="text-[10px] text-stone-400 flex justify-between font-mono">
          <span>Demand: 0.14 kg/h</span>
          <span className="text-emerald-400 font-semibold">ECLSS ON</span>
        </div>
      </div>

      {/* 4. Crew Survival */}
      <div className="p-2 rounded border bg-black/30 border-mars-border/80">
        <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-orange-400" />
            <span className="font-semibold text-stone-300">CREW</span>
          </span>
          <span className="font-mono text-[11px] font-bold text-stone-200">
            {missionState.status === 'failed' ? '0 SAFE' : `${missionState.crewCount} SAFE`}
          </span>
        </div>
        <div className="text-[10px] text-stone-400 flex justify-between font-mono">
          <span>Rations: {resources.foodRations}</span>
          <span>Heating: 1.2 kW</span>
        </div>
      </div>

      {/* 5. Science & Mission Output */}
      <div className="p-2 rounded border bg-black/30 border-mars-border/80">
        <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
          <span className="flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold text-stone-300">SCIENCE</span>
          </span>
          <span className="font-mono text-[11px] font-bold text-purple-300">
            {missionState.scienceScore} PTS
          </span>
        </div>
        <div className="text-[10px] text-stone-400 flex justify-between font-mono">
          <span>Lab: {missionState.modules['research-lab'].enabled ? 'Active' : 'Paused'}</span>
          <span>Duration: 72h</span>
        </div>
      </div>
    </div>
  );
};
