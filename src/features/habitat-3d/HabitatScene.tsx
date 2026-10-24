'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { HabitatSceneProps, ModuleId } from '@/simulation/types';
import { ModuleMesh } from './components/ModuleMesh';
import { MarsEnvironment } from './components/MarsEnvironment';

const MODULE_POSITIONS: Record<ModuleId, [number, number, number]> = {
  'crew-habitat': [0, 0, 0],
  'life-support': [-3.2, 0, 1.2],
  'water-recycler': [-2.8, 0, -2.4],
  'greenhouse': [3.5, 0, 1.8],
  'research-lab': [3.2, 0, -2.0],
  'battery-bank': [0, 0, 3.8],
  'solar-array': [0, 0, -5.0],
};

export const HabitatScene: React.FC<HabitatSceneProps> = ({
  missionState,
  selectedModuleId,
  onSelectModule,
  className = 'w-full h-full min-h-[480px]',
}) => {
  return (
    <div className={`relative bg-[#190b07] overflow-hidden ${className}`}>
      {/* 3D Canvas Viewport */}
      <Canvas
        shadows
        camera={{ position: [10, 11, 14], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        onPointerMissed={() => onSelectModule(selectedModuleId as ModuleId)}
      >
        <Suspense fallback={null}>
          <MarsEnvironment stormActive={missionState.stormActive} />

          {/* Habitat Subsystem Modules */}
          {Object.values(missionState.modules).map((mod) => (
            <ModuleMesh
              key={mod.id}
              module={mod}
              position={MODULE_POSITIONS[mod.id] || [0, 0, 0]}
              isSelected={selectedModuleId === mod.id}
              onSelect={onSelectModule}
            />
          ))}

          {/* Smooth Orbit & Inspection Camera Controls */}
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            minDistance={5}
            maxDistance={35}
            maxPolarAngle={Math.PI / 2.05} // Prevent camera clipping beneath terrain
            target={[0, 0.5, 0]}
          />
        </Suspense>
      </Canvas>

      {/* Viewport Overlay Controls & Compass */}
      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-mars-border px-3 py-1.5 rounded text-xs text-stone-300 flex items-center space-x-2 pointer-events-none select-none">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>3D MARS HABITAT (ORBIT: LEFT CLICK | ZOOM: SCROLL | PAN: RIGHT CLICK)</span>
      </div>

      {missionState.stormActive && (
        <div className="absolute top-3 right-3 bg-red-950/80 border border-red-500/50 px-3 py-1.5 rounded text-xs text-red-200 flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="font-semibold uppercase tracking-wider">Dust Storm Active (Solar: 4.0 kW)</span>
        </div>
      )}
    </div>
  );
};

export default HabitatScene;
