'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useMissionStore } from '@/state/missionStore';
import { getGuidance, type GuidanceStage } from '@/simulation/training/guidance';

const STAGES = ['Discover', 'Investigate', 'Understand', 'Plan', 'Execute', 'Verify', 'Reflect'] as const;
const STAGE_OF: Record<GuidanceStage, (typeof STAGES)[number]> = {
  free: 'Discover',
  'power-plan': 'Plan',
  monitor: 'Verify',
  'diagnose-start': 'Investigate',
  'diagnose-conclude': 'Understand',
  'plan-repair': 'Plan',
  repair: 'Execute',
  verify: 'Verify',
  retry: 'Verify',
  recovered: 'Reflect',
  concluded: 'Reflect',
};

interface Props {
  title: string;
  subtitle: string;
  onClose: () => void;
  /** Overlay layout: 'drawer' keeps the 3D machine visible on the left; 'panel' is a near-full-screen surface. */
  layout: 'drawer' | 'panel';
  children: React.ReactNode;
}

/** Common frame for every focused task: what it is, where the learner is in the learning workflow, and a way out. */
export const TaskShell: React.FC<Props> = ({ title, subtitle, onClose, layout, children }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const mission = useMissionStore((s) => s.missionState);
  const stage = STAGE_OF[getGuidance(mission).stage];
  const frame =
    layout === 'drawer'
      ? 'absolute inset-x-2 bottom-2 h-[55dvh] md:inset-x-auto md:inset-y-4 md:right-4 md:h-auto md:w-[min(30rem,40vw)]'
      : 'absolute inset-x-3 inset-y-3 sm:inset-x-[6%] sm:inset-y-5';
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const frame = frameRef.current;
    frame?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !frame) return;
      const controls = Array.from(frame.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]'));
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === frame)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === frame)) { event.preventDefault(); first?.focus(); }
    };
    frame?.addEventListener('keydown', trap);
    return () => { frame?.removeEventListener('keydown', trap); previous?.focus(); };
  }, []);
  return (
    <div ref={frameRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`${frame} z-30 flex flex-col overflow-hidden rounded-lg border border-mars-border bg-[#111e26]/95 shadow-2xl backdrop-blur-md`}>
      <div className="flex items-start justify-between gap-3 border-b border-mars-border bg-black/40 px-4 py-3">
        <div>
          <h2 className="text-base font-bold text-stone-100">{title}</h2>
          <p className="text-xs text-stone-400">{subtitle}</p>
        </div>
        <button type="button" onClick={onClose} className="flex items-center gap-1.5 rounded border border-stone-600 bg-stone-900 px-2.5 py-1 text-xs text-stone-200 hover:bg-stone-800" aria-label="Close task and return to walking (Esc)">
          <X className="h-3.5 w-3.5" aria-hidden /> Back <kbd className="rounded bg-black/60 px-1 font-mono text-[10px]">Esc</kbd>
        </button>
      </div>
      <ol className="flex flex-wrap gap-1 border-b border-mars-border/60 bg-black/20 px-3 py-1.5" aria-label="Learning workflow">
        {STAGES.map((s) => (
          <li key={s} aria-current={s === stage ? 'step' : undefined} className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${s === stage ? 'bg-orange-600 text-white' : 'text-stone-500'}`}>
            {s}
          </li>
        ))}
      </ol>
      <div className="task-content min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
};
