'use client';

import React from 'react';
import { Html } from '@react-three/drei';
import { ModuleState } from '@/simulation/types';
import { resolveStatusVisual } from '../utils/visualState';

interface ModuleLabelProps {
  module: ModuleState;
  shortName: string;
  height: number;
  /** Kept mounted but invisible (unmounting drei Html mid-render can throw in React 19). */
  hidden?: boolean;
}

/** Only shown for the hovered/selected module, and always states status in text as well as colour. */
export const ModuleLabel: React.FC<ModuleLabelProps> = ({ module, shortName, height, hidden = false }) => {
  const visual = resolveStatusVisual(module.status);
  return (
    <Html position={[0, height + 0.55, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div style={hidden ? { display: 'none' } : undefined} className="flex items-center gap-2 whitespace-nowrap rounded border border-white/10 bg-black/75 px-2.5 py-1 text-[13px] font-medium text-stone-100 shadow-lg backdrop-blur-sm">
        <span aria-hidden style={{ color: visual.color }}>
          {visual.glyph}
        </span>
        <span>{shortName}</span>
        <span className="text-xs uppercase tracking-wider" style={{ color: visual.color }}>
          {visual.label}
        </span>
      </div>
    </Html>
  );
};
