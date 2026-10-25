'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Orbit,
  Radio,
  Wind,
  Zap,
  Droplets,
  ShieldAlert,
  Compass,
  UserCheck,
  RotateCcw,
  BookOpen,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { LearningMode } from '@/simulation/training/types';

interface Props {
  onStart: (mode: LearningMode, destination?: 'colony' | 'habitat') => void;
  onContinue?: () => void;
  canContinue?: boolean;
  savedHour?: number;
  savedBattery?: number;
  savedWater?: number;
}

export function MissionBriefing({
  onStart,
  onContinue,
  canContinue = false,
  savedHour = 0,
  savedBattery = 110,
  savedWater = 35,
}: Props) {
  const [screen, setScreen] = useState<'menu' | 'missions' | 'briefing'>('menu');
  const [mode, setMode] = useState<LearningMode>('cadet');
  const [destination, setDestination] = useState<'colony' | 'habitat'>('colony');

  return (
    <main className="briefing training-entry relative overflow-x-hidden min-h-screen bg-[#0e0b0c] text-cream">
      {/* Ambient Mars celestial sphere in background */}
      <div className="briefing-orbit pointer-events-none opacity-40 select-none" aria-hidden="true">
        <div className="briefing-planet" />
        <span className="font-data text-xs text-dust-2">CHRYSE PLANITIA · 22.4° N, 49.9° W</span>
      </div>

      {/* Brand Header */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-space-line/50 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-flare/10 border border-flare/30 text-flare">
            <Orbit size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-bold tracking-wider text-cream">MISSIONLAB</span>
              <span className="rounded bg-flare/20 px-2 py-0.5 font-data text-[10px] font-semibold text-flare border border-flare/30">
                LUMEN 2.0 · BEYOND 2030
              </span>
            </div>
            <p className="font-data text-[11px] uppercase tracking-widest text-dust">
              Autonomous Mars Habitat Simulator
            </p>
          </div>
        </div>

        {/* Vision & Concept Badge */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-data text-dust bg-space-2 px-3 py-1.5 rounded-full border border-space-line">
          <span className="h-2 w-2 rounded-full bg-status-ok animate-pulse" />
          <span>DETERMINISTIC ECLSS DIGITAL TWIN</span>
        </div>
      </header>

      {/* Main Copy & Interactive Flow */}
      <section className="relative z-10 max-w-2xl py-8 sm:py-12">
        {screen !== 'menu' && (
          <button
            type="button"
            className="mb-6 inline-flex items-center gap-2 rounded-md border border-space-line bg-space-2 px-3 py-1.5 text-xs font-medium text-dust hover:text-cream hover:border-ember transition"
            onClick={() => setScreen(screen === 'briefing' ? 'missions' : 'menu')}
          >
            <ArrowLeft size={14} /> Back
          </button>
        )}

        {/* Eyebrow Breadcrumb */}
        <div className="mission-eyebrow mb-3 flex items-center gap-2 font-data text-xs uppercase tracking-widest text-ember">
          <span className="status-dot h-2 w-2 rounded-full bg-ember shadow-[0_0_8px_#f47a3a]" />
          {screen === 'menu'
            ? 'MISSION SELECTION & COMMAND OVERVIEW'
            : screen === 'missions'
            ? 'TRAINING CATALOG / 01 SCENARIO ACTIVE'
            : 'TACTICAL BRIEFING / THE RED STORM'}
        </div>

        {/* SCREEN 1: Menu / Overview */}
        {screen === 'menu' ? (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] text-cream">
                Your crew.<br />
                <em className="text-ember not-italic">Your call.</em>
              </h1>
              <p className="mt-4 text-lg sm:text-xl font-medium leading-relaxed text-cream/90 max-w-xl">
                Master extraterrestrial systems engineering by keeping a simulated Mars research outpost operational.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-dust max-w-xl">
                Operate life-support machinery, manage electrical power buffers during severe dust storms, and observe real, unscripted consequences. At mission conclusion, dissect your choices through our evidence-grounded <strong className="text-cream">Mission Autopsy</strong>.
              </p>
            </div>

            {/* Persistent Flight Log Callout */}
            <div className="rounded-lg border border-space-line bg-space-2/90 p-4 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ember">
                <Sparkles size={14} /> Persistent Telemetry & Decision Tracking
              </div>
              <p className="mt-1 text-xs text-dust leading-relaxed">
                Every operational decision you confirm is recorded in our deterministic state tree. Your mission progress is automatically saved to local storage so you can pause, resume, and explore counterfactual timelines with <strong className="text-cream">Timeline Rewind</strong>.
              </p>
            </div>

            {/* Resume Saved Mission Card if available */}
            {canContinue && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-4 shadow-md space-y-3">
                <div className="flex items-center justify-between text-xs text-emerald-300">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <UserCheck size={14} /> ACTIVE FLIGHT RECORD IN STORAGE
                  </span>
                  <span className="font-data">Hour {savedHour.toFixed(1)} / 72.0 h</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-data text-stone-300">
                  <div className="flex items-center gap-1">
                    <Zap size={12} className="text-amber-400" /> Battery: {savedBattery.toFixed(0)} kWh
                  </div>
                  <div className="flex items-center gap-1">
                    <Droplets size={12} className="text-cyan-400" /> Water: {savedWater.toFixed(1)} L
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onContinue}
                  className="game-button flex w-full items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded transition text-sm shadow"
                >
                  Continue current mission <ArrowUpRight size={16} />
                </button>
              </div>
            )}

            {/* Main Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setScreen('missions')}
                className="start-mission inline-flex items-center justify-between gap-4 rounded-md bg-flare px-6 py-4 font-body text-base font-bold text-flare-ink shadow-lg transition hover:bg-flare-hover active:translate-y-px"
              >
                <span>Start Training</span>
                <ArrowUpRight size={20} />
              </button>
            </div>

            {/* Controls Guide Collapsible */}
            <details className="rounded-md border border-space-line/70 bg-space-2/60 p-3 text-xs text-dust">
              <summary className="cursor-pointer font-medium text-cream hover:text-ember transition">
                Simulation Controls & Operation Guidelines
              </summary>
              <div className="mt-3 space-y-2 border-t border-space-line/40 pt-2 leading-relaxed">
                <p>
                  <strong className="text-cream">Time Stepping:</strong> Simulation physics advance solely when you command (+1h, +6h, or auto-run). Physical equations never run on animation frame deltas.
                </p>
                <p>
                  <strong className="text-cream">Colony Overview:</strong> Inspect habitat modules, power demand, equipment health, and execute maintenance repairs from the central command console.
                </p>
                <p>
                  <strong className="text-cream">Habitat Field Mode:</strong> Use <kbd className="kbd">WASD</kbd> to move, <kbd className="kbd">Shift</kbd> to run, and <kbd className="kbd">E</kbd> near equipment to inspect terminals.
                </p>
              </div>
            </details>
          </div>
        ) : screen === 'missions' ? (
          /* SCREEN 2: Mission Catalog */
          <div className="space-y-6">
            <h1 className="catalog-title font-display text-3xl sm:text-5xl font-bold tracking-tight text-cream">
              Choose your<br />
              <em className="text-ember not-italic">mission.</em>
            </h1>

            <article className="mission-choice rounded-xl border border-ember/40 bg-space-2 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between text-xs font-data text-ember">
                <span className="font-bold">01 / AVAILABLE</span>
                <span>Introductory Scenario · 15–25 min</span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-cream">The Red Storm</h2>
                <p className="mt-2 text-sm leading-relaxed text-dust">
                  A regional Martian dust storm slashes solar power to 4.0 kW. Protect 4 crew members through 72 hours of resource constraints, manage battery reserves, and resolve a secondary water distillation pump failure.
                </p>
              </div>

              <div className="rounded-lg border border-space-line bg-space-3/60 p-4 space-y-2 text-xs">
                <div className="font-semibold text-cream">Primary Mission Objectives:</div>
                <ul className="space-y-1.5 text-dust">
                  <li className="flex items-center gap-2">
                    <span className="font-data text-ember">01</span> Balance electrical power supply vs essential life-support loads
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-data text-ember">02</span> Diagnose water recycler degradation using telemetry evidence
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="font-data text-ember">03</span> Repair equipment with available spares and review your Mission Autopsy
                  </li>
                </ul>
              </div>

              {/* Guidance Level Selector */}
              <fieldset className="border-t border-space-line pt-4">
                <legend className="text-xs font-semibold uppercase tracking-wider text-cream mb-2">
                  Guidance Level · Identical Simulation Physics
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['cadet', 'engineer', 'commander'] as const).map((m) => (
                    <div
                      key={m}
                      onClick={() => setMode(m)}
                      className={`cursor-pointer rounded-lg border p-3 transition flex flex-col justify-between ${
                        mode === m
                          ? 'border-flare bg-flare/10 text-cream shadow-sm'
                          : 'border-space-line bg-space-3 text-dust hover:border-space-line/80'
                      }`}
                    >
                      <label
                        htmlFor={`entry-mode-${m}`}
                        className="flex items-center gap-2 cursor-pointer font-bold text-xs uppercase tracking-wide capitalize text-cream"
                      >
                        <input
                          id={`entry-mode-${m}`}
                          type="radio"
                          name="entry-mode"
                          value={m}
                          checked={mode === m}
                          onChange={() => setMode(m)}
                          className="accent-flare cursor-pointer"
                        />
                        <span>{m}</span>
                      </label>
                      <p className="text-[11px] text-dust mt-2 select-none">
                        {m === 'cadet'
                          ? 'Step-by-step hints and highlighted actions.'
                          : m === 'engineer'
                          ? 'Telemetry objectives and science insights.'
                          : 'Unassisted mission command.'}
                      </p>
                    </div>
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                onClick={() => setScreen('briefing')}
                className="start-mission inline-flex w-full items-center justify-between rounded-md bg-flare px-6 py-3.5 font-body text-sm font-bold text-flare-ink shadow-lg transition hover:bg-flare-hover"
              >
                <span>View briefing</span>
                <ArrowUpRight size={18} />
              </button>
            </article>

            {/* Future Scenarios Notice */}
            <p className="text-xs text-dust-2 flex items-center gap-2">
              <ShieldAlert size={14} className="text-dust shrink-0" />
              <span>
                Future training: radiation shelter decisions. Not playable yet. Dust storms and radiation events are different hazards.
              </span>
            </p>
          </div>
        ) : (
          /* SCREEN 3: Mission Briefing & Launch */
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-cream">
                The Red<br />
                <em className="text-ember not-italic">Storm.</em>
              </h1>
              <p className="mt-3 text-lg font-medium text-cream">
                Four crew. One habitat. You are the mission commander.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-dust">
                Chryse Planitia, 2045. Atmospheric particulate has collapsed photovoltaic output to 4.0 kW. Your initial priority is evaluating the electrical power distribution board. Decide which optional loads to shed, maintain life-support heating, and prepare for downstream mechanical faults.
              </p>
            </div>

            {/* Mission Goals */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 rounded-lg border border-space-line bg-space-2 p-3 text-cream">
                <Wind size={16} className="text-sky-400 shrink-0" />
                <span>Keep ECLSS atmospheric scrubbers and heating active</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-space-line bg-space-2 p-3 text-cream">
                <Radio size={16} className="text-amber-400 shrink-0" />
                <span>Diagnose telemetry alarms with recorded evidence</span>
              </div>
            </div>

            {/* Operational Station Selector */}
            <div className="rounded-xl border border-space-line bg-space-2 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-cream flex items-center gap-1.5">
                  <Compass size={14} className="text-ember" /> Choose Initial Command Station
                </span>
                <span className="text-[11px] font-data text-dust">Switchable anytime</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDestination('colony')}
                  className={`text-left p-3.5 rounded-lg border transition ${
                    destination === 'colony'
                      ? 'border-flare bg-flare/10 shadow'
                      : 'border-space-line bg-space-3 hover:border-space-line/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-cream flex items-center gap-1.5">
                      <Layers size={13} className="text-flare" /> Colony Mission Control
                    </span>
                    <span className="text-[10px] rounded bg-flare/20 px-1.5 py-0.2 font-data font-semibold text-flare">
                      RECOMMENDED
                    </span>
                  </div>
                  <p className="text-[11px] text-dust leading-normal">
                    Interactive 3D colony twin, live telemetry HUD, subsystem inspector, and power controls.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDestination('habitat')}
                  className={`text-left p-3.5 rounded-lg border transition ${
                    destination === 'habitat'
                      ? 'border-flare bg-flare/10 shadow'
                      : 'border-space-line bg-space-3 hover:border-space-line/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-cream flex items-center gap-1.5">
                      <BookOpen size={13} className="text-ember" /> Habitat Interior Walk
                    </span>
                    <span className="text-[10px] font-data text-dust">Field View</span>
                  </div>
                  <p className="text-[11px] text-dust leading-normal">
                    Walk through the habitat rooms as an astronaut and inspect equipment workbenches.
                  </p>
                </button>
              </div>
            </div>

            {/* Begin Mission Action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => (destination === 'colony' ? onStart(mode) : onStart(mode, destination))}
                className="start-mission inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-md bg-flare px-8 py-4 font-body text-base font-bold text-flare-ink shadow-xl transition hover:bg-flare-hover active:translate-y-px"
              >
                <span>Begin Mission</span>
                <ArrowUpRight size={20} />
              </button>

              {canContinue && (
                <p className="mt-3 text-xs text-ember flex items-center gap-1.5">
                  <RotateCcw size={13} />
                  <span>
                    Beginning starts a new attempt and resets your saved mission. Use Back → main menu to continue your current attempt instead.
                  </span>
                </p>
              )}
            </div>

            {/* Quick Controls Cheat-sheet */}
            <p className="briefing-controls text-xs text-dust flex items-center gap-2 pt-2 border-t border-space-line/40">
              <kbd className="kbd">Mouse</kbd> Orbit & select · <kbd className="kbd">+1h / +6h</kbd> Advance clock · <kbd className="kbd">Esc</kbd> Menu
            </p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-space-line/40 pt-4 flex flex-wrap items-center justify-between text-xs font-data text-dust-2">
        <span>LUMEN 2.0 / BEYOND 2030 COMPETITION</span>
        <span>EXPERIENTIAL SYSTEMS THINKING FOR SPACE EXPLORATION</span>
      </footer>
    </main>
  );
}
