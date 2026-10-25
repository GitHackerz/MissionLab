'use client';

import React, { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import type { MissionState, MissionAction } from '@/simulation/types';
import type { RecyclerComponentId } from '@/simulation/training/types';
import { HabitatMaterialsProvider } from '@/features/habitat-3d/components/HabitatMaterials';
import { SceneErrorBoundary } from '@/features/habitat-3d/components/SceneFallback';
import { useReducedMotion } from '@/features/habitat-3d/hooks/useReducedMotion';
import { actionForHotspot, nextHintKey, ServiceHotspot } from '@/features/habitat-3d/utils/serviceInteractions';
import { isWebGLAvailable } from '@/features/habitat-3d/utils/webgl';
import { InteriorAtmosphere } from './world/InteriorAtmosphere';
import { InteriorWorld } from './world/InteriorWorld';
import { Player, PlayerRef } from './character/Player';
import { ExploreCamera } from './ExploreCamera';
import { useExploreStore } from './store';
import type { GameKeys } from './input/useGameInput';
import { SPAWN } from './world/layout';

const GL_PROPS = { antialias: true, alpha: false, powerPreference: 'high-performance' as const };
const DPR: [number, number] = [1, 1.6];

interface Props {
  mission: MissionState;
  keys: MutableRefObject<GameKeys>;
  selectedComponent: RecyclerComponentId | null;
  onSelectComponent: (id: RecyclerComponentId) => void;
  onTrainingAction: (a: MissionAction) => void;
  onUnavailable: () => void;
  onReady?: () => void;
}

/** Interior habitat canvas. Only one WebGL canvas exists at a time: the colony canvas is unmounted while exploring. */
export const ExploreScene: React.FC<Props> = ({ mission, keys, selectedComponent, onSelectComponent, onTrainingAction, onUnavailable, onReady }) => {
  const reducedMotion = useReducedMotion();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [camera] = useState(() => new THREE.PerspectiveCamera(42, 1, 0.1, 120));
  const stormRef = useRef(0);
  const nearbyId = useExploreStore((s) => s.nearbyId);
  const activeTask = useExploreStore((s) => s.activeTaskId);
  const mode = useExploreStore((s) => s.mode);
  const player = useRef<PlayerRef>({ ...(useExploreStore.getState().lastPose ?? SPAWN) });

  useEffect(() => {
    const ok = isWebGLAvailable();
    setWebgl(ok);
    if (!ok) onUnavailable();
  }, [onUnavailable]);

  // Remember where the astronaut stood so returning to the habitat resumes in place.
  useEffect(
    () => () => {
      useExploreStore.getState().rememberPose({ ...player.current });
    },
    [],
  );

  const serviceActive = activeTask === 'water-recycler' && mode === 'task';
  const hintKey = useMemo(() => (serviceActive ? nextHintKey(mission) : null), [mission, serviceActive]);
  const onHotspot = useCallback(
    (h: ServiceHotspot) => {
      const t = mission.training;
      if (!t) return;
      const a = actionForHotspot(h, t);
      if (a.type === 'INSPECT_COMPONENT') onSelectComponent(a.componentId);
      if (a.type === 'TRAINING_STEP' && a.step.step === 'LOCATE_COMPONENT') onSelectComponent(a.step.slot);
      onTrainingAction(a);
    },
    [mission.training, onSelectComponent, onTrainingAction],
  );

  if (!webgl) return null;
  return (
    <SceneErrorBoundary fallback={() => <FailedScene onUnavailable={onUnavailable} />}>
      <Canvas
        camera={camera}
        dpr={DPR}
        gl={GL_PROPS}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          scene.background = new THREE.Color('#827367');
          scene.fog = new THREE.Fog('#827367', 28, 85);
          if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_MISSIONLAB_SCENE_DEBUG === '1') (window as unknown as Record<string, unknown>).__exploreDebug = { gl, scene, camera, player, keys };
          onReady?.();
        }}
      >
        <HabitatMaterialsProvider stormRef={stormRef}>
          <InteriorAtmosphere storm={mission.stormActive} stormRef={stormRef} reducedMotion={reducedMotion} />
          <InteriorWorld
            mission={mission}
            showMarkers={mode === 'exploration'}
            targetedId={nearbyId}
            reducedMotion={reducedMotion}
            stormRef={stormRef}
            serviceActive={serviceActive}
            selectedComponent={selectedComponent}
            hintKey={hintKey}
            onEmergencyAction={command=>onTrainingAction({type:'EMERGENCY_ACTION',command})}
            onHotspot={onHotspot}
          />
          <Player keys={keys} state={player} reducedMotion={reducedMotion} />
          <ExploreCamera player={player} reducedMotion={reducedMotion} />
        </HabitatMaterialsProvider>
      </Canvas>
    </SceneErrorBoundary>
  );
};

const FailedScene: React.FC<{ onUnavailable: () => void }> = ({ onUnavailable }) => {
  useEffect(() => onUnavailable(), [onUnavailable]);
  return null;
};
