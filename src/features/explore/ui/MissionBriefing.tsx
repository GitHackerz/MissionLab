'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MISSIONS, getMission, RED_STORM_ID } from '@/simulation/missions/registry';
import type { MissionId, FaultId } from '@/simulation/missions/types';
import type { LearningMode } from '@/simulation/training/types';
import { loadSessionFromStorage, useMissionStore } from '@/state/missionStore';

interface Props {
  onStart: (mode: LearningMode, destination?: 'colony' | 'habitat', missionId?: MissionId, fault?: FaultId) => void;
  onContinue?: (missionId?: MissionId, fault?: FaultId) => void;
  canContinue?: boolean; savedHour?: number; savedBattery?: number; savedWater?: number;
}
export function MissionBriefing({ onStart, onContinue, canContinue = false, savedHour = 0 }: Props) {
  const [screen, setScreen] = useState<'menu' | 'missions' | 'briefing'>('menu');
  const [id, setId] = useState<MissionId>(RED_STORM_ID);
  const [variant, setVariant] = useState(0);
  const [mode, setMode] = useState<LearningMode>('cadet');
  const [destination, setDestination] = useState<'colony' | 'habitat'>('colony');
  const recovery = useMissionStore(s => s.saveRecoveryMessage);
  const mission = getMission(id);
  return <main className="min-h-screen overflow-y-auto bg-[#0e0b0c] px-5 py-8 text-stone-100 sm:px-12">
    <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-white/10 pb-5"><b className="tracking-widest text-orange-300">MISSIONLAB · FIELD TRAINING</b><span className="text-xs text-stone-400">Browser-local progress · deterministic missions</span></header>
    <div className="mx-auto max-w-6xl py-8">
      {screen !== 'menu' && <button className="game-button mb-6" onClick={()=>setScreen(screen === 'briefing' ? 'missions' : 'menu')}>← Back</button>}
      {screen === 'menu' ? <section className="max-w-2xl space-y-6">
        <Image src="/mascot/fankouch-wave.webp" alt="Fankouch welcomes you" width={110} height={120} className="h-28 w-auto" />
        <h1 className="text-5xl font-bold">Your crew.<br/><span className="text-orange-300">Your call.</span></h1>
        <p className="text-lg text-stone-300">Explore a Mars habitat. Compare evidence, make engineering decisions, and discover what your choices cause.</p>
        <p className="text-stone-400">Three playable missions. Four crew. Real resource consequences. Rewind an earlier decision and test another strategy.</p>
        <button className="game-button bg-orange-700 px-6 py-3" onClick={()=>setScreen('missions')}>Start Training</button>
        {canContinue && <button className="game-button ml-3" onClick={()=>onContinue?.()}>Continue current mission · H{savedHour.toFixed(2)}</button>}
        {recovery && <p role="status" className="text-sm text-amber-200">{recovery}</p>}
        <p className="text-sm text-stone-400">Walking uses no simulated time. Diagnostics, maintenance and Wait advance the mission. The guest-access timer is separate real-world time.</p>
      </section> : screen === 'missions' ? <>
        <h1 className="mb-6 text-4xl font-bold">Choose your mission.</h1>
        <div className="grid gap-5 lg:grid-cols-3">{MISSIONS.map(m=>{
          const saved = loadSessionFromStorage(m.id);
          return <article key={m.id} className={`overflow-hidden rounded-xl border ${id === m.id ? 'border-orange-300' : 'border-white/20'} bg-slate-900/60 p-5`}>
            <div aria-hidden="true" className={`mb-4 grid h-28 place-items-center rounded bg-gradient-to-br ${m.id === RED_STORM_ID ? 'from-orange-950 to-amber-700' : m.emergency?.defaultFault === 'seal-leak' ? 'from-blue-950 to-cyan-700' : 'from-slate-950 to-emerald-800'} text-5xl`}>{m.number}</div>
            <div className="text-xs uppercase tracking-widest text-orange-200">Playable · {m.difficulty}</div>
            <h2 className="mt-2 text-2xl font-bold">{m.title}</h2><p className="mt-2 text-sm text-sky-200">{m.hazard}</p>
            <ul className="my-4 list-disc space-y-1 pl-4 text-sm text-stone-300">{m.objectives.map(o=><li key={o}>{o}</li>)}</ul>
            <p className="text-xs text-stone-400">Cadet · Engineer · Commander</p>
            {saved && <button className="game-button mt-3 w-full" onClick={()=>onContinue?.(m.id)}>Resume {m.title} · {saved.missionState.status} · H{saved.missionState.hour.toFixed(2)}</button>}
            <button aria-pressed={id === m.id} className="game-button mt-3 w-full" onClick={()=>{setId(m.id);setVariant(0);setDestination(m.emergency?'habitat':'colony');}}>Select {m.title}</button>
          </article>;
        })}</div>
        <fieldset className="my-6"><legend className="mb-3 font-semibold">Guidance level · identical simulation physics</legend><div className="flex flex-wrap gap-4">{(['cadet','engineer','commander'] as const).map(m=><label key={m} className="rounded border border-white/20 p-3"><input type="radio" aria-label={m} name="entry-mode" value={m} checked={mode===m} onChange={()=>setMode(m)}/> <span className="capitalize">{m}</span><span className="ml-2 text-xs text-stone-400">{m==='cadet'?'Hints and science':m==='engineer'?'Objectives and instruments':'Operational warnings'}</span></label>)}</div></fieldset>
        <button className="game-button bg-orange-700 px-6 py-3" onClick={()=>setScreen('briefing')}>View briefing</button>
      </> : <section className="max-w-3xl space-y-6">
        <div className="text-xs tracking-widest text-orange-300">MISSION {mission.number} · TACTICAL BRIEFING</div>
        <h1 className="text-4xl font-bold">{mission.title}</h1><p className="text-lg leading-relaxed">{mission.briefing}</p>
        <div className="rounded border border-cyan-400/30 bg-cyan-950/30 p-4"><h2 className="font-semibold">Immediate objective</h2><p className="mt-2">{mission.objective}</p><p className="mt-2 text-cyan-200">Investigate: {mission.destination}</p></div>
        <div className="rounded border border-white/20 p-4"><h2 className="font-semibold">The science</h2><p className="mt-2 text-stone-300">{mission.concept}</p><p className="mt-2 text-xs text-stone-400">Fictional educational calibration. Survival and investigation quality are evaluated separately.</p></div>
        <fieldset><legend className="mb-3 font-semibold">Starting view</legend><div className="flex gap-3"><button aria-pressed={destination==='colony'} className="game-button" onClick={()=>setDestination('colony')}>Colony Mission Control</button><button aria-pressed={destination==='habitat'} className="game-button" onClick={()=>setDestination('habitat')}>Enter habitat</button></div></fieldset>
        {mission.emergency&&<fieldset><legend className="mb-2 text-sm font-semibold">Exercise variant · same physics, different hidden equipment fault</legend><div className="flex gap-3">{mission.faultVariants.map((fault,index)=><label key={fault} className="game-button"><input type="radio" name="exercise-variant" checked={variant===index} onChange={()=>setVariant(index)}/> Exercise {['A','B','C'][index]}</label>)}</div></fieldset>}
        <button className="game-button bg-orange-700 px-6 py-3" onClick={()=>variant?onStart(mode,destination,id,mission.faultVariants[variant]):onStart(mode,destination,id)}>Begin {mission.title}</button>
        <p className="text-xs text-amber-200">Begin launches a fresh attempt for this mission. Use Resume in the catalog to keep an existing attempt.</p>
        <p className="text-sm text-stone-400">WASD move · Shift run · E interact · Escape return/menu. Equipment activities are also available without WebGL.</p>
      </section>}
    </div>
  </main>;
}
