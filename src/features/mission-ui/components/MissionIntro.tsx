'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, MapPin, RotateCcw } from 'lucide-react';
import { MISSIONS, getMission, RED_STORM_ID } from '@/simulation/missions/registry';
import type { FaultId, MissionId } from '@/simulation/missions/types';
import { loadSessionFromStorage } from '@/state/missionStore';

interface Props {
  account: React.ReactNode;
  missionId?: MissionId;
  /** Starts a fresh attempt. `fault` selects the hidden-fault variant of an atmospheric mission. */
  onStart: (fault?: FaultId) => void;
  /** Continues this mission's saved attempt. */
  onResume: () => void;
}

/** In-app briefing shown right before a mission, driven by the mission registry. One card, one action. */
export function MissionIntro({ account, missionId = RED_STORM_ID, onStart, onResume }: Props) {
  const mission = getMission(missionId);
  const cfg = mission.config;
  const [variant, setVariant] = useState(0);
  // Read after mount: local storage does not exist during server rendering.
  const [saved, setSaved] = useState<{ status: string; hour: number } | null>(null);
  useEffect(() => {
    const s = loadSessionFromStorage(missionId);
    setSaved(s ? { status: s.missionState.status, hour: s.missionState.hour } : null);
  }, [missionId]);

  const unit = mission.emergency ? 'min' : 'h';
  const elapsed = saved ? (mission.emergency ? Math.round(saved.hour * 60) : Math.round(saved.hour)) : 0;
  const stats: [string, string][] = [
    ['Duration', `${cfg.durationHours} h`],
    ['Crew', String(cfg.crewCount)],
    mission.emergency ? ['Level', mission.difficulty] : ['Solar in storm', `${cfg.normalSolarGenerationKw.toFixed(0)} → ${cfg.stormSolarGenerationKw.toFixed(0)} kW`],
  ];

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

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.35fr_1fr]">
        <section className="grid gap-6 rounded-lg border border-space-line bg-space-2 p-6 sm:p-8">
          <div className="grid gap-3">
            <span className="eyebrow">Mission {mission.number} · {mission.hazard}</span>
            <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">{mission.title}</h1>
            <p className="max-w-[60ch] text-[15px] text-dust">{mission.briefing}</p>
          </div>

          <dl className="grid grid-cols-3 gap-3">
            {stats.map(([k, v]) => (
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
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-flare" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-dust">{mission.concept}</p>
          </div>

          {mission.faultVariants.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="font-data text-[11px] uppercase tracking-[0.16em] text-dust-2">Exercise · same physics, different hidden fault</legend>
              <div className="flex flex-wrap gap-2">
                {mission.faultVariants.map((fault, i) => (
                  <label key={fault} className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${variant === i ? 'border-flare text-cream' : 'border-space-line text-dust'}`}>
                    <input type="radio" name="exercise" className="sr-only" checked={variant === i} onChange={() => setVariant(i)} />
                    Exercise {'ABC'[i]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-space-line pt-5">
            {saved && (
              <button type="button" onClick={onResume} className="btn-primary min-h-12 px-6 text-base">
                Resume attempt · {elapsed} {unit} {saved.status === 'running' ? '' : `· ${saved.status}`} <ArrowRight className="h-5 w-5" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => onStart(variant ? mission.faultVariants[variant] : undefined)}
              className={`${saved ? 'btn-secondary' : 'btn-primary'} min-h-12 px-6 text-base`}
            >
              {saved ? (<><RotateCcw className="h-4 w-4" aria-hidden /> Start fresh</>) : (<>Start mission <ArrowRight className="h-5 w-5" aria-hidden /></>)}
            </button>
            <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-dust">
              <kbd className="kbd">W A S D</kbd> move · <kbd className="kbd">Shift</kbd> run · <kbd className="kbd">E</kbd> interact
            </p>
          </div>
        </section>

        <aside className="hidden flex-col items-center gap-4 lg:flex">
          <div className="relative max-w-[300px] rounded-[14px] bg-cream px-4 py-3 text-[15px] font-medium text-flare-ink shadow-xl">
            {mission.objective}
            <span className="absolute -bottom-1.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-sm bg-cream" />
          </div>
          <Image src="/mascot/fankouch-thinking.webp" alt="Fankouch thinking" width={458} height={520} className="h-64 w-auto animate-bob" priority />
          <p className="flex items-center gap-1.5 text-[13px] text-dust-2">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> First destination: {mission.destination}
          </p>
          <nav aria-label="Other missions" className="flex flex-wrap justify-center gap-2 text-[13px]">
            {MISSIONS.filter((m) => m.id !== missionId).map((m) => (
              <Link key={m.id} href={`/mission?mission=${m.id}`} className="rounded border border-space-line px-2.5 py-1 text-dust hover:text-cream">
                {m.number} · {m.title}
              </Link>
            ))}
          </nav>
        </aside>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-5 text-[12px] text-dust-2 sm:px-6">
        Simplified educational model. Values are fictional gameplay parameters.
      </footer>
    </div>
  );
}
