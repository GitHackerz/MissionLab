'use client';

import Image from 'next/image';
import { ArrowRight, Battery, MapPin, ShieldCheck, Wrench } from 'lucide-react';
import { RED_STORM_CONFIG } from '@/simulation/config';

const OBJECTIVES = [
  { icon: ShieldCheck, text: `Keep all ${RED_STORM_CONFIG.crewCount} crew safe for ${RED_STORM_CONFIG.durationHours} mission hours` },
  { icon: Battery, text: 'Protect the essential systems: air, water and heating' },
  { icon: Wrench, text: 'Find the cause of equipment warnings and fix it' },
];

/** Short in-app briefing shown right before the mission. Not a marketing page: one card, one action. */
export function MissionIntro({ account, onStart }: { account: React.ReactNode; onStart: () => void }) {
  const cfg = RED_STORM_CONFIG;
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
            <span className="eyebrow">Mission {cfg.scenarioId.match(/\d+/)?.[0] ?? '01'} · Mars, 2045</span>
            <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
              The Red <span className="text-flare">Storm</span>
            </h1>
            <p className="text-lg text-cream">Four crew. One habitat. Every system is connected.</p>
            <p className="max-w-[60ch] text-[15px] text-dust">
              A dust storm has cut solar power. Enter Ares Research Station, protect essential systems and investigate equipment
              warnings.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-3">
            {[
              ['Duration', `${cfg.durationHours} h`],
              ['Crew', String(cfg.crewCount)],
              ['Solar in storm', `${cfg.normalSolarGenerationKw.toFixed(0)} → ${cfg.stormSolarGenerationKw.toFixed(0)} kW`],
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
              {OBJECTIVES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-[15px]">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-flare" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-space-line pt-5">
            <button type="button" onClick={onStart} className="btn-primary min-h-12 px-6 text-base">
              Start mission <ArrowRight className="h-5 w-5" aria-hidden />
            </button>
            <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-dust">
              <kbd className="kbd">W A S D</kbd> move · <kbd className="kbd">Shift</kbd> run · <kbd className="kbd">E</kbd> interact
            </p>
          </div>
        </section>

        <aside className="hidden flex-col items-center gap-4 lg:flex">
          <div className="relative max-w-[300px] rounded-[14px] bg-cream px-4 py-3 text-[15px] font-medium text-flare-ink shadow-xl">
            The storm hits at hour 0. Let’s start in the <b className="font-display font-semibold">Power Room</b>!
            <span className="absolute -bottom-1.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-sm bg-cream" />
          </div>
          <Image src="/mascot/fankouch-thinking.webp" alt="Fankouch thinking" width={458} height={520} className="h-64 w-auto animate-bob" priority />
          <p className="flex items-center gap-1.5 text-[13px] text-dust-2">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> First destination: Ares Research Station · Power Room
          </p>
        </aside>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-5 text-[12px] text-dust-2 sm:px-6">
        Simplified educational model. Values are fictional gameplay parameters.
      </footer>
    </div>
  );
}
