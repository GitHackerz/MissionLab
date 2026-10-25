'use client';

import React from 'react';
import { MissionState, ModuleId } from '@/simulation/types';
import { MODULE_LAYOUT } from '../constants/layout';
import { getRenderableModules, resolveStatusVisual } from '../utils/visualState';

interface SceneFallbackProps {
  reason: string;
  missionState: MissionState;
  selectedModuleId: ModuleId | null;
  onSelectModule: (id: ModuleId) => void;
}

/** Shown when WebGL is unavailable or the scene crashes. Keeps module selection usable without 3D. */
export const SceneFallback: React.FC<SceneFallbackProps> = ({ reason, missionState, selectedModuleId, onSelectModule }) => (
  <div
    role="region"
    aria-label="Habitat modules (3D view unavailable)"
    className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#190b07] p-6 text-stone-300"
  >
    <div className="text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-orange-400">3D view unavailable</p>
      <p className="mt-1 max-w-md text-xs text-stone-400">{reason} Mission data and controls are unaffected.</p>
    </div>
    <ul className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
      {getRenderableModules(missionState).map((mod) => {
        const visual = resolveStatusVisual(mod.status);
        const active = selectedModuleId === mod.id;
        return (
          <li key={mod.id}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelectModule(mod.id)}
              className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm transition-colors ${
                active ? 'border-sky-400 bg-sky-950/40' : 'border-mars-border bg-black/30 hover:border-mars-dust'
              }`}
            >
              <span>{MODULE_LAYOUT[mod.id].shortName}</span>
              <span className="text-xs uppercase tracking-wider" style={{ color: visual.color }}>
                <span aria-hidden>{visual.glyph} </span>
                {visual.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  </div>
);

interface BoundaryProps {
  fallback: (error: Error) => React.ReactNode;
  children: React.ReactNode;
}

export class SceneErrorBoundary extends React.Component<BoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[HabitatScene] render failure', error);
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}
