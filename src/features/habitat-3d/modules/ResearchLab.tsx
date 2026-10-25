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

const HUB_R = 1.0;
const FACE = HUB_R * Math.cos(Math.PI / 6);

export const ResearchLab: React.FC<HabitatModuleProps> = (props) => {
  const { module, reducedMotion } = props;
  const m = useMaterials();
  const { anim, interior, statusLed } = useModuleAnimation(module, reducedMotion);
  const dish = useRef<THREE.Group>(null);
  const cups = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const motion = anim.current.motion;
    if (dish.current) dish.current.rotation.y += delta * 0.35 * motion;
    if (cups.current) cups.current.rotation.y += delta * 6 * motion;
  });

  const windows = useMemo<PartTransform[]>(
    () =>
      Array.from({ length: 6 }, (_, k) => {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        return { p: [Math.sin(a) * (FACE + 0.01), 0.62, Math.cos(a) * (FACE + 0.01)], r: [0, a, 0] };
      }),
    [],
  );

  return (
    <ModuleShell {...props} anim={anim}>
      {/* Hexagonal science hub */}
      <mesh position={[0, 0.06, 0]} receiveShadow material={m.slab}>
        <cylinderGeometry args={[1.25, 1.3, 0.12, 6]} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow material={m.hull}>
        <cylinderGeometry args={[HUB_R, HUB_R, 1.0, 6]} />
      </mesh>
      <mesh position={[0, 1.27, 0]} castShadow material={m.trim}>
        <cylinderGeometry args={[0.42, HUB_R * 1.04, 0.3, 6]} />
      </mesh>
      <InstancedParts transforms={windows} material={interior}>
        <boxGeometry args={[0.5, 0.3, 0.05]} />
      </InstancedParts>
      <mesh position={[0, 0.16, 0]} material={m.darkSteel}>
        <cylinderGeometry args={[HUB_R * 1.03, HUB_R * 1.03, 0.1, 6]} />
      </mesh>

      {/* Spectrometer mast with measurement boom */}
      <mesh position={[0.3, 2.0, 0.1]} castShadow material={m.metal}>
        <cylinderGeometry args={[0.035, 0.06, 1.4, 8]} />
      </mesh>
      <mesh position={[0.3, 2.78, 0.1]} castShadow material={m.darkSteel}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
      </mesh>
      <mesh position={[0.3, 2.9, 0.1]} material={statusLed}>
        <boxGeometry args={[0.06, 0.04, 0.06]} />
      </mesh>
      <mesh position={[0.3, 2.45, 0.1]} rotation={[0, 0, Math.PI / 2]} material={m.metal}>
        <cylinderGeometry args={[0.015, 0.015, 0.8, 6]} />
      </mesh>
      <group ref={cups} position={[0.7, 2.5, 0.1]} userData={NO_BATCH}>
        {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => (
          <mesh key={a} position={[Math.sin(a) * 0.1, 0, Math.cos(a) * 0.1]} material={m.hull}>
            <sphereGeometry args={[0.04, 8, 6]} />
          </mesh>
        ))}
      </group>

      {/* Communications dish */}
      <mesh position={[-0.4, 1.75, -0.35]} castShadow material={m.metal}>
        <cylinderGeometry args={[0.03, 0.04, 0.8, 8]} />
      </mesh>
      <group ref={dish} position={[-0.4, 2.2, -0.35]} userData={NO_BATCH}>
        <mesh rotation={[-0.9, 0, 0]} castShadow material={m.hull}>
          <sphereGeometry args={[0.42, 24, 8, 0, Math.PI * 2, 0, 0.62]} />
        </mesh>
        <mesh position={[0, 0.2, 0.28]} rotation={[0.4, 0, 0]} material={m.darkSteel}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
        </mesh>
      </group>

      {/* Sample transfer chamber */}
      <group position={[1.25, 0, 0.2]}>
        <mesh position={[0, 0.35, 0]} castShadow receiveShadow material={m.hull}>
          <boxGeometry args={[0.55, 0.6, 0.6]} />
        </mesh>
        <mesh position={[0.28, 0.4, 0]} material={m.windowDark}>
          <boxGeometry args={[0.02, 0.3, 0.4]} />
        </mesh>
      </group>

      {/* Ground instruments: seismometer dome and sensor tripod */}
      <mesh position={[-1.35, 0.1, 0.7]} castShadow material={m.metal}>
        <sphereGeometry args={[0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {[0, 2.1, 4.2].map((a) => (
        <mesh
          key={a}
          position={[0.9 + Math.sin(a) * 0.12, 0.28, -1.0 + Math.cos(a) * 0.12]}
          rotation={[Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3]}
          material={m.darkSteel}
        >
          <cylinderGeometry args={[0.012, 0.012, 0.6, 5]} />
        </mesh>
      ))}
      <mesh position={[0.9, 0.62, -1.0]} castShadow material={m.hull}>
        <boxGeometry args={[0.2, 0.12, 0.2]} />
      </mesh>
    </ModuleShell>
  );
};
