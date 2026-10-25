'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useMissionStore } from '@/state/missionStore';

const STYLE = {
  info: 'border-sky-500/50 bg-sky-950/90 text-sky-100',
  success: 'border-emerald-500/50 bg-emerald-950/90 text-emerald-100',
  warning: 'border-amber-500/50 bg-amber-950/90 text-amber-100',
  rejected: 'border-red-500/60 bg-red-950/90 text-red-100',
} as const;

const ICON = { info: 'ℹ', success: '✓', warning: '▲', rejected: '✗' } as const;

/** Educational feedback for the last training action: explains why something worked or was refused. */
export const FeedbackToast: React.FC<{ className?: string }> = ({ className = 'bottom-14' }) => {
  const { lastFeedback, clearFeedback } = useMissionStore();
  useEffect(() => {
    if (!lastFeedback) return;
    const id = window.setTimeout(clearFeedback, lastFeedback.kind === 'rejected' ? 14000 : 9000);
    return () => window.clearTimeout(id);
  }, [lastFeedback, clearFeedback]);
  if (!lastFeedback) return null;
  return (
    <div data-testid="feedback-toast" role={lastFeedback.kind === 'rejected' ? 'alert' : 'status'} className={`absolute ${className} left-1/2 z-20 w-[min(34rem,92%)] -translate-x-1/2 rounded border p-3 shadow-xl backdrop-blur ${STYLE[lastFeedback.kind]}`}>
      <div className="flex items-start gap-2 text-xs">
        <span aria-hidden className="mt-0.5 font-bold">{ICON[lastFeedback.kind]}</span>
        <div className="flex-1">
          <div className="font-semibold">{lastFeedback.title}</div>
          <p className="mt-0.5 whitespace-pre-line leading-snug opacity-95">{lastFeedback.body}</p>
        </div>
        <button type="button" onClick={clearFeedback} aria-label="Dismiss message" className="opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
};
