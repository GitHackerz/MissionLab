'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useModuleAnimation } from '../hooks/useModuleAnimation';
import { useMaterials } from '../components/HabitatMaterials';
import { ModuleShell } from '../components/ModuleShell';
import { NO_BATCH } from '../components/BatchedStatic';
import { InstancedParts, PartTransform } from '../components/InstancedParts';
import { HabitatModuleProps } from './types';

const SCRUBBER_X = [-0.46, 0.46];

export const LifeSupport: React.FC<HabitatModuleProps> = (props) => {
  const { module, reducedMotion } = props;
  const m = useMaterials();
  const { anim, interior, statusLed } = useModuleAnimation(module, reducedMotion);
  const fan = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (fan.current) fan.current.rotation.y += delta * 12 * anim.current.motion;
  });

  const bodyRings = useMemo<PartTransform[]>(
    () => [-0.8, -0.4, 0, 0.4, 0.8].map((z) => ({ p: [0, 0.78, z - 0.1], r: [0, 0, 0] })),
    [],
  );
  const scrubberBands = useMemo<PartTransform[]>(
    () => SCRUBBER_X.flatMap((x) => [0.35, 0.7, 1.05, 1.4].map((y) => ({ p: [x, y, 1.0] as [number, number, number] }))),
    [],
  );

  return (
    <ModuleShell {...props} anim={anim}>
      <mesh position={[0, 0.06, 0]} receiveShadow material={m.slab}>
        <boxGeometry args={[2.0, 0.12, 2.4]} />
      </mesh>

      {/* Pressurised industrial module: horizontal hull with domed end caps */}
      <mesh position={[0, 0.78, -0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow material={m.hull}>
        <cylinderGeometry args={[0.56, 0.56, 1.7, 28]} />
      </mesh>
      <mesh position={[0, 0.78, -0.95]} rotation={[-Math.PI / 2, 0, 0]} castShadow material={m.hull}>
        <sphereGeometry args={[0.56, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, 0.78, 0.75]} rotation={[Math.PI / 2, 0, 0]} castShadow material={m.hull}>
        <sphereGeometry args={[0.56, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <InstancedParts transforms={bodyRings} material={m.trim}>
        <torusGeometry args={[0.575, 0.03, 6, 28]} />
      </InstancedParts>
      {[-0.55, 0.35].map((z) => (
        <mesh key={z} position={[0, 1.2, z]} castShadow material={m.trim}>
          <boxGeometry args={[0.36, 0.1, 0.2]} />
        </mesh>
      ))}
      {/* Cradle supports */}
      {[-0.7, 0.5].map((z) => (
        <mesh key={z} position={[0, 0.2, z]} receiveShadow material={m.darkSteel}>
          <boxGeometry args={[0.9, 0.2, 0.18]} />
        </mesh>
      ))}
      {/* Inspection port (lit by status) */}
      <mesh position={[0.5, 0.95, -0.35]} rotation={[0, Math.PI / 2, 0]} material={interior}>
        <circleGeometry args={[0.1, 14]} />
      </mesh>
      <mesh position={[-0.5, 0.95, -0.35]} rotation={[0, -Math.PI / 2, 0]} material={interior}>
        <circleGeometry args={[0.1, 14]} />
      </mesh>

      {/* Twin atmospheric scrubbers */}
      {SCRUBBER_X.map((x) => (
        <group key={x} position={[x, 0, 1.0]}>
          <mesh position={[0, 0.78, 0]} castShadow receiveShadow material={m.metal}>
            <cylinderGeometry args={[0.32, 0.32, 1.5, 24]} />
          </mesh>
          <mesh position={[0, 1.55, 0]} castShadow material={m.metal}>
            <sphereGeometry args={[0.32, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, 0.9, 0]} material={interior}>
            <cylinderGeometry args={[0.325, 0.325, 0.07, 24]} />
          </mesh>
        </group>
      ))}
      <InstancedParts transforms={scrubberBands} material={m.trim}>
        <torusGeometry args={[0.335, 0.025, 6, 24]} />
      </InstancedParts>

      {/* Cooling manifold joining the scrubber heads */}
      <mesh position={[0, 1.88, 1.0]} rotation={[0, 0, Math.PI / 2]} castShadow material={m.waterPipe}>
        <cylinderGeometry args={[0.06, 0.06, 0.92, 10]} />
      </mesh>
      {SCRUBBER_X.map((x) => (
        <mesh key={x} position={[x, 1.72, 1.0]} castShadow material={m.waterPipe}>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 8]} />
        </mesh>
      ))}
      {/* Circulation fan stack */}
      <mesh position={[0, 1.99, 1.0]} material={m.darkSteel}>
        <cylinderGeometry args={[0.2, 0.22, 0.12, 16]} />
      </mesh>
      <group ref={fan} position={[0, 2.06, 1.0]} userData={NO_BATCH}>
        {[0, Math.PI / 3, (2 * Math.PI) / 3].map((r) => (
          <mesh key={r} rotation={[0, r, 0]} material={m.metal}>
            <boxGeometry args={[0.38, 0.015, 0.07]} />
          </mesh>
        ))}
      </group>

      {/* Exterior service equipment */}
      <group position={[-0.78, 0, -0.55]}>
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow material={m.darkSteel}>
          <boxGeometry args={[0.55, 0.5, 0.7]} />
        </mesh>
        <mesh position={[0, 0.56, 0]} material={m.hazard}>
          <boxGeometry args={[0.57, 0.04, 0.72]} />
        </mesh>
        <mesh position={[-0.285, 0.34, 0]} material={statusLed}>
          <boxGeometry args={[0.02, 0.07, 0.3]} />
        </mesh>
      </group>
      <mesh position={[-0.46, 0.7, 0.95]} rotation={[0, 0, 0]} castShadow material={m.pipe}>
        <cylinderGeometry args={[0.045, 0.045, 1.4, 8]} />
      </mesh>
      <mesh position={[-0.5, 0.35, 0.2]} rotation={[Math.PI / 2, 0, 0]} material={m.pipe}>
        <cylinderGeometry args={[0.045, 0.045, 1.5, 8]} />
      </mesh>
    </ModuleShell>
  );
};
