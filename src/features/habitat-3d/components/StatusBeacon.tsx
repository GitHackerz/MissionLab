'use client';

import React, { MutableRefObject, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ModuleAnimation } from '../hooks/useModuleAnimation';
import { resolveStatusVisual } from '../utils/visualState';
import { BeaconShape } from '../constants/statusVisuals';

interface StatusBeaconProps {
  status: string;
  anim: MutableRefObject<ModuleAnimation>;
  height: number;
  selected: boolean;
}

function BeaconGeometry({ shape }: { shape: BeaconShape }) {
  switch (shape) {
    case 'cone':
      return <coneGeometry args={[0.2, 0.34, 3]} />;
    case 'octahedron':
      return <octahedronGeometry args={[0.2, 0]} />;
    case 'box':
      return <boxGeometry args={[0.26, 0.26, 0.26]} />;
    case 'torus':
      return <torusGeometry args={[0.19, 0.055, 8, 20]} />;
    default:
      return <sphereGeometry args={[0.17, 14, 12]} />;
  }
}

/**
 * Status beacon on a mast. The shape changes with status (circle, triangle,
 * diamond, square, ring) so colour is never the only cue (docs/07 §3, a11y).
 */
export const StatusBeacon: React.FC<StatusBeaconProps> = ({ status, anim, height, selected }) => {
  const visual = resolveStatusVisual(status);
  const body = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color(), []);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const haloMaterial = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((_, delta) => {
    const s = anim.current;
    const base = selected ? 1.25 : 1;
    const breathe = 0.85 + 0.25 * s.pulse;
    if (body.current) {
      const scale = base * breathe;
      body.current.scale.setScalar(scale);
      if (visual.shape === 'torus') body.current.rotation.z += delta * 2.5 * Math.max(s.motion, 0.4);
      else if (visual.shape === 'octahedron' || visual.shape === 'cone') body.current.rotation.y += delta * 0.8 * s.motion;
    }
    if (halo.current) halo.current.scale.setScalar(base * (1.2 + 0.5 * s.pulse));
    if (material.current) {
      color.set(visual.color);
      material.current.color.lerp(color, 0.2);
    }
    if (haloMaterial.current) {
      haloMaterial.current.color.set(visual.color);
      haloMaterial.current.opacity = 0.1 + 0.12 * s.pulse;
    }
  });

  return (
    <group position={[0, height, 0]}>
      <mesh position={[0, -height / 2 + 0.05, 0]}>
        <cylinderGeometry args={[0.02, 0.02, height - 0.2, 6]} />
        <meshStandardMaterial color="#5a5f66" metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh ref={body} position={[0, 0.05, 0]}>
        <BeaconGeometry shape={visual.shape} />
        <meshBasicMaterial ref={material} color={visual.color} toneMapped={false} />
      </mesh>
      <mesh ref={halo} position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshBasicMaterial
          ref={haloMaterial}
          color={visual.color}
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};
