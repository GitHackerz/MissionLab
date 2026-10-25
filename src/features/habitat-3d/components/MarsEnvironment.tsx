'use client';

import React, { MutableRefObject } from 'react';
import { MarsTerrain } from './MarsTerrain';
import { MarsSky } from './MarsSky';
import { SceneLighting } from './SceneLighting';
import { DustStormEffect } from './DustStormEffect';

export type SceneQuality = 'high' | 'low';

interface MarsEnvironmentProps {
  /** Eased 0..1 storm value derived from the canonical `stormActive` flag. */
  stormRef: MutableRefObject<number>;
  quality: SceneQuality;
  reducedMotion: boolean;
}

export const MarsEnvironment: React.FC<MarsEnvironmentProps> = ({ stormRef, quality, reducedMotion }) => (
  <>
    <SceneLighting stormRef={stormRef} shadowMapSize={quality === 'high' ? 2048 : 1024} />
    <MarsSky stormRef={stormRef} />
    <MarsTerrain quality={quality} />
    <DustStormEffect stormRef={stormRef} count={quality === 'high' ? 700 : 280} reducedMotion={reducedMotion} />
  </>
);
