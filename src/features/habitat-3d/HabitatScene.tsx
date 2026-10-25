'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { HabitatSceneProps, ModuleId } from '@/simulation/types';
import { ColonyLayout } from './components/ColonyLayout';
import { MarsEnvironment, SceneQuality } from './components/MarsEnvironment';
import { CameraController, CameraRequest } from './components/CameraController';
import { HabitatMaterialsProvider } from './components/HabitatMaterials';
import { SceneErrorBoundary, SceneFallback } from './components/SceneFallback';
import { ViewportOverlay } from './components/ViewportOverlay';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useStormIntensity } from './hooks/useStormIntensity';
import { CAMERA } from './constants/layout';
import { isModuleId, stormTarget } from './utils/visualState';
import { isWebGLAvailable } from './utils/webgl';

// Stable references. R3F re-applies `camera` *options* on every Canvas render, snapping a moved camera
// back to its initial pose, so the camera is passed as an instance, which it never touches.
function createSceneCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 400);
  camera.position.set(...CAMERA.overviewOffset);
  return camera;
}
const DPR_HIGH: [number, number] = [1, 1.75];
const DPR_LOW: [number, number] = [1, 1.25];
const GL_PROPS = { antialias: true, alpha: false, powerPreference: 'high-performance' as const };
const PERFORMANCE_PROPS = { min: 0.6 };

interface SceneContentsProps extends HabitatSceneProps {
  serviceActive: boolean;
  quality: SceneQuality;
  reducedMotion: boolean;
  cameraRequest: CameraRequest | null;
  onFocusModule: (id: ModuleId) => void;
}

/** Everything inside the Canvas. Reads canonical state; owns only transient render values. */
const SceneContents: React.FC<SceneContentsProps> = ({
  missionState,
  selectedModuleId,
  onSelectModule,
  quality,
  reducedMotion,
  cameraRequest,
  onFocusModule,
  serviceActive,
  selectedComponentId,
  onTrainingAction,
  onSelectComponent,
}) => {
  const stormRef = useStormIntensity(stormTarget(missionState), reducedMotion);

  const handleSelect = useCallback(
    (id: ModuleId) => {
      if (isModuleId(id)) onSelectModule(id);
    },
    [onSelectModule],
  );

  return (
    <HabitatMaterialsProvider stormRef={stormRef}>
      <MarsEnvironment stormRef={stormRef} quality={quality} reducedMotion={reducedMotion} />
      <ColonyLayout
        missionState={missionState}
        selectedModuleId={selectedModuleId}
        reducedMotion={reducedMotion}
        stormRef={stormRef}
        onSelectModule={handleSelect}
        onFocusModule={onFocusModule}
        serviceActive={serviceActive}
        selectedComponentId={selectedComponentId ?? null}
        onTrainingAction={onTrainingAction}
        onSelectComponent={onSelectComponent}
      />
      <CameraController selectedModuleId={selectedModuleId} serviceActive={serviceActive} request={cameraRequest} reducedMotion={reducedMotion} />
    </HabitatMaterialsProvider>
  );
};

export const HabitatScene: React.FC<HabitatSceneProps> = ({
  missionState,
  selectedModuleId,
  onSelectModule,
  className = 'w-full h-full min-h-[480px]',
  viewMode = 'colony',
  onViewModeChange,
  onTrainingAction,
  selectedComponentId,
  onSelectComponent,
}) => {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [ready, setReady] = useState(false);
  const [quality, setQuality] = useState<SceneQuality>('high');
  const [cameraRequest, setCameraRequest] = useState<CameraRequest | null>(null);
  const reducedMotion = useReducedMotion();
  const [sceneCamera] = useState(createSceneCamera);

  useEffect(() => {
    setWebgl(isWebGLAvailable());
  }, []);

  const requestFocus = useCallback((moduleId: ModuleId) => {
    setCameraRequest((prev) => ({ kind: 'focus', moduleId, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);
  const requestOverview = useCallback(() => {
    setCameraRequest((prev) => ({ kind: 'overview', nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  const serviceActive = viewMode === 'service' && Boolean(missionState.training);
  const previousView = useRef(viewMode);
  useEffect(() => {
    if (previousView.current !== viewMode) {
      setCameraRequest((prev) => ({ kind: viewMode === 'service' ? 'service' : 'overview', nonce: (prev?.nonce ?? 0) + 1 }) as CameraRequest);
    } else if (viewMode === 'service') {
      setCameraRequest((prev) => prev ?? ({ kind: 'service', nonce: 1 } as CameraRequest));
    }
    previousView.current = viewMode;
  }, [viewMode]);

  const fallback = (reason: string) => (
    <SceneFallback
      reason={reason}
      missionState={missionState}
      selectedModuleId={selectedModuleId}
      onSelectModule={onSelectModule}
    />
  );

  return (
    <div className={`relative overflow-hidden bg-[#190b07] ${className}`}>
      {webgl === false && fallback('WebGL is not available in this browser.')}

      {webgl && (
        <SceneErrorBoundary fallback={(error) => fallback(`The 3D scene failed to start (${error.message}).`)}>
          <Canvas
            shadows="percentage"
            dpr={quality === 'high' ? DPR_HIGH : DPR_LOW}
            camera={sceneCamera}
            gl={GL_PROPS}
            performance={PERFORMANCE_PROPS}
            onCreated={({ gl, scene, camera }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.05;
              const canvas = gl.domElement;
              canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                setContextLost(true);
              });
              canvas.addEventListener('webglcontextrestored', () => setContextLost(false));
              if (process.env.NODE_ENV !== 'production') {
                (window as unknown as Record<string, unknown>).__habitatDebug = { gl, scene, camera };
              }
              requestAnimationFrame(() => setReady(true));
            }}
          >
            <PerformanceMonitor onDecline={() => setQuality('low')} flipflops={3} />
            <AdaptiveDpr />
            <SceneContents
              missionState={missionState}
              selectedModuleId={selectedModuleId}
              onSelectModule={onSelectModule}
              quality={quality}
              reducedMotion={reducedMotion}
              cameraRequest={cameraRequest}
              onFocusModule={requestFocus}
              serviceActive={serviceActive}
              selectedComponentId={selectedComponentId}
              onTrainingAction={onTrainingAction}
              onSelectComponent={onSelectComponent}
            />
          </Canvas>
        </SceneErrorBoundary>
      )}

      {contextLost && fallback('The graphics context was lost; waiting for the browser to restore it.')}

      {webgl && (
        <ViewportOverlay
          stormActive={missionState.stormActive}
          selectedModuleId={selectedModuleId}
          serviceActive={serviceActive}
          onExitService={() => onViewModeChange?.('colony')}
          onOverview={() => {
            if (serviceActive) onViewModeChange?.('colony');
            else requestOverview();
          }}
          onFocusSelected={() => selectedModuleId && requestFocus(selectedModuleId)}
        />
      )}

      {(webgl === null || (webgl && !ready)) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#190b07] font-mono text-sm text-stone-400">
          <div className="flex flex-col items-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            <span>INITIALIZING 3D DIGITAL TWIN...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HabitatScene;
