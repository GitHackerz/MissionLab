'use client';
import { useMissionStore } from '@/state/missionStore';
import { getEmergencyMetrics } from '@/simulation/missions/presentation';
export function EmergencyTelemetry({ compact = false }: { compact?: boolean }) {
  const state = useMissionStore(s=>s.missionState);
  if (!state.emergency) return null;
  return <section aria-label="Live atmospheric telemetry" className={`grid ${compact?'grid-cols-2 sm:grid-cols-3':'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'} gap-2 border-b border-white/15 bg-[#101d27]/95 p-3 text-xs`}>
    {getEmergencyMetrics(state).map(m=><div key={m.label} className={`rounded border p-2 ${m.unsafe?'border-red-300 bg-red-950/60':'border-sky-300/20'}`}>
      <div className="text-stone-300">{m.label}</div><div className="mt-1 font-mono text-sm text-white">{m.value === null?'—':m.value.toFixed(m.unit==='ppm'?0:2)} {m.unit}</div><div className="mt-1 text-[10px] text-stone-400">{m.limit}</div>
    </div>)}
  </section>;
}
