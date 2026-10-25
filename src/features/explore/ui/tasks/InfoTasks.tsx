'use client';

import React, { useMemo, useState } from 'react';
import { useMissionStore } from '@/state/missionStore';
import { forecastPlan } from '@/simulation/engine';
import { currentPlan } from '@/simulation/training/power';
import { getGuidance } from '@/simulation/training/guidance';
import { RED_STORM_CONFIG } from '@/simulation/config';
import { STATUS_VISUALS } from '@/features/habitat-3d/constants/statusVisuals';
import type { ModuleId } from '@/simulation/types';

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded border border-mars-border bg-black/30 p-3">
    <h3 className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-stone-400">{title}</h3>
    {children}
  </section>
);

function Gauge({ label, value, unit, safe, note }: { label: string; value: number; unit: string; safe: number; note: string }) {
  const ok = value >= safe;
  return (
    <li className={`rounded border p-2.5 ${ok ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-red-500/50 bg-red-950/30'}`}>
      <div className="flex items-baseline justify-between">
        <span className="font-semibold text-stone-100">{label}</span>
        <span className="font-mono text-stone-100">{value.toFixed(1)} {unit}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-[11px]">
        <span className={ok ? 'text-emerald-300' : 'text-red-300'}>{ok ? '✓ above' : '▲ below'} safety reserve ({safe} {unit})</span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-stone-400">{note}</p>
    </li>
  );
}

/** Crew Habitat terminal: authoritative reserves against the mission's safety rules. */
export const CrewTask: React.FC = () => {
  const m = useMissionStore((s) => s.missionState);
  const r = m.resources;
  return (
    <div className="space-y-3 p-4 text-xs">
      <p className="leading-relaxed text-stone-300">
        Four crew live here. Their safety depends on air, water, food and warmth, and every one of them depends on power. Reserves are compared with the mission safety rules; this terminal does not calculate anything itself.
      </p>
      <ul className="space-y-2">
        <Gauge label="Oxygen" value={r.oxygenKg} unit="kg" safe={RED_STORM_CONFIG.oxygenSafetyThresholdKg} note="Crew breathe about 0.14 kg every hour. The air unit makes oxygen only while it has power." />
        <Gauge label="Drinking water" value={r.waterLiters} unit="L" safe={RED_STORM_CONFIG.waterSafetyThresholdLiters} note="The recycler returns most used water. When it stops, the tank drains at about 0.5 L every hour." />
        <Gauge label="Battery" value={r.batteryKwh} unit="kWh" safe={RED_STORM_CONFIG.batterySafetyThresholdKwh} note="Heating, air and water recycling all run from the battery during a dust storm." />
        <li className="rounded border border-mars-border bg-black/30 p-2.5">
          <div className="flex justify-between"><span className="font-semibold text-stone-100">Food rations</span><span className="font-mono text-stone-100">{Math.floor(r.foodRations)}</span></div>
          <p className="mt-1 text-[11px] text-stone-400">Stored food plus whatever the greenhouse grows under its lights.</p>
        </li>
      </ul>
      <div className="rounded border border-mars-border bg-black/30 p-2.5 text-stone-300">
        Crew status: <span className="font-semibold">{m.status === 'failed' ? 'Mission failed' : `${m.crewCount} crew, mission ${m.status}`}</span>
        <span className="ml-2 text-stone-500">Hour {m.hour} of {m.durationHours}</span>
      </div>
    </div>
  );
};

/** Greenhouse workstation: engine-run what-if on lighting, comparing food against power. */
export const GreenhouseTask: React.FC = () => {
  const { missionState: m, applyAction } = useMissionStore();
  const gh = m.modules.greenhouse;
  const on = useMemo(() => forecastPlan(m, { ...currentPlan(m), greenhouse: true }), [m]);
  const off = useMemo(() => forecastPlan(m, { ...currentPlan(m), greenhouse: false }), [m]);
  const end = (f: typeof on) => f.samples[f.samples.length - 1];
  const concluded = m.status === 'success' || m.status === 'failed';
  return (
    <div className="space-y-3 p-4 text-xs">
      <p className="leading-relaxed text-stone-300">
        Plants turn light, water and carbon dioxide into food. Under the grow lights the crops need {gh.powerDemandKw} kW, as much power as the whole water recycler plus heating. Compare what each choice does by the end of the mission (computed by the real simulation).
      </p>
      <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
        <div className="rounded border border-mars-border bg-black/30 p-2"><div className="text-stone-500">Grow lights</div><div className="text-sm text-stone-100">{gh.enabled ? `${STATUS_VISUALS[gh.status].glyph} on` : '■ off'}</div></div>
        <div className="rounded border border-mars-border bg-black/30 p-2"><div className="text-stone-500">Hours lit</div><div className="text-sm text-stone-100">{m.training?.cropGrowthHours ?? 0}</div></div>
        <div className="rounded border border-mars-border bg-black/30 p-2"><div className="text-stone-500">Food rations</div><div className="text-sm text-stone-100">{Math.floor(m.resources.foodRations)}</div></div>
      </div>
      <table className="w-full font-mono text-[11px]">
        <thead><tr className="text-left text-stone-500"><th className="font-normal">If the lights are...</th><th className="font-normal">Lowest battery</th><th className="font-normal">Food at end</th><th className="font-normal">Outcome</th></tr></thead>
        <tbody className="text-stone-200">
          <tr><td>on</td><td>{on.minBatteryKwh} kWh</td><td>{Math.floor(end(on).foodRations)}</td><td>{on.outcome === 'failed' ? `fails h${on.endHour}` : 'survives'}</td></tr>
          <tr><td>off</td><td>{off.minBatteryKwh} kWh</td><td>{Math.floor(end(off).foodRations)}</td><td>{off.outcome === 'failed' ? `fails h${off.endHour}` : 'survives'}</td></tr>
        </tbody>
      </table>
      <p className="leading-snug text-stone-400">Switching the lights off saves power now, but crops stop growing. Food then comes only from stored rations. Which matters more depends on how much battery you have left.</p>
      <button type="button" disabled={concluded} onClick={() => applyAction({ type: 'APPLY_POWER_PLAN', loads: { greenhouse: !gh.enabled } })} className="w-full rounded bg-orange-600 px-3 py-2 font-semibold text-white hover:bg-orange-500 disabled:bg-stone-800 disabled:text-stone-500">
        {gh.enabled ? 'Switch grow lights off' : 'Switch grow lights on'}
      </button>
    </div>
  );
};

const DOCS: { title: string; body: string }[] = [
  { title: 'Dust storms and solar power', body: 'Dust in the air blocks sunlight. During the Red Storm the panels give 4.0 kW instead of 10.0 kW. Dust storms do not cause radiation events.' },
  { title: 'Why batteries?', body: 'Panels cannot store energy. The battery holds the difference between what the panels make and what the colony uses. If demand is higher, the battery drains.' },
  { title: 'Water recycling', body: 'Used water is pumped through a filter and a treatment stage, then into a clean tank. A pump, a blocked filter or a faulty sensor can each reduce recovery. Measurements tell them apart.' },
  { title: 'Greenhouse trade-off', body: 'Grow lights make food but use power. In a crisis you decide between food later and power now.' },
];

/** Mission console: objectives, events, an engine forecast and short documentation. */
export const MissionTask: React.FC<{ onOpenDebrief: () => void }> = ({ onOpenDebrief }) => {
  const m = useMissionStore((s) => s.missionState);
  const guide = useMemo(() => getGuidance(m), [m]);
  const outlook = useMemo(() => forecastPlan(m, currentPlan(m)), [m]);
  const [open, setOpen] = useState<number | null>(null);
  const events = [...m.events].reverse().slice(0, 8);
  return (
    <div className="grid gap-3 p-4 text-xs md:grid-cols-2">
      <Card title="Current objective">
        <p className="leading-relaxed text-stone-100">{guide.objective}</p>
        {guide.hint && <p className="mt-2 text-amber-200"><span className="font-semibold">Hint: </span>{guide.hint}</p>}
        {guide.concept && <p className="mt-2 text-sky-200"><span className="font-semibold">Science: </span>{guide.concept}</p>}
      </Card>
      <Card title="Forecast (assuming no new faults)">
        <p className="text-stone-200">{outlook.outcome === 'failed' ? `Mission fails at hour ${outlook.endHour}.` : `Mission reaches hour ${outlook.endHour}.`} Lowest battery {outlook.minBatteryKwh} kWh.</p>
        <ul className="mt-2 space-y-1 text-stone-400">{outlook.risks.slice(0, 3).map((r, i) => <li key={i}>• {r.text}</li>)}</ul>
      </Card>
      <Card title="Recent events">
        <ul className="max-h-48 space-y-1.5 overflow-y-auto">
          {events.map((e) => (
            <li key={e.id} className="leading-snug text-stone-300"><span className="font-mono text-stone-500">H{e.hour}</span> {e.severity === 'critical' ? '✗' : e.severity === 'warning' ? '▲' : 'ℹ'} {e.message}</li>
          ))}
        </ul>
      </Card>
      <Card title="Documentation">
        <ul className="space-y-1">
          {DOCS.map((d, i) => (
            <li key={d.title}>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="w-full rounded border border-mars-border/60 bg-black/20 px-2 py-1 text-left text-stone-200 hover:bg-stone-900">{d.title}</button>
              {open === i && <p className="px-2 py-1.5 leading-snug text-stone-400">{d.body}</p>}
            </li>
          ))}
        </ul>
        <button type="button" onClick={onOpenDebrief} className="mt-3 w-full rounded border border-stone-600 px-2 py-1.5 text-stone-200 hover:bg-stone-800">Open mission debrief</button>
      </Card>
    </div>
  );
};

/** Generic equipment inspection from authoritative module state (air revitalization unit). */
export const ModuleInfoTask: React.FC<{ moduleId: ModuleId }> = ({ moduleId }) => {
  const m = useMissionStore((s) => s.missionState);
  const mod = m.modules[moduleId];
  const v = STATUS_VISUALS[mod.status];
  return (
    <div className="space-y-3 p-4 text-xs">
      <p className="leading-relaxed text-stone-300">{mod.description}</p>
      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
        <div className="rounded border border-mars-border bg-black/30 p-2"><div className="text-stone-500">Status</div><div className="text-sm" style={{ color: v.color }}>{v.glyph} {v.label}</div></div>
        <div className="rounded border border-mars-border bg-black/30 p-2"><div className="text-stone-500">Health</div><div className="text-sm text-stone-100">{Math.round(mod.health * 100)}%</div></div>
        <div className="rounded border border-mars-border bg-black/30 p-2"><div className="text-stone-500">Power use</div><div className="text-sm text-stone-100">{mod.powerDemandKw} kW</div></div>
        <div className="rounded border border-mars-border bg-black/30 p-2"><div className="text-stone-500">Oxygen reserve</div><div className="text-sm text-stone-100">{m.resources.oxygenKg.toFixed(2)} kg</div></div>
      </div>
      {moduleId === 'life-support' && (
        <p className="leading-snug text-stone-400">
          The crew use {RED_STORM_CONFIG.crewOxygenUseKgPerHour} kg of oxygen per hour. While this unit has power it makes {RED_STORM_CONFIG.normalOxygenGenKgPerHour} kg per hour, a small surplus. It is a critical system: if the battery runs out, the unit stops and the reserve is all that is left.
        </p>
      )}
    </div>
  );
};
