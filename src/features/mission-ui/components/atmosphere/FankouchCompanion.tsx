'use client';
import Image from 'next/image';
import { useState } from 'react';
import { useMissionStore } from '@/state/missionStore';
import { getFankouchLine } from '@/simulation/missions/presentation';
export function FankouchCompanion() {
  const state=useMissionStore(s=>s.missionState), line=getFankouchLine(state);
  const [dismissed,setDismissed]=useState<string[]>([]);
  const [seen,setSeen]=useState<string[]>([]);
  if (dismissed.includes(line.id)) return <button className="game-button text-xs" onClick={()=>setDismissed(dismissed.filter(id=>id!==line.id))}>Fankouch · guidance</button>;
  const mode=state.emergency?.mode ?? state.training?.mode;
  if (mode==='commander' && !line.serious && state.status==='running') return null;
  return <aside aria-label="Fankouch mission companion" className="flex items-start gap-2 rounded border border-orange-300/30 bg-black/70 p-3 text-xs">
    <Image src={`/mascot/fankouch-${line.serious?'surprised':'thinking'}.webp`} alt="Fankouch" width={48} height={58} className="h-14 w-auto" />
    <div className="flex-1"><b className="text-orange-200">Fankouch · فنكوش</b><p className="mt-1 leading-relaxed text-stone-200" role={line.serious?'alert':undefined}>{line.text}</p>{seen.includes(line.id)&&<span className="text-[10px] text-stone-400">Previously reviewed guidance</span>}</div>
    <button aria-label="Dismiss Fankouch guidance" onClick={()=>{setDismissed([...dismissed,line.id]);setSeen([...new Set([...seen,line.id])]);}} className="rounded px-2 text-stone-300">×</button>
  </aside>;
}
