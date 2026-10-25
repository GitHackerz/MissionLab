'use client';

import React from 'react';
import { Crosshair, Home } from 'lucide-react';
import { ModuleId } from '@/simulation/types';
import { LEGEND_STATUSES, STATUS_VISUALS } from '../constants/statusVisuals';

interface ViewportOverlayProps {
  stormActive: boolean;
  selectedModuleId: ModuleId | null;
  serviceActive?: boolean;
  onExitService?: () => void;
  onOverview: () => void;
  onFocusSelected: () => void;
}

/** DOM controls over the canvas: view buttons, status key and storm badge. No gameplay controls here. */
export const ViewportOverlay: React.FC<ViewportOverlayProps> = ({
  stormActive,
  selectedModuleId,
  onOverview,
  onFocusSelected,
  serviceActive,
}) => (
  <>
    <div className="pointer-events-none absolute left-3 top-3 hidden select-none items-center gap-2 rounded border border-mars-border bg-black/60 px-3 py-1.5 text-xs text-stone-300 backdrop-blur-md sm:flex">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />
      <span>{serviceActive ? 'Service view: click equipment, tools and parts. Drag to orbit, scroll to zoom.' : 'Drag: orbit · Scroll: zoom · Right-drag: pan · Double-click: focus'}</span>
    </div>

    <div
      role="status"
      aria-live="polite"
      className={`absolute right-3 top-3 flex items-center gap-2 rounded border px-3 py-1.5 text-xs ${
        stormActive ? 'border-red-500/50 bg-red-950/80 text-red-200' : 'border-mars-border bg-black/60 text-stone-300'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${stormActive ? 'animate-pulse bg-red-500' : 'bg-emerald-500'}`} />
      <span className="font-semibold uppercase tracking-wider">{stormActive ? 'Dust storm active' : 'Sky clear'}</span>
    </div>

    <ul
      aria-label="Status key"
      className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded border border-mars-border bg-black/60 px-3 py-1.5 text-[11px] text-stone-300 backdrop-blur-md"
    >
      {LEGEND_STATUSES.map((status) => {
        const v = STATUS_VISUALS[status];
        return (
          <li key={status} className="flex items-center gap-1">
            <span aria-hidden style={{ color: v.color }}>
              {v.glyph}
            </span>
            {v.label}
          </li>
        );
      })}
    </ul>

    <div className="absolute bottom-3 right-3 flex gap-2">
      <button
        type="button"
        onClick={onFocusSelected}
        disabled={!selectedModuleId}
        aria-label="Focus camera on selected module"
        className="flex items-center gap-1.5 rounded border border-mars-border bg-black/60 px-2.5 py-1.5 text-xs text-stone-200 backdrop-blur-md transition-colors hover:border-mars-dust disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Crosshair className="h-3.5 w-3.5" aria-hidden />
        Focus
      </button>
      <button
        type="button"
        onClick={onOverview}
        aria-label="Reset camera to colony overview"
        className="flex items-center gap-1.5 rounded border border-mars-border bg-black/60 px-2.5 py-1.5 text-xs text-stone-200 backdrop-blur-md transition-colors hover:border-mars-dust"
      >
        <Home className="h-3.5 w-3.5" aria-hidden />
        Overview
      </button>
    </div>
  </>
);

