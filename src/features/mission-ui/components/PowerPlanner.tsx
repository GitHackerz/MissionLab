'use client';

import React, { useMemo, useState } from 'react';
import { Zap, Sun, BatteryCharging, AlertTriangle, Info, OctagonAlert } from 'lucide-react';
import { useMissionStore } from '@/state/missionStore';
import { forecastPlan } from '@/simulation/engine';
import { PLAN_LOADS, currentPlan } from '@/simulation/training/power';
import type { PlanLoadId } from '@/simulation/training/types';
import { RED_STORM_CONFIG } from '@/simulation/config';

const CATEGORY: Record<string, string> = {
  critical: 'text-red-300 border-red-500/40 bg-red-950/40',
  essential: 'text-amber-300 border-amber-500/40 bg-amber-950/40',
  optional: 'text-sky-300 border-sky-500/40 bg-sky-950/40',
};

/** Single-line wiring diagram: sun -> panels -> bus -> battery, with one breaker per load. Line width follows kW. */
const PowerSchematic: React.FC<{ generationKw: number; demandKw: number; batteryFrac: number; storm: boolean; loads: { id: string; label: string; kw: number; on: boolean; category: string }[] }> = ({ generationKw, demandKw, batteryFrac, storm, loads }) => {
  const rowY = (i: number) => 28 + i * 44;
  const tone: Record<string, string> = { critical: '#f87171', essential: '#fbbf24', optional: '#38bdf8' };
  return (
    <svg viewBox="0 0 540 200" className="w-full rounded border border-mars-border bg-black/40" role="img" aria-label={`Power schematic: ${generationKw} kilowatts generated, ${demandKw} kilowatts demanded, battery ${Math.round(batteryFrac * 100)} percent`}>
      {/* solar array */}
      <rect x="10" y="30" width="86" height="54" rx="4" fill="#1e3a8a" stroke="#60a5fa" />
      <path d="M10 48h86M10 66h86M39 30v54M68 30v54" stroke="#60a5fa" strokeWidth="1" opacity=".6" />
      <text x="53" y="102" textAnchor="middle" fontSize="11" fill="#cbd5e1">Solar array</text>
      <text x="53" y="116" textAnchor="middle" fontSize="12" fill="#fcd34d" fontFamily="monospace">{generationKw.toFixed(1)} kW</text>
      <text x="53" y="130" textAnchor="middle" fontSize="9" fill="#94a3b8">{storm ? '☁ dust storm' : '☀ clear sky'}</text>
      {/* generation -> bus */}
      <line x1="96" y1="57" x2="250" y2="57" stroke="#fcd34d" strokeWidth={Math.max(2, generationKw * 1.2)} strokeLinecap="round" />
      {/* bus */}
      <rect x="250" y="20" width="10" height="164" rx="3" fill="#475569" />
      <text x="255" y="196" textAnchor="middle" fontSize="9" fill="#94a3b8">power bus</text>
      {/* battery */}
      <line x1="255" y1="150" x2="150" y2="150" stroke="#10b981" strokeWidth="3" strokeDasharray="5 3" />
      <rect x="100" y="132" width="50" height="38" rx="4" fill="#0f172a" stroke="#10b981" />
      <rect x="104" y={166 - 30 * batteryFrac} width="42" height={30 * batteryFrac} fill="#10b981" opacity=".8" />
      <text x="125" y="184" textAnchor="middle" fontSize="10" fill="#cbd5e1">Battery {Math.round(batteryFrac * 100)}%</text>
      {/* loads */}
      {loads.map((l, i) => (
        <g key={l.id}>
          <line x1="260" y1={rowY(i) + 10} x2="372" y2={rowY(i) + 10} stroke={l.on ? '#fcd34d' : '#475569'} strokeWidth={l.on ? Math.max(2, l.kw * 1.6) : 2} strokeDasharray={l.on ? undefined : '4 4'} strokeLinecap="round" />
          <g transform={`translate(372 ${rowY(i) - 2})`}>
            <rect width="24" height="24" rx="3" fill="#0f172a" stroke={l.on ? '#10b981' : '#ef4444'} />
            <path d={l.on ? 'M5 12l5 5 9-10' : 'M6 6l12 12M18 6L6 18'} stroke={l.on ? '#10b981' : '#ef4444'} strokeWidth="2.5" fill="none" />
          </g>
          <rect x="404" y={rowY(i) - 6} width="126" height="32" rx="4" fill="#0f172a" stroke={tone[l.category]} opacity={l.on ? 1 : 0.55} />
          <text x="411" y={rowY(i) + 8} fontSize="10" fill="#e2e8f0">{l.label.split(' (')[0]}</text>
          <text x="411" y={rowY(i) + 21} fontSize="9" fill={tone[l.category]} fontFamily="monospace">{l.category} · {l.on ? `${l.kw.toFixed(1)} kW` : 'off'}</text>
        </g>
      ))}
      <text x="470" y="196" textAnchor="middle" fontSize="9" fill="#94a3b8">demand {demandKw.toFixed(1)} kW</text>
    </svg>
  );
};

export const PowerPlanner: React.FC<{ schematic?: boolean }> = ({ schematic = false }) => {
  const { missionState, applyAction } = useMissionStore();
  const live = useMemo(() => currentPlan(missionState), [missionState]);
  const [draft, setDraft] = useState<Record<PlanLoadId, boolean> | null>(null);
  const plan = draft ?? live;
  const dirty = PLAN_LOADS.some((l) => plan[l.id] !== live[l.id]);
  const concluded = missionState.status === 'success' || missionState.status === 'failed';

  const forecast = useMemo(() => forecastPlan(missionState, plan), [missionState, plan]);
  const generation = forecast.generationKw;

  const W = 280;
  const H = 90;
  const cap = missionState.resources.batteryCapacityKwh;
  const span = Math.max(1, forecast.samples.length - 1);
  const pts = forecast.samples.map((s, i) => `${(i / span) * W},${H - (s.batteryKwh / cap) * H}`).join(' ');
  const reserveY = H - (RED_STORM_CONFIG.batterySafetyThresholdKwh / cap) * H;

  return (
    <div className="p-4 space-y-4 text-xs">
      <div>
        <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" /> Power Plan
        </h2>
        <p className="mt-1 text-stone-300 leading-relaxed">
          Solar panels make power only while the sun reaches them. The battery stores the difference. Choose which loads to keep running, check the forecast, then apply.
        </p>
      </div>

      {schematic && (
        <PowerSchematic
          generationKw={generation}
          demandKw={forecast.demandKw}
          batteryFrac={missionState.resources.batteryKwh / missionState.resources.batteryCapacityKwh}
          storm={missionState.stormActive}
          loads={PLAN_LOADS.map((l) => ({ id: l.id, label: l.label, kw: missionState.modules[l.id].powerDemandKw, on: plan[l.id], category: l.category }))}
        />
      )}

      <div className="grid grid-cols-3 gap-2 font-mono">
        <div className="rounded border border-mars-border bg-black/30 p-2">
          <div className="flex items-center gap-1 text-stone-400"><Sun className="w-3.5 h-3.5 text-amber-400" /> Solar</div>
          <div className="text-sm text-stone-100">{generation.toFixed(1)} kW</div>
          <div className="text-[10px] text-stone-500">{missionState.stormActive ? 'dust storm' : 'clear sky'}</div>
        </div>
        <div className="rounded border border-mars-border bg-black/30 p-2">
          <div className="text-stone-400">Demand</div>
          <div className="text-sm text-stone-100">{forecast.demandKw.toFixed(1)} kW</div>
        </div>
        <div className={`rounded border p-2 ${forecast.netKw < 0 ? 'border-red-500/50 bg-red-950/30' : 'border-emerald-500/40 bg-emerald-950/30'}`}>
          <div className="flex items-center gap-1 text-stone-400"><BatteryCharging className="w-3.5 h-3.5" /> Net</div>
          <div className="text-sm text-stone-100">{forecast.netKw > 0 ? '+' : ''}{forecast.netKw.toFixed(1)} kW</div>
          <div className="text-[10px] text-stone-500">{forecast.netKw < 0 ? 'battery drains' : 'battery charges'}</div>
        </div>
      </div>

      <ul className="space-y-2" aria-label="Power loads">
        {PLAN_LOADS.map((load) => {
          const mod = missionState.modules[load.id];
          const on = plan[load.id];
          return (
            <li key={load.id} className="rounded border border-mars-border bg-black/30 p-2.5">
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-orange-500"
                    checked={on}
                    disabled={concluded}
                    onChange={(e) => setDraft({ ...plan, [load.id]: e.target.checked })}
                  />
                  <span className="font-semibold text-stone-200">{load.label}</span>
                </span>
                <span className="flex items-center gap-2 font-mono">
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] uppercase ${CATEGORY[load.category]}`}>{load.category}</span>
                  <span className="text-stone-200">{mod.powerDemandKw.toFixed(1)} kW</span>
                </span>
              </label>
              <p className="mt-1.5 text-[11px] text-stone-400 leading-snug">{load.why}</p>
            </li>
          );
        })}
      </ul>

      <div>
        <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-stone-400">
          <span>Forecast (assuming no new equipment faults)</span>
          <span>{forecast.outcome === 'failed' ? `fails at hour ${forecast.endHour}` : `reaches hour ${forecast.endHour}`}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border border-mars-border bg-black/40" role="img" aria-label={`Battery forecast, minimum ${forecast.minBatteryKwh} kilowatt hours`}>
          <line x1="0" x2={W} y1={reserveY} y2={reserveY} stroke="#ef4444" strokeDasharray="4 3" strokeWidth="1" />
          <polyline points={pts} fill="none" stroke={forecast.outcome === 'failed' ? '#ef4444' : '#10b981'} strokeWidth="2" />
        </svg>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-stone-500">
          <span>hour {forecast.samples[0]?.hour}</span>
          <span className="text-red-400">dashed: {RED_STORM_CONFIG.batterySafetyThresholdKwh} kWh reserve</span>
          <span>lowest {forecast.minBatteryKwh} kWh</span>
        </div>
      </div>

      <ul className="space-y-1.5" aria-label="Consequences of this plan">
        {forecast.risks.map((r, i) => (
          <li
            key={i}
            className={`flex gap-2 rounded border p-2 leading-snug ${
              r.severity === 'critical' ? 'border-red-500/50 bg-red-950/30 text-red-200' : r.severity === 'warning' ? 'border-amber-500/40 bg-amber-950/30 text-amber-200' : 'border-mars-border bg-black/30 text-stone-300'
            }`}
          >
            {r.severity === 'critical' ? <OctagonAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : r.severity === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
            <span>
              <span className="sr-only">{r.severity}: </span>
              {r.text}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!dirty || concluded}
          onClick={() => {
            applyAction({ type: 'APPLY_POWER_PLAN', loads: plan });
            setDraft(null);
          }}
          className="flex-1 rounded bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500"
        >
          {dirty ? 'Apply this plan' : 'Plan matches current settings'}
        </button>
        {dirty && (
          <button type="button" onClick={() => setDraft(null)} className="rounded border border-stone-700 px-3 py-2 text-xs text-stone-300 hover:bg-stone-800">
            Reset
          </button>
        )}
      </div>
    </div>
  );
};
