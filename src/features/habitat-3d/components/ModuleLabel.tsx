'use client';

import React from 'react';
import { ModuleState } from '@/simulation/types';
import { resolveStatusVisual } from '../utils/visualState';
import { SpriteLabel } from './SpriteLabel';

interface ModuleLabelProps {
  module: ModuleState;
  shortName: string;
  height: number;
  /** Kept mounted but invisible while an equipment service view is open. */
  hidden?: boolean;
}

/** Only shown for the hovered/selected module, and always states status in text as well as colour. */
export const ModuleLabel: React.FC<ModuleLabelProps> = ({ module, shortName, height, hidden = false }) => {
  const visual = resolveStatusVisual(module.status);
  return <SpriteLabel position={[0, height + 0.7, 0]} text={shortName} glyph={visual.glyph} suffix={visual.label} suffixColor={visual.color} visible={!hidden} />;
};
