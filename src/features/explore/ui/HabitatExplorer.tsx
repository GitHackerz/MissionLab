'use client';

import { AtmosphereWorkbench } from '@/features/mission-ui/components/atmosphere/AtmosphereWorkbench';
import { EmergencyTelemetry } from '@/features/mission-ui/components/atmosphere/EmergencyTelemetry';
import { FankouchCompanion } from '@/features/mission-ui/components/atmosphere/FankouchCompanion';
import { getMissionConfig } from '@/simulation/config';
import { getMission } from '@/simulation/missions/registry';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Gamepad2, LogOut, Zap, Droplets, Wind, ClipboardList, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { useMissionStore } from '@/state/missionStore';
import { useExploreStore } from '../store';
import { useGameInput } from '../input/useGameInput';
import { ExploreScene } from '../ExploreScene';
import { INTERACTABLES, missionInteractables, ROOMS, TaskId } from '../world/layout';
import { useDialogFocus } from './useDialogFocus';
import { TaskShell } from './TaskShell';
import { CrewTask, GreenhouseTask, MissionTask, ModuleInfoTask } from './tasks/InfoTasks';
import { PowerTask } from './tasks/PowerTask';
import { TrainingPanel } from '@/features/mission-ui/components/TrainingPanel';
import { MissionDebrief } from '@/features/mission-ui/components/MissionDebrief';
import { FeedbackToast } from '@/features/mission-ui/components/FeedbackToast';
import { getPlayerObjective, getObjectives } from '../objectives';
import { getRoomPower, roomEquipmentActive } from '../world/power';
import { getGuidance } from '@/simulation/training/guidance';
import { soundManager } from '@/features/audio/soundManager';
import { NovaDock } from '@/features/nova/components/NovaDock';

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

export const HabitatExplorer: React.FC<{ onTrainingMenu?: () => void }> = ({ onTrainingMenu }) => {
  const worldRef = useRef<HTMLDivElement>(null);
  const pauseRef = useRef<HTMLElement>(null);
  const debriefRef = useRef<HTMLDivElement>(null);
  const mission = useMissionStore((s) => s.missionState);
  const { applyAction, advanceTime, loadFixture, selectComponent, selectedComponentId, clearFeedback, resetMission } = useMissionStore();
  const mode = useExploreStore((s) => s.mode);
  const nearbyId = useExploreStore((s) => s.nearbyId);
  const taskId = useExploreStore((s) => s.activeTaskId);
  const room = useExploreStore((s) => s.room);
  const showObjectives = useExploreStore((s) => s.showObjectives);
  const [debug, setDebug] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => soundManager.isMuted());
  const [confirmRestart, setConfirmRestart] = useState(false);

  useEffect(() => {
    if (mode === 'exploration' && !showObjectives) worldRef.current?.focus({ preventScroll: true });
  }, [mode, showObjectives]);

  const equipmentAudible = roomEquipmentActive(mission, room);
  useEffect(() => {
    if (sceneReady && !['paused', 'debrief'].includes(mode) && equipmentAudible) {
      soundManager.startAmbientHum();
    }
    return () => {
      soundManager.stopAmbientHum();
    };
  }, [sceneReady, mode, equipmentAudible]);

  useDialogFocus(mode === 'paused', pauseRef);
  useDialogFocus(mode === 'debrief', debriefRef);

  const onInteract = useCallback(() => {
    const st = useExploreStore.getState();
    if (st.mode !== 'exploration' || !st.nearbyId) return;
    const it = INTERACTABLES.find((i) => i.id === st.nearbyId);
    if (it?.enabled) {
      soundManager.playClick();
      st.beginTask(it.id, it.taskId);
      useMissionStore.getState().selectModule(it.moduleId);
    }
  }, []);

  const onEscape = useCallback(() => {
    soundManager.playClick();
    const st = useExploreStore.getState();
    if (st.mode === 'task' || (st.mode === 'transitioning' && st.transitionDirection === 'in')) st.endTask();
    else if (st.mode === 'debrief') st.closeDebrief();
    else if (st.showObjectives) st.toggleObjectives();
    else st.togglePause();
  }, []);

  const onObjectives = useCallback(() => {
    soundManager.playClick();
    useExploreStore.getState().toggleObjectives();
  }, []);

  const handleToggleSound = () => {
    const nextMuted = soundManager.toggleMute();
    setMuted(nextMuted);
    if (!nextMuted) soundManager.playClick();
  };

  const keys = useGameInput(mode === 'exploration' && !showObjectives, mode === 'exploration' && !showObjectives && nearbyId !== null, { onInteract, onEscape, onObjectives, objectivesEnabled: mode === 'exploration' });

  // Without WebGL there is no camera to finish transitions, so complete them immediately.
  useEffect(() => {
    if (unavailable && (mode === 'transitioning')) useExploreStore.getState().finishTransition();
  }, [unavailable, mode]);

  const interactables = missionInteractables(mission.scenarioId);
  const nearby = interactables.find((i) => i.id === nearbyId) ?? null;
  const guide = getGuidance(mission);
  const r = mission.resources;
  const config = getMissionConfig(mission);
  const objective = getPlayerObjective(mission, room);
  const objectives = getObjectives(mission);
  const roomPower = room ? getRoomPower(mission, room) : null;
  const concluded = mission.status === 'success' || mission.status === 'failed';

  return (
    <div ref={worldRef} tabIndex={-1} className="fixed inset-0 z-40 bg-[#0d0c0c] text-stone-100" role="application" aria-label="Habitat exploration">
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
            {interactables.map((i) => (
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
          <header className="pointer-events-none absolute left-4 right-4 top-12 flex flex-wrap items-start justify-between gap-3 sm:left-7 sm:right-7 lg:top-6">
            <div className="game-surface px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[.2em] text-orange-300">Mission {getMission(mission.scenarioId).number} / Ares station</div>
              <h1 className="mt-1 text-lg font-semibold tracking-tight">{getMission(mission.scenarioId).title} <span className="ml-3 font-mono text-xs font-normal text-stone-400">{mission.hour.toFixed(1)} / {mission.durationHours} h</span></h1>
            </div>
            <div className="game-surface flex flex-wrap items-center gap-3 px-3 py-3 pointer-events-auto">
              <Chip icon={<Zap className="h-4 w-4 text-amber-300" aria-hidden />} label="Battery" value={`${r.batteryKwh.toFixed(0)} kWh`} low={r.batteryKwh <= config.batterySafetyThresholdKwh} />
              <Chip icon={<Droplets className="h-4 w-4 text-cyan-300" aria-hidden />} label="Water" value={`${r.waterLiters.toFixed(1)} L`} low={r.waterLiters <= config.waterSafetyThresholdLiters} />
              <Chip icon={<Wind className="h-4 w-4 text-sky-300" aria-hidden />} label="Oxygen" value={`${r.oxygenKg.toFixed(1)} kg`} low={r.oxygenKg <= config.oxygenSafetyThresholdKg} />
              <button
                type="button"
                onClick={handleToggleSound}
                className="p-1.5 rounded border border-mars-border bg-black/55 text-stone-300 hover:text-stone-100 transition"
                title={muted ? 'Unmute audio' : 'Mute audio'}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              >
                {muted ? <VolumeX size={15} className="text-stone-400" /> : <Volume2 size={15} className="text-amber-400" />}
              </button>
            </div>
          </header>
          <aside className="pointer-events-auto absolute left-4 top-52 w-[min(20rem,calc(100vw-2rem))] sm:left-7 sm:top-36 lg:top-28">
            <div className="game-surface border-l-2 border-l-orange-300 px-4 py-3">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-orange-300"><span>{concluded ? 'Mission concluded' : 'Current objective'}</span><span>{mission.emergency?.mode ?? mission.training?.mode ?? 'cadet'}</span></div>
              <h2 className="mt-2 text-base font-semibold">{objective.title}</h2><p className="mt-2 hidden text-sm leading-relaxed text-stone-300 sm:block">{objective.detail}</p>
              <div className="mt-3 border-t border-white/10 pt-2 text-xs text-sky-200">{objective.destination}</div>
              {objective.wait && <div className="mt-3 flex items-center gap-2"><span className="text-xs text-stone-400">Wait</span><button type="button" disabled={mode !== 'exploration'} onClick={() => { soundManager.playClick(); if (mission.emergency) applyAction({ type: 'ADVANCE_MINUTES', minutes: 1 }); else advanceTime(1); }} className="game-button">{mission.emergency ? '+1m' : '+1h'}</button><button type="button" disabled={mode !== 'exploration'} onClick={() => { soundManager.playClick(); if (mission.emergency) applyAction({ type: 'ADVANCE_MINUTES', minutes: 5 }); else advanceTime(6); }} className="game-button">{mission.emergency ? '+5m' : '+6h'}</button></div>}
              {concluded && <button type="button" className="game-button mt-3 w-full" onClick={() => { soundManager.playClick(); useExploreStore.getState().openDebrief(); }}>Review Mission Autopsy</button>}
            </div>
            {mission.stormActive && <div className="mt-2 px-1 font-mono text-[10px] uppercase tracking-wider text-amber-200">▲ Dust storm / reduced solar generation</div>}
          </aside>
          <footer className="pointer-events-auto absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-2 sm:inset-x-7 sm:bottom-6">
            <div className="game-surface px-3 py-2 text-xs text-stone-300">
              <div className="mb-1 flex items-center gap-2 text-sky-200"><Gamepad2 size={14} aria-hidden />{room ? ROOMS[room].label : 'Connecting corridor'}</div>
              <div className="mb-1 text-[10px] text-stone-400">{roomPower?.label}</div><span className="hidden sm:inline"><kbd className="kbd">WASD</kbd> move · <kbd className="kbd">Shift</kbd> run · </span><kbd className="kbd">E</kbd> interact
            </div>
            <nav aria-label="Mission controls" className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => { soundManager.playClick(); useExploreStore.getState().exitHabitat(); }} className="game-button border-orange-400/40 text-orange-200 hover:bg-orange-950/60 font-medium">Colony Overview</button>
              <button type="button" onClick={onObjectives} className="game-button">Objectives</button>
              <button type="button" onClick={() => { soundManager.playClick(); useExploreStore.getState().togglePause(); }} className="game-button">Menu <span className="hidden sm:inline">/ Esc</span></button>
            </nav>
          </footer>
          {mode === 'paused' && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-[#07121b]/70 p-5 backdrop-blur-sm">
              <section ref={pauseRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Mission menu" className="game-surface max-h-[90dvh] w-full max-w-sm space-y-3 overflow-y-auto p-6">
                <p className="font-mono text-xs uppercase tracking-widest text-orange-300">Ares station / mission menu</p>
                <h2 className="text-2xl font-semibold">Take a breath.</h2>
                <p className="text-sm leading-relaxed text-stone-300">Time advances only when you choose +1h, +6h or perform equipment tasks. Walking and exploring use no mission time.</p>

                <div className="flex items-center justify-between border-t border-b border-white/10 py-2.5 my-2 text-xs">
                  <span className="text-stone-300 flex items-center gap-2">
                    {muted ? <VolumeX size={15} className="text-stone-400" /> : <Volume2 size={15} className="text-amber-400" />}
                    <span>Sound Effects & Ambience</span>
                  </span>
                  <button type="button" onClick={handleToggleSound} className="game-button py-1 px-2.5">
                    {muted ? 'Unmute' : 'Mute'}
                  </button>
                </div>

                <button className="game-button block w-full" onClick={() => { soundManager.playClick(); useExploreStore.getState().togglePause(); }}>Resume exploration</button>
                <button className="game-button flex w-full items-center justify-center gap-2" onClick={() => { soundManager.playClick(); useExploreStore.getState().openDebrief(); }}><ClipboardList size={14} />Mission Autopsy</button>
                <details className="border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs text-stone-300">Wait / advance mission time</summary><p className="mt-2 text-xs text-stone-400">Waiting runs the simulation with your current decisions. Check resources and equipment before continuing.</p><div className="mt-2 flex gap-2"><button className="game-button" disabled={concluded} onClick={() => { soundManager.playClick(); if (mission.emergency) applyAction({ type: 'ADVANCE_MINUTES', minutes: 1 }); else advanceTime(1); useExploreStore.getState().togglePause(); }}>{mission.emergency ? 'Wait +1 min' : 'Wait +1h'}</button><button className="game-button" disabled={concluded} onClick={() => { soundManager.playClick(); if (mission.emergency) applyAction({ type: 'ADVANCE_MINUTES', minutes: 5 }); else advanceTime(6); useExploreStore.getState().togglePause(); }}>{mission.emergency ? 'Wait +5 min' : 'Wait +6h'}</button></div></details>
                <button className="game-button flex w-full items-center justify-center gap-2" onClick={() => { soundManager.playClick(); useExploreStore.getState().exitHabitat(); }}><LogOut size={14} />Colony Overview</button>
                {onTrainingMenu && <button type="button" className="game-button block w-full" onClick={() => { soundManager.playClick(); onTrainingMenu(); }}>Training menu · keep this attempt</button>}

                {/* Restart Confirmation */}
                <div className="border-t border-white/10 pt-3">
                  {!confirmRestart ? (
                    <button
                      type="button"
                      className="game-button w-full border-red-500/40 text-red-200 hover:bg-red-950/40 flex items-center justify-center gap-2"
                      onClick={() => setConfirmRestart(true)}
                    >
                      <RotateCcw size={14} /> Restart Mission
                    </button>
                  ) : (
                    <div className="space-y-2 p-3 rounded border border-red-500/40 bg-red-950/30">
                      <p className="text-xs text-red-200">Are you sure? This will wipe your saved mission progress and start over.</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="game-button flex-1 bg-red-600 hover:bg-red-500 text-white"
                          onClick={() => {
                            resetMission();
                            setConfirmRestart(false);
                            useExploreStore.getState().togglePause();
                          }}
                        >
                          Yes, Restart
                        </button>
                        <button
                          type="button"
                          className="game-button flex-1"
                          onClick={() => setConfirmRestart(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

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
              <ol className="space-y-3">{objectives.map((item, index) => <li key={item.id} className="flex items-start gap-3 border-t border-white/10 pt-3"><span className="font-mono text-sky-200">0{index + 1}</span><div><div className="text-sm text-stone-100">{item.title}</div><p className="mt-1 text-xs text-stone-400">{item.destination} · <span className={item.status === 'completed' ? 'text-emerald-200' : item.status === 'retry' || item.status === 'failed' ? 'text-amber-200' : 'text-sky-200'}>{item.status}</span></p></div></li>)}</ol>
              {guide.hint && <p className="mt-2 text-amber-200"><span className="font-semibold">Hint: </span>{guide.hint}</p>}
              {guide.concept && <p className="mt-2 text-sky-200"><span className="font-semibold">Science: </span>{guide.concept}</p>}
              <p className="mt-2 text-stone-400">Keep four crew safe and complete the selected mission’s verification requirements. Explore the rooms: Mission Control (north), Power Room (east), Life Support (west), Greenhouse (south).</p>
            </div>
          )}
        </>
      )}

      {mission.emergency && mode !== 'paused' && mode !== 'debrief' && <div className="absolute bottom-20 left-3 right-3 z-20 max-h-40 overflow-auto pointer-events-auto sm:right-auto sm:w-[28rem]"><EmergencyTelemetry compact/>{mode==='exploration'&&<FankouchCompanion/>}</div>}
      {/* Focused task surface */}
      {mode === 'task' && taskId && (
        <TaskShell showWorkflow={taskId !== 'water-recycler'} title={mission.emergency&&(taskId==='crew-terminal'||taskId==='air-unit')?'Atmospheric engineering console':TASK_META[taskId].title} subtitle={mission.emergency&&(taskId==='crew-terminal'||taskId==='air-unit')?getMission(mission.scenarioId).destination:TASK_META[taskId].subtitle} layout={TASK_META[taskId].layout} onClose={() => useExploreStore.getState().endTask()}>
          {taskId === 'water-recycler' && (mission.emergency ? <ModuleInfoTask moduleId="water-recycler"/> : <TrainingPanel embedded />)}
          {taskId === 'power-console' && <PowerTask />}
          {taskId === 'mission-console' && <MissionTask onOpenDebrief={() => { useExploreStore.getState().openDebrief(); }} />}
          {taskId === 'greenhouse-station' && <GreenhouseTask />}
          {taskId === 'crew-terminal' && (mission.emergency ? <AtmosphereWorkbench /> : <CrewTask />)}
          {taskId === 'air-unit' && (mission.emergency ? <AtmosphereWorkbench /> : <ModuleInfoTask moduleId="life-support" />)}
        </TaskShell>
      )}

      {mode === 'debrief' && (
        <div ref={debriefRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Mission debrief" className="absolute inset-x-3 inset-y-3 z-30 overflow-y-auto rounded-lg border border-mars-border bg-[#150a08]/95 shadow-2xl backdrop-blur-md sm:inset-x-[12%]">
          <div className="sticky top-0 z-10 flex justify-end border-b border-mars-border bg-black/60 px-3 py-2">
            <button type="button" onClick={() => useExploreStore.getState().closeDebrief()} className="rounded border border-stone-600 bg-stone-900 px-2.5 py-1 text-xs hover:bg-stone-800">Back <kbd className="ml-1 rounded bg-black/60 px-1 font-mono text-[10px]">Esc</kbd></button>
          </div>
          <MissionDebrief />
        </div>
      )}

      {mode === 'exploration' && !showObjectives && <div className="touch-movement absolute bottom-40 left-4 z-10 grid grid-cols-3 gap-1" aria-label="Touch movement controls">
        {([['up', '↑', 'Move north'], ['left', '←', 'Move west'], ['down', '↓', 'Move south'], ['right', '→', 'Move east']] as const).map(([direction, arrow, label], i) => <button key={direction} type="button" aria-label={label} className={`game-button h-11 w-11 select-none ${i === 0 ? 'col-start-2' : i === 1 ? 'col-start-1 row-start-2' : 'row-start-2'}`} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); keys.current[direction] = true; }} onPointerUp={() => { keys.current[direction] = false; }} onPointerCancel={() => { keys.current[direction] = false; }} onLostPointerCapture={() => { keys.current[direction] = false; }}>{arrow}</button>)}
      </div>}
      <NovaDock />
      <FeedbackToast className="bottom-28" />
      <button type="button" className="sr-only" onClick={clearFeedback}>Dismiss feedback</button>
    </div>
  );
};

export default HabitatExplorer;
