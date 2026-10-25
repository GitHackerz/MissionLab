'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useModuleAnimation } from '../hooks/useModuleAnimation';
import { useMaterials } from '../components/HabitatMaterials';
import { ModuleShell } from '../components/ModuleShell';
import { NO_BATCH } from '../components/BatchedStatic';
import { InstancedParts, PartTransform } from '../components/InstancedParts';
import { batteryChargeFraction, resolveStatusVisual } from '../utils/visualState';
import { HabitatModuleProps } from './types';

const UNITS = 4;
const SEGMENTS = 6;
const UNIT_X = [-1.35, -0.45, 0.45, 1.35];

/** Number of lit charge segments (of UNITS * SEGMENTS), from authoritative battery values only. */
export function litSegments(fraction: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  return f === 0 ? 0 : Math.max(1, Math.round(f * UNITS * SEGMENTS));
}

export const BatteryBank: React.FC<HabitatModuleProps> = (props) => {
  const { module, resources, reducedMotion } = props;
  const m = useMaterials();
  const { anim, statusLed } = useModuleAnimation(module, reducedMotion);
  const fans = useRef<THREE.Group>(null);

  const lit = module.status === 'offline' ? 0 : litSegments(batteryChargeFraction(resources));
  const visual = resolveStatusVisual(module.status);

  const segmentTransforms = useMemo<PartTransform[]>(() => {
    const out: PartTransform[] = [];
    for (let u = 0; u < UNITS; u++) {
      for (let s = 0; s < SEGMENTS; s++) {
        out.push({ p: [UNIT_X[u], 0.2 + s * 0.12, 0.575] });
      }
    }
    return out;
  }, []);
  const segmentColors = useMemo(() => {
    const on = new THREE.Color(visual.color);
    const off = new THREE.Color('#1c1512');
    return segmentTransforms.map((_, i) => (i < lit ? on : off));
  }, [segmentTransforms, lit, visual.color]);

  const segmentMaterial = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  useEffect(() => () => segmentMaterial.dispose(), [segmentMaterial]);

  useFrame((_, delta) => {
    if (fans.current) fans.current.rotation.y += delta * 14 * anim.current.motion;
  });

  const fanPositions = useMemo(() => UNIT_X.map((x) => [x, 1.06, 0] as [number, number, number]), []);

  return (
    <ModuleShell {...props} anim={anim}>
      <mesh position={[0, 0.06, 0]} receiveShadow material={m.slab}>
        <boxGeometry args={[4.0, 0.12, 1.6]} />
      </mesh>

      {/* Insulated battery enclosures */}
      {UNIT_X.map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.58, 0]} castShadow receiveShadow material={m.darkSteel}>
            <boxGeometry args={[0.8, 0.92, 1.1]} />
          </mesh>
          <mesh position={[0, 0.55, -0.02]} castShadow material={m.hull}>
            <boxGeometry args={[0.84, 0.5, 1.14]} />
          </mesh>
          <mesh position={[0, 1.0, 0]} material={m.trim}>
            <boxGeometry args={[0.86, 0.04, 1.16]} />
          </mesh>
          {/* Cooling louvres */}
          {[0.15, 0.3, 0.45, 0.6].map((y) => (
            <mesh key={y} position={[0, 0.5 + y * 0.6, -0.575]} material={m.rubber}>
              <boxGeometry args={[0.6, 0.025, 0.02]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Charge level strip: lit segments are driven by the authoritative battery fraction */}
      <InstancedParts transforms={segmentTransforms} material={segmentMaterial} colors={segmentColors}>
        <boxGeometry args={[0.55, 0.08, 0.02]} />
      </InstancedParts>
      {UNIT_X.map((x) => (
        <mesh key={x} position={[x, 0.2 + 0.6, 0.563]} material={m.windowDark}>
          <boxGeometry args={[0.62, 0.8, 0.012]} />
        </mesh>
      ))}

      {/* Roof cooling fans */}
      <group ref={fans} userData={NO_BATCH}>
        {fanPositions.map((p, i) => (
          <group key={i} position={p}>
            <mesh material={m.rubber}>
              <cylinderGeometry args={[0.2, 0.2, 0.06, 14]} />
            </mesh>
            <mesh position={[0, 0.04, 0]} material={m.metal}>
              <boxGeometry args={[0.34, 0.015, 0.06]} />
            </mesh>
            <mesh position={[0, 0.04, 0]} rotation={[0, Math.PI / 2, 0]} material={m.metal}>
              <boxGeometry args={[0.34, 0.015, 0.06]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Coolant manifold running behind the units */}
      <mesh position={[0, 0.9, -0.72]} rotation={[0, 0, Math.PI / 2]} castShadow material={m.pipe}>
        <cylinderGeometry args={[0.07, 0.07, 3.4, 10]} />
      </mesh>
      {UNIT_X.map((x) => (
        <mesh key={x} position={[x, 0.7, -0.68]} material={m.pipe}>
          <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
        </mesh>
      ))}

      {/* Switchgear and transformer at the power-bus end */}
      <group position={[2.3, 0, 0.2]}>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow material={m.hull}>
          <boxGeometry args={[0.55, 1.0, 0.7]} />
        </mesh>
        <mesh position={[0, 0.72, 0.36]} material={statusLed}>
          <boxGeometry args={[0.3, 0.06, 0.02]} />
        </mesh>
        <mesh position={[0, 0.4, 0.36]} material={m.windowDark}>
          <boxGeometry args={[0.32, 0.4, 0.02]} />
        </mesh>
        {[-0.18, 0, 0.18].map((x) => (
          <mesh key={x} position={[x, 1.1, -0.1]} material={m.darkSteel}>
            <cylinderGeometry args={[0.04, 0.05, 0.22, 8]} />
          </mesh>
        ))}
      </group>
    </ModuleShell>
  );
};
