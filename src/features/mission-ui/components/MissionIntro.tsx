'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Compass, Gauge, MapPin, RotateCcw, ShieldCheck } from 'lucide-react';
import { MISSIONS, getMission } from '@/simulation/missions/registry';
import type { MissionId } from '@/simulation/missions/types';
import type { LearningMode } from '@/simulation/training/types';
import { loadSessionFromStorage } from '@/state/missionStore';

const MODES: { id: LearningMode; label: string; hint: string }[] = [
  { id: 'cadet', label: 'Cadet', hint: 'Hints and science explained' },
  { id: 'engineer', label: 'Engineer', hint: 'Objectives and instruments' },
  { id: 'commander', label: 'Commander', hint: 'Operational warnings only' },
];

const MASCOT: Record<MissionId, { src: string; w: number; h: number; line: string }> = {
  'mission-01-red-storm': { src: '/mascot/fankouch-thinking.webp', w: 458, h: 520, line: 'The storm hits at hour 0. Check the power first!' },
  'mission-02-pressure-drop': { src: '/mascot/fankouch-surprised.webp', w: 520, h: 507, line: 'Is gas really escaping, or is an instrument lying?' },
  'mission-03-silent-air': { src: '/mascot/fankouch-exploring.webp', w: 520, h: 454, line: 'Oxygen looks fine… so why is CO₂ rising?' },
};

interface MissionIntroProps {
  account: React.ReactNode;
  missionId: MissionId;
  onSelectMission: (id: MissionId) => void;
  onStart: (mode: LearningMode, destination: 'colony' | 'habitat') => void;
  onResume: () => void;
}

/** Short in-app briefing shown before a mission. One card, one action, data from the mission registry. */
export function MissionIntro({ account, missionId, onSelectMission, onStart, onResume }: MissionIntroProps) {
  const mission = getMission(missionId);
  const [mode, setMode] = useState<LearningMode>('cadet');
  const [destination, setDestination] = useState<'colony' | 'habitat'>(mission.emergency ? 'habitat' : 'colony');
  const [saved, setSaved] = useState<{ hour: number; status: string } | null>(null);
  const mascot = MASCOT[missionId];

  // Saved attempts live in browser storage, so read them after mount.
  useEffect(() => {
    const s = loadSessionFromStorage(missionId);
    setSaved(s && s.missionState.status === 'running' && s.missionState.hour > 0 ? { hour: s.missionState.hour, status: s.missionState.status } : null);
    setDestination(getMission(missionId).emergency ? 'habitat' : 'colony');
  }, [missionId]);

  const duration = mission.emergency ? `${Math.round(mission.emergency.durationMinutes)} min` : `${mission.config.durationHours} h`;

  return (
    <div className="flex min-h-dvh flex-col bg-space">
      <header className="border-b border-space-line bg-space-2/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Image src="/brand/logo-mark.png" alt="" width={54} height={30} className="h-7 w-auto" />
          <span className="font-display text-lg font-semibold">
            Mission<span className="text-flare">Lab</span>
          </span>
          <span className="hidden border-l border-space-line pl-3 font-data text-[11px] uppercase tracking-[0.16em] text-dust-2 sm:inline">
            Mission briefing
          </span>
          <div className="ml-auto">{account}</div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 content-center gap-6 px-4 py-8 sm:px-6">
        <nav aria-label="Choose a mission" className="flex flex-wrap gap-2">
          {MISSIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === missionId}
              onClick={() => onSelectMission(m.id)}
              className={`min-h-10 rounded-full border px-4 text-sm transition ${
                m.id === missionId ? 'border-flare bg-flare/10 font-semibold text-cream' : 'border-space-line text-dust hover:border-ember hover:text-cream'
              }`}
            >
              <span className="font-data text-[12px] text-flare">{m.number}</span> {m.title}
            </button>
          ))}
        </nav>

        <div className="grid items-center gap-8 lg:grid-cols-[1.35fr_1fr]">
          <section className="grid gap-6 rounded-lg border border-space-line bg-space-2 p-6 sm:p-8">
            <div className="grid gap-3">
              <span className="eyebrow">Mission {mission.number} · {mission.hazard}</span>
              <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">{mission.title}</h1>
              <p className="max-w-[62ch] text-[15px] text-dust">{mission.briefing}</p>
            </div>

            <dl className="grid grid-cols-3 gap-3">
              {[
                ['Duration', duration],
                ['Crew', String(mission.config.crewCount)],
                ['Level', mission.difficulty],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-space-line bg-space p-3">
                  <dt className="font-data text-[10px] uppercase tracking-[0.14em] text-dust-2">{k}</dt>
                  <dd className="font-data text-base font-bold tabular">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-2">
              <h2 className="font-data text-[11px] uppercase tracking-[0.16em] text-dust-2">Objectives</h2>
              <ul className="grid gap-2">
                {mission.objectives.map((text) => (
                  <li key={text} className="flex items-start gap-3 text-[15px]">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-flare" aria-hidden />
                    {text}
                  </li>
                ))}
              </ul>
              <p className="mt-1 flex items-start gap-2 rounded-md bg-space px-3 py-2 text-[13px] text-dust">
                <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-status-repair" aria-hidden />
                {mission.concept}
              </p>
            </div>

            <fieldset className="grid gap-2">
              <legend className="mb-1 font-data text-[11px] uppercase tracking-[0.16em] text-dust-2">Guidance level · same physics</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {MODES.map((m) => (
                  <label
                    key={m.id}
                    className="flex min-h-target cursor-pointer items-start gap-2 rounded-md border border-space-line bg-space p-3 has-[:checked]:border-flare has-[:checked]:bg-flare/10"
                  >
                    <input type="radio" name="guidance" aria-label={m.id} checked={mode === m.id} onChange={() => setMode(m.id)} className="mt-1 accent-[#fe5319]" />
                    <span className="grid">
                      <span className="font-semibold">{m.label}</span>
                      <span className="text-[12px] text-dust">{m.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-dust">Start in</span>
              {(['colony', 'habitat'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={destination === d}
                  onClick={() => setDestination(d)}
                  className={`min-h-9 rounded-md border px-3 ${destination === d ? 'border-ember text-cream' : 'border-space-line text-dust hover:text-cream'}`}
                >
                  {d === 'colony' ? 'Mission control' : 'The habitat (walk around)'}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-space-line pt-5">
              <button type="button" onClick={() => onStart(mode, destination)} className="btn-primary min-h-12 px-6 text-base">
                Begin {mission.title} <ArrowRight className="h-5 w-5" aria-hidden />
              </button>
              {saved && (
                <button type="button" onClick={onResume} className="btn-secondary min-h-12 px-5">
                  <RotateCcw className="h-4 w-4" aria-hidden /> Resume · {mission.emergency ? `${Math.round(saved.hour * 60)} min` : `H${saved.hour.toFixed(0)}`}
                </button>
              )}
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-dust">
                <kbd className="kbd">W A S D</kbd> move · <kbd className="kbd">Shift</kbd> run · <kbd className="kbd">E</kbd> interact
              </p>
            </div>
          </section>

          <aside className="hidden flex-col items-center gap-4 lg:flex">
            <div className="relative max-w-[300px] rounded-[14px] bg-cream px-4 py-3 text-[15px] font-medium text-flare-ink shadow-xl">
              {mascot.line}
              <span className="absolute -bottom-1.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-sm bg-cream" />
            </div>
            <Image src={mascot.src} alt="Fankouch" width={mascot.w} height={mascot.h} className="h-64 w-auto animate-bob" priority />
            <p className="flex items-center gap-1.5 text-[13px] text-dust-2">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {mission.destination}
            </p>
            <p className="flex items-center gap-1.5 text-[12px] text-dust-2">
              <Compass className="h-3.5 w-3.5" aria-hidden /> NOVA, your AI assistant, is on board to help.
            </p>
          </aside>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-5 text-[12px] text-dust-2 sm:px-6">
        Simplified educational model. Values are fictional calibration, not spacecraft safety standards.
      </footer>
    </div>
  );
}
