'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Gamepad2, LogOut, Play, FastForward, Zap, Droplets, Wind, Wheat, ClipboardList } from 'lucide-react';
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
  }, []);
  const onObjectives = useCallback(() => useExploreStore.getState().toggleObjectives(), []);

  const keys = useGameInput(mode === 'exploration', mode === 'exploration' && nearbyId !== null, { onInteract, onEscape, onObjectives });

  // Without WebGL there is no camera to finish transitions, so complete them immediately.
  useEffect(() => {
    if (unavailable && (mode === 'transitioning')) useExploreStore.getState().finishTransition();
  }, [unavailable, mode]);

  const nearby = INTERACTABLES.find((i) => i.id === nearbyId) ?? null;
  const guide = getGuidance(mission);
  const r = mission.resources;
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
          <div className="pointer-events-none absolute left-3 right-3 top-3 flex flex-wrap items-start justify-between gap-2">
            <div className="pointer-events-auto flex max-w-md flex-col gap-1.5">
              <div className="rounded border border-mars-border bg-black/60 px-3 py-1.5 backdrop-blur">
                <div className="font-mono text-[10px] uppercase tracking-wider text-orange-400">{room ? ROOMS[room].label : 'Habitat'}</div>
                <div className="text-xs leading-snug text-stone-200">{guide.objective}</div>
              </div>
            </div>
            <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
              <Chip icon={<Zap className="h-3 w-3 text-amber-400" aria-hidden />} label="Battery" value={`${r.batteryKwh.toFixed(0)} kWh`} low={r.batteryKwh < 15} />
              <Chip icon={<Droplets className="h-3 w-3 text-cyan-400" aria-hidden />} label="Water" value={`${r.waterLiters.toFixed(1)} L`} low={r.waterLiters < 14} />
              <Chip icon={<Wind className="h-3 w-3 text-sky-300" aria-hidden />} label="Oxygen" value={`${r.oxygenKg.toFixed(1)} kg`} low={r.oxygenKg < 1.5} />
              <Chip icon={<Wheat className="h-3 w-3 text-lime-300" aria-hidden />} label="Food rations" value={`${Math.floor(r.foodRations)}`} />
              <span className="rounded border border-mars-border bg-black/60 px-2 py-1 font-mono text-[11px] text-amber-300">HOUR {mission.hour}/{mission.durationHours}</span>
              <button type="button" disabled={concluded} onClick={() => advanceTime(1)} className="flex items-center gap-1 rounded border border-stone-600 bg-black/60 px-2 py-1 text-[11px] hover:bg-stone-800 disabled:opacity-40"><Play className="h-3 w-3 text-emerald-400" aria-hidden />+1h</button>
              <button type="button" disabled={concluded} onClick={() => advanceTime(6)} className="flex items-center gap-1 rounded border border-stone-600 bg-black/60 px-2 py-1 text-[11px] hover:bg-stone-800 disabled:opacity-40"><FastForward className="h-3 w-3 text-amber-400" aria-hidden />+6h</button>
              <button type="button" onClick={() => loadFixture('demo-fault')} title="Real engine: applies a load-shedding plan and runs to the equipment fault" className="rounded border border-orange-600/60 bg-black/60 px-2 py-1 text-[11px] text-orange-300 hover:bg-orange-950">Demo: go to fault</button>
              <button type="button" disabled={mode !== 'exploration'} onClick={() => useExploreStore.getState().openDebrief()} className="flex items-center gap-1 rounded border border-stone-600 bg-black/60 px-2 py-1 text-[11px] hover:bg-stone-800 disabled:opacity-40"><ClipboardList className="h-3 w-3" aria-hidden />Debrief</button>
              <button type="button" onClick={() => useExploreStore.getState().exitHabitat()} className="flex items-center gap-1 rounded border border-stone-600 bg-black/60 px-2 py-1 text-[11px] hover:bg-stone-800"><LogOut className="h-3 w-3" aria-hidden />Colony view</button>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-mars-border bg-black/60 px-3 py-2 text-[11px] text-stone-300 backdrop-blur">
            <div className="mb-1 flex items-center gap-1.5 font-mono uppercase tracking-wider text-stone-400"><Gamepad2 className="h-3 w-3" aria-hidden />Controls</div>
            <div><kbd className="kbd">W A S D</kbd> / arrows move · <kbd className="kbd">Shift</kbd> run</div>
            <div><kbd className="kbd">E</kbd> interact · <kbd className="kbd">Tab</kbd> objectives · <kbd className="kbd">Esc</kbd> leave a task</div>
          </div>

          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            {nearby && mode === 'exploration' && (
              <button type="button" onClick={onInteract} className="pointer-events-auto flex items-center gap-3 rounded-lg border border-sky-400/60 bg-black/80 px-4 py-2.5 text-sm shadow-xl backdrop-blur hover:bg-black/90">
                <kbd className="rounded border border-sky-300/60 bg-sky-950 px-2 py-0.5 font-mono text-sm text-sky-100">E</kbd>
                <span><span className="font-semibold">{nearby.label}</span><span className="text-stone-300"> — Press E to {nearby.verb}</span></span>
              </button>
            )}
          </div>

          {showObjectives && (
            <div className="absolute left-1/2 top-24 w-[min(34rem,92vw)] -translate-x-1/2 rounded-lg border border-mars-border bg-black/85 p-4 text-xs shadow-2xl backdrop-blur" role="dialog" aria-label="Mission objectives">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-orange-400">Objectives (Tab to close)</div>
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
          {taskId === 'mission-console' && <MissionTask onOpenDebrief={() => { useExploreStore.getState().endTask(); window.setTimeout(() => useExploreStore.getState().openDebrief(), 900); }} />}
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

      <FeedbackToast className="bottom-28" />
      <button type="button" className="sr-only" onClick={clearFeedback}>Dismiss feedback</button>
    </div>
  );
};

export default HabitatExplorer;
