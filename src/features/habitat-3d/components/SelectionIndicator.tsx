'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useFrame } from '@react-three/fiber';

interface SelectionIndicatorProps {
  /** Half extents of the footprint on X and Z. */
  radiusX: number;
  radiusZ: number;
  variant: 'selected' | 'hover';
  reducedMotion: boolean;
}

const SEGMENTS = 12;

function createDashedRing(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const step = (Math.PI * 2) / SEGMENTS;
  for (let i = 0; i < SEGMENTS; i++) {
    parts.push(new THREE.RingGeometry(0.955, 1, 8, 1, i * step, step * 0.6));
  }
  const merged = mergeGeometries(parts) ?? new THREE.RingGeometry(0.955, 1, 48);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** Ground ring at a module's base: rotating dashes when selected, faint solid ring on hover. */
export const SelectionIndicator: React.FC<SelectionIndicatorProps> = ({
  radiusX,
  radiusZ,
  variant,
  reducedMotion,
}) => {
  const spinner = useRef<THREE.Mesh>(null);
  const dashed = useMemo(createDashedRing, []);
  const solid = useMemo(() => new THREE.RingGeometry(0.97, 1, 64), []);
  useEffect(
    () => () => {
      dashed.dispose();
      solid.dispose();
    },
    [dashed, solid],
  );

  useFrame((_, delta) => {
    if (variant === 'selected' && spinner.current && !reducedMotion) {
      spinner.current.rotation.z += Math.min(delta, 0.1) * 0.5;
    }
  });

  const selected = variant === 'selected';
  return (
    <group position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[radiusX, radiusZ, 1]}>
      <mesh ref={spinner} geometry={selected ? dashed : solid} renderOrder={2}>
        <meshBasicMaterial
          color={selected ? '#38bdf8' : '#7dd3fc'}
          transparent
          opacity={selected ? 0.95 : 0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {selected && (
        <mesh geometry={solid} scale={1.0} renderOrder={2}>
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
};
