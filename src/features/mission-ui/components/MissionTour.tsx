'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';

const STEPS = [
  { target: 'tour-scene', title: 'Your Mars base', text: 'This is the habitat. Drag to look around and click any module to inspect it.' },
  { target: 'tour-resources', title: 'Your resources', text: 'Battery, water and oxygen. Keep the battery above the 15 kWh safety reserve.' },
  { target: 'tour-inspector', title: 'Your decisions', text: 'Pick a module here, read the trade-off, then confirm. Some systems can be paused to save power.' },
  { target: 'tour-clock', title: 'Your clock', text: 'Time only moves when you say so. Use +1h or +6h. Good luck, commander!' },
];

interface Rect { top: number; left: number; width: number; height: number }

/** First-mission walkthrough. Purely presentational: it never touches mission state. */
export function MissionTour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  const measure = useCallback(() => {
    const el = document.getElementById(current.target);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
  }, [current.target]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => {
    nextRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onDone]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-flare transition-all duration-300"
          style={{ ...rect, boxShadow: '0 0 0 9999px rgba(8,5,5,.66)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(8,5,5,.66)]" />
      )}

      <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3 sm:right-auto sm:max-w-md">
        <Image src="/mascot/fankouch-pointing.webp" alt="" width={448} height={520} className="hidden h-36 w-auto shrink-0 drop-shadow-xl sm:block" />
        <div className="grid gap-3 rounded-lg border border-space-line bg-space-2 p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <span className="font-data text-[11px] uppercase tracking-[0.14em] text-ember">
              Step {step + 1} of {STEPS.length}
            </span>
            <button type="button" onClick={onDone} className="text-[13px] text-dust hover:text-cream">
              Skip tour
            </button>
          </div>
          <h2 id="tour-title" className="font-display text-xl font-semibold">
            {current.title}
          </h2>
          <p className="text-[15px] text-dust">{current.text}</p>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" className="btn-ghost min-h-10 px-3 text-sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              className="btn-primary min-h-10 px-4 text-sm"
              onClick={() => (last ? onDone() : setStep((s) => s + 1))}
            >
              {last ? 'Start the mission' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
