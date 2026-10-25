'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Gamepad2, LogOut, Play, FastForward, Zap, Droplets, Wind, ClipboardList } from 'lucide-react';
import { useMissionStore } from '@/state/missionStore';
import { useExploreStore } from '../store';
import { useGameInput } from '../input/useGameInput';
import { ExploreScene } from '../ExploreScene';
import { INTERACTABLES, ROOMS, TaskId } from '../world/layout';
import { TaskShell } from './TaskShell';
import { CrewTask, GreenhouseTask, MissionTask, ModuleInfoTask } from './tasks/InfoTasks';
import { PowerTask } from './tasks/PowerTask';
import { TrainingPanel } from '@/features/mission-ui/components/TrainingPanel';
import { MissionDebrief } from '@/features/mission-ui/components/MissionDebrief';
import { FeedbackToast } from '@/features/mission-ui/components/FeedbackToast';
import { getGuidance } from '@/simulation/training/guidance';

const TASK_META: Record<TaskId, { title: string; subtitle: string; layout: 'drawer' | 'panel' }> = {
  'water-recycler': { title: 'Water Recycler', subtitle: 'Life Support Room. Drag to rotate the machine; click its parts.', layout: 'drawer' },
  'power-console': { title: 'Power Distribution Board', subtitle: 'Power Room. Decide what runs, and see why.', layout: 'panel' },
  'mission-console': { title: 'Mission Console', subtitle: 'Mission Control. Objectives, events, forecasts and documentation.', layout: 'panel' },
  'greenhouse-station': { title: 'Greenhouse Workstation', subtitle: 'Greenhouse. Light, food and the power trade-off.', layout: 'drawer' },
  'crew-terminal': { title: 'Crew Habitat Terminal', subtitle: 'Central Hub. Are the crew safe?', layout: 'drawer' },
  'air-unit': { title: 'Air Revitalization Unit', subtitle: 'Life Support Room. Oxygen for the crew.', layout: 'drawer' },
};

const Chip: React.FC<{ icon: React.ReactNode; label: string; value: string; low?: boolean }> = ({ icon, label, value, low }) => (
  <span className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] ${low ? 'border-red-500/60 bg-red-950/50 text-red-200' : 'border-mars-border bg-black/55 text-stone-200'}`} title={label}>
    {icon}
    <span className="sr-only">{label}</span>
    {value}
    {low && <span aria-label="low">▲</span>}
  </span>
);

export const HabitatExplorer: React.FC = () => {
  const mission = useMissionStore((s) => s.missionState);
  const { applyAction, advanceTime, loadFixture, selectComponent, selectedComponentId, clearFeedback } = useMissionStore();
  const mode = useExploreStore((s) => s.mode);
  const nearbyId = useExploreStore((s) => s.nearbyId);
  const taskId = useExploreStore((s) => s.activeTaskId);
  const room = useExploreStore((s) => s.room);
  const showObjectives = useExploreStore((s) => s.showObjectives);
  const [debug, setDebug] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const onInteract = useCallback(() => {
    const st = useExploreStore.getState();
    if (st.mode !== 'exploration' || !st.nearbyId) return;
    const it = INTERACTABLES.find((i) => i.id === st.nearbyId);
    if (it?.enabled) {
      st.beginTask(it.id, it.taskId);
      useMissionStore.getState().selectModule(it.moduleId);
    }
  }, []);
  const onEscape = useCallback(() => {
    const st = useExploreStore.getState();
    if (st.mode === 'task' || (st.mode === 'transitioning' && st.transitionDirection === 'in')) st.endTask();
    else if (st.mode === 'debrief') st.closeDebrief();
    else if (st.showObjectives) st.toggleObjectives();
    else st.togglePause();
  }, []);
  const onObjectives = useCallback(() => useExploreStore.getState().toggleObjectives(), []);

  const keys = useGameInput(mode === 'exploration' && !showObjectives, mode === 'exploration' && !showObjectives && nearbyId !== null, { onInteract, onEscape, onObjectives });

  // Without WebGL there is no camera to finish transitions, so complete them immediately.
  useEffect(() => {
    if (unavailable && (mode === 'transitioning')) useExploreStore.getState().finishTransition();
  }, [unavailable, mode]);

  const nearby = INTERACTABLES.find((i) => i.id === nearbyId) ?? null;
  const guide = getGuidance(mission);
  const r = mission.resources;
  const destination = guide.stage === 'power-plan' ? 'Power Room · east →' : ['monitor', 'recovered', 'concluded'].includes(guide.stage) ? 'Mission Control · north ↑' : 'Life Support · west ←';
  const concluded = mission.status === 'success' || mission.status === 'failed';

  return (
    <div className="fixed inset-0 z-40 bg-[#0d0c0c] text-stone-100" role="application" aria-label="Habitat exploration">
      {!unavailable && (
        <div className="absolute inset-0">
          <ExploreScene
            mission={mission}
            keys={keys}
            selectedComponent={selectedComponentId}
            onSelectComponent={selectComponent}
            onTrainingAction={applyAction}
            onUnavailable={() => setUnavailable(true)}
            onReady={() => setSceneReady(true)}
          />
        </div>
      )}

      {!sceneReady && !unavailable && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0d0c0c] font-mono text-sm text-stone-400">
          <div className="flex flex-col items-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            <span>ENTERING HABITAT...</span>
          </div>
        </div>
      )}

      {unavailable && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-orange-400">3D habitat unavailable</p>
          <p className="max-w-md text-xs text-stone-400">WebGL is not available. You can still reach every activity from this list, or go back to the colony view.</p>
          <ul className="grid w-full max-w-md gap-2 sm:grid-cols-2">
            {INTERACTABLES.map((i) => (
              <li key={i.id}>
                <button type="button" className="w-full rounded border border-mars-border bg-black/40 px-3 py-2 text-left text-sm hover:border-mars-dust" onClick={() => { const st = useExploreStore.getState(); st.setNearby(i.id); if (st.beginTask(i.id, i.taskId)) st.finishTransition(); }}>
                  {i.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Exploration HUD */}
      {mode !== 'task' && mode !== 'debrief' && (
        <>
          <header className="pointer-events-none absolute left-4 right-4 top-4 flex flex-wrap items-start justify-between gap-3 sm:left-7 sm:right-7 sm:top-6">
            <div className="game-surface px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[.2em] text-orange-300">Mission 01 / Ares station</div>
              <h1 className="mt-1 text-lg font-semibold tracking-tight">The Red Storm <span className="ml-3 font-mono text-xs font-normal text-stone-400">{mission.hour.toFixed(1)} / {mission.durationHours} h</span></h1>
            </div>
            <div className="game-surface flex flex-wrap items-center gap-3 px-3 py-3">
              <Chip icon={<Zap className="h-4 w-4 text-amber-300" aria-hidden />} label="Battery" value={`${r.batteryKwh.toFixed(0)} kWh`} low={r.batteryKwh < 15} />
              <Chip icon={<Droplets className="h-4 w-4 text-cyan-300" aria-hidden />} label="Water" value={`${r.waterLiters.toFixed(1)} L`} low={r.waterLiters < 14} />
              <Chip icon={<Wind className="h-4 w-4 text-sky-300" aria-hidden />} label="Oxygen" value={`${r.oxygenKg.toFixed(1)} kg`} low={r.oxygenKg < 1.5} />
            </div>
          </header>
          <aside className="pointer-events-auto absolute left-4 top-40 w-[min(20rem,calc(100vw-2rem))] sm:left-7 sm:top-28">
            <div className="game-surface border-l-2 border-l-orange-300 px-4 py-3">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-orange-300"><span>{concluded ? 'Mission concluded' : 'Current objective'}</span><span>{guide.stage.replace(/-/g, ' ')}</span></div>
              <p className="mt-2 text-sm leading-relaxed text-stone-100">{guide.objective}</p>
              <div className="mt-3 border-t border-white/10 pt-2 text-xs text-sky-200">{destination}</div>
            </div>
            {mission.stormActive && <div className="mt-2 px-1 font-mono text-[10px] uppercase tracking-wider text-amber-200">▲ Dust storm / reduced solar generation</div>}
          </aside>
          <footer className="pointer-events-auto absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-2 sm:inset-x-7 sm:bottom-6">
            <div className="game-surface px-3 py-2 text-xs text-stone-300">
              <div className="mb-1 flex items-center gap-2 text-sky-200"><Gamepad2 size={14} aria-hidden />{room ? ROOMS[room].label : 'Connecting corridor'}</div>
              <span className="hidden sm:inline"><kbd className="kbd">WASD</kbd> move · <kbd className="kbd">Shift</kbd> run · </span><kbd className="kbd">E</kbd> interact
            </div>
            <nav aria-label="Mission controls" className="flex flex-wrap gap-1.5">
              <button type="button" disabled={concluded || mode !== 'exploration'} onClick={() => advanceTime(1)} className="game-button flex items-center gap-1"><Play size={12} aria-hidden />+1h</button>
              <button type="button" disabled={concluded || mode !== 'exploration'} onClick={() => advanceTime(6)} className="game-button flex items-center gap-1"><FastForward size={12} aria-hidden />+6h</button>
              <button type="button" onClick={onObjectives} className="game-button">Objectives</button>
              <button type="button" disabled={mode !== 'exploration'} onClick={() => useExploreStore.getState().openDebrief()} className="game-button flex items-center gap-1"><ClipboardList size={13} aria-hidden />Autopsy</button>
              <button type="button" onClick={() => useExploreStore.getState().togglePause()} className="game-button">Menu <span className="hidden sm:inline">/ Esc</span></button>
            </nav>
          </footer>
          {mode === 'paused' && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-[#07121b]/70 p-5 backdrop-blur-sm">
              <section role="dialog" aria-modal="true" aria-label="Mission menu" className="game-surface w-full max-w-sm space-y-3 p-6">
                <p className="font-mono text-xs uppercase tracking-widest text-orange-300">Ares station / mission menu</p>
                <h2 className="text-2xl font-semibold">Take a breath.</h2>
                <p className="text-sm leading-relaxed text-stone-300">Time advances only when you choose +1h, +6h or perform equipment tasks. Walking and exploring use no mission time.</p>
                <button className="game-button block w-full" onClick={() => useExploreStore.getState().togglePause()}>Resume exploration</button>
                <button className="game-button flex w-full items-center justify-center gap-2" onClick={() => useExploreStore.getState().exitHabitat()}><LogOut size={14} />Colony Overview</button>
                <details onToggle={(e) => setDebug(e.currentTarget.open)} className="border-t border-white/10 pt-3">
                  <summary className="cursor-pointer text-xs text-stone-400">Development & demonstration</summary>
                  {debug && <div className="mt-3 space-y-2"><p className="text-xs text-amber-200">This replaces the current mission with the engine&apos;s fault demonstration.</p><button onClick={() => { loadFixture('demo-fault'); useExploreStore.getState().togglePause(); }} className="game-button w-full">Demo: go to fault</button></div>}
                </details>
              </section>
            </div>
          )}
          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-64 sm:bottom-24 flex justify-center">
            {nearby && mode === 'exploration' && (
              <button type="button" onClick={onInteract} className="pointer-events-auto flex items-center gap-3 rounded-lg border border-sky-400/60 bg-black/80 px-4 py-2.5 text-sm shadow-xl backdrop-blur hover:bg-black/90">
                <kbd className="rounded border border-sky-300/60 bg-sky-950 px-2 py-0.5 font-mono text-sm text-sky-100">E</kbd>
                <span><span className="font-semibold">{nearby.label}</span><span className="text-stone-300"> — Press E to {nearby.verb}</span></span>
              </button>
            )}
          </div>

          {showObjectives && (
            <div className="absolute left-1/2 top-24 w-[min(34rem,92vw)] -translate-x-1/2 rounded-lg border border-mars-border bg-black/85 p-4 text-xs shadow-2xl backdrop-blur" role="dialog" aria-label="Mission objectives">
              <div className="mb-2 flex items-center justify-between font-mono text-xs uppercase tracking-wider text-orange-400">Objectives<button type="button" onClick={onObjectives} className="game-button">Close</button></div>
              <p className="leading-relaxed text-stone-100">{guide.objective}</p>
              {guide.hint && <p className="mt-2 text-amber-200"><span className="font-semibold">Hint: </span>{guide.hint}</p>}
              {guide.concept && <p className="mt-2 text-sky-200"><span className="font-semibold">Science: </span>{guide.concept}</p>}
              <p className="mt-2 text-stone-400">Keep four crew safe for 72 hours. Explore the rooms: Mission Control (north), Power Room (east), Life Support (west), Greenhouse (south).</p>
            </div>
          )}
        </>
      )}

      {/* Focused task surface */}
      {mode === 'task' && taskId && (
        <TaskShell title={TASK_META[taskId].title} subtitle={TASK_META[taskId].subtitle} layout={TASK_META[taskId].layout} onClose={() => useExploreStore.getState().endTask()}>
          {taskId === 'water-recycler' && <TrainingPanel embedded />}
          {taskId === 'power-console' && <PowerTask />}
          {taskId === 'mission-console' && <MissionTask onOpenDebrief={() => { useExploreStore.getState().openDebrief(); }} />}
          {taskId === 'greenhouse-station' && <GreenhouseTask />}
          {taskId === 'crew-terminal' && <CrewTask />}
          {taskId === 'air-unit' && <ModuleInfoTask moduleId="life-support" />}
        </TaskShell>
      )}

      {mode === 'debrief' && (
        <div role="dialog" aria-modal="true" aria-label="Mission debrief" className="absolute inset-x-3 inset-y-3 z-30 overflow-y-auto rounded-lg border border-mars-border bg-[#150a08]/95 shadow-2xl backdrop-blur-md sm:inset-x-[12%]">
          <div className="sticky top-0 z-10 flex justify-end border-b border-mars-border bg-black/60 px-3 py-2">
            <button type="button" onClick={() => useExploreStore.getState().closeDebrief()} className="rounded border border-stone-600 bg-stone-900 px-2.5 py-1 text-xs hover:bg-stone-800">Back <kbd className="ml-1 rounded bg-black/60 px-1 font-mono text-[10px]">Esc</kbd></button>
          </div>
          <MissionDebrief />
        </div>
      )}

      {mode === 'exploration' && !showObjectives && <div className="touch-movement absolute bottom-40 left-4 z-10 grid grid-cols-3 gap-1" aria-label="Touch movement controls">
        {([['up', '↑', 'Move north'], ['left', '←', 'Move west'], ['down', '↓', 'Move south'], ['right', '→', 'Move east']] as const).map(([direction, arrow, label], i) => <button key={direction} type="button" aria-label={label} className={`game-button h-11 w-11 select-none ${i === 0 ? 'col-start-2' : i === 1 ? 'col-start-1 row-start-2' : 'row-start-2'}`} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); keys.current[direction] = true; }} onPointerUp={() => { keys.current[direction] = false; }} onPointerCancel={() => { keys.current[direction] = false; }} onLostPointerCapture={() => { keys.current[direction] = false; }}>{arrow}</button>)}
      </div>}
      <FeedbackToast className="bottom-28" />
      <button type="button" className="sr-only" onClick={clearFeedback}>Dismiss feedback</button>
    </div>
  );
};

export default HabitatExplorer;
