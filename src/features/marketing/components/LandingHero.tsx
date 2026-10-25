'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { GUEST_MINUTES } from '@/config/guest';

const HeroScene = dynamic(() => import('./HeroScene'), { ssr: false, loading: () => null });

export function LandingHero({ signedIn }: { signedIn: boolean }) {
  const [storm, setStorm] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <header className="relative isolate flex min-h-[620px] items-end overflow-hidden md:items-center">
      <div className="absolute inset-0 -z-20">
        <HeroScene storm={storm} reducedMotion={reducedMotion} />
      </div>
      <div
        className={`pointer-events-none absolute inset-0 -z-10 transition-colors duration-700 ${
          storm
            ? 'bg-[linear-gradient(0deg,#0e0b0c_0%,rgba(42,16,9,.8)_55%,rgba(58,22,11,.4)_100%)] md:bg-[linear-gradient(90deg,#0e0b0c_0%,rgba(42,16,9,.75)_45%,rgba(58,22,11,.35)_100%)]'
            : 'bg-[linear-gradient(0deg,#0e0b0c_0%,rgba(14,11,12,.8)_55%,transparent_85%)] md:bg-[linear-gradient(90deg,#0e0b0c_0%,rgba(14,11,12,.7)_42%,transparent_70%)]'
        }`}
      />

      <div className="pointer-events-none absolute bottom-0 right-[max(24px,5vw)] hidden h-[clamp(220px,24vw,310px)] animate-bob drop-shadow-[0_18px_28px_rgba(0,0,0,.55)] lg:block">
        <Image src="/mascot/fankouch-wave.webp" alt="Fankouch, the MissionLab astronaut, waving" width={391} height={520} priority className="h-full w-auto" />
      </div>
      <div className="absolute bottom-[clamp(200px,22vw,285px)] right-[calc(max(24px,5vw)+clamp(150px,16vw,210px))] hidden max-w-[260px] rounded-[14px] bg-cream px-4 py-2.5 text-sm font-medium text-flare-ink shadow-xl lg:block">
        Hi commander! I’m <b className="font-display font-semibold">Fankouch</b>. Ready for a storm?
        <span className="absolute -bottom-1.5 right-6 h-3.5 w-3.5 rotate-45 rounded-sm bg-cream" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid max-w-xl gap-6">
          <span className="eyebrow">Mission 01 · The Red Storm</span>
          <h1 className="font-display text-[clamp(2.4rem,5.6vw,4.2rem)] font-semibold leading-[1.05] text-balance">
            Keep four people alive on Mars for <span className="text-flare">72 hours</span>.
          </h1>
          <p className="max-w-[62ch] text-lg text-[#d8ccc5]">
            MissionLab is a 3D mission simulator for students. Make the calls, watch the habitat respond, then rewind and find
            out what would have saved it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/mission" className="btn-primary">
              <Play className="h-4 w-4" aria-hidden />
              {signedIn ? 'Start Training' : `Start Training · guest ${GUEST_MINUTES} min`}
            </Link>
            {!signedIn && (
              <Link href="/signup" className="btn-secondary">
                Create a free account
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              aria-pressed={storm}
              onClick={() => setStorm((s) => !s)}
              className={`inline-flex min-h-10 items-center gap-2.5 rounded-full border bg-space-2/80 py-0 pl-2.5 pr-3.5 text-[13px] font-medium transition ${
                storm ? 'border-status-warn/50 text-status-warn' : 'border-space-line text-dust'
              }`}
            >
              <span className="relative h-[18px] w-[30px] rounded-full border border-space-line bg-space-3" aria-hidden>
                <span
                  className={`absolute top-[2px] h-3 w-3 rounded-full transition-all ${storm ? 'left-[14px] bg-status-warn' : 'left-[2px] bg-dust-2'}`}
                />
              </span>
              Dust storm
            </button>
            <span className="font-data text-[13px] text-dust" aria-live="polite">
              Solar output <b className="text-cream">{storm ? '4.0 kW' : '10.0 kW'}</b>
              {storm && ' · battery draining'}
            </span>
          </div>
          <p className="text-[13px] text-dust-2">Simplified educational model. Values are fictional gameplay parameters.</p>
        </div>
      </div>
    </header>
  );
}
