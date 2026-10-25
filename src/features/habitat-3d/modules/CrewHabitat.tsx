'use client';

import React, { useMemo } from 'react';
import { MODULE_LAYOUT, AIRLOCK_AZIMUTH } from '../constants/layout';
import { useModuleAnimation } from '../hooks/useModuleAnimation';
import { useMaterials } from '../components/HabitatMaterials';
import { ModuleShell } from '../components/ModuleShell';
import { InstancedParts, PartTransform } from '../components/InstancedParts';
import { HabitatModuleProps } from './types';

const DOME_R = 1.85;
const WALL_Y = 0.58;

/** Azimuths of the pressurised connectors, derived from the layout so they always face their modules. */
export const TUNNEL_TARGETS = ['research-lab', 'greenhouse', 'life-support'] as const;

export function azimuthTo(id: keyof typeof MODULE_LAYOUT): number {
  const [x, , z] = MODULE_LAYOUT[id].position;
  return Math.atan2(x, z);
}

export const CrewHabitat: React.FC<HabitatModuleProps> = (props) => {
  const { module, reducedMotion } = props;
  const m = useMaterials();
  const { anim, interior } = useModuleAnimation(module, reducedMotion);

  const windows = useMemo<PartTransform[]>(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + 0.31;
        return { p: [Math.sin(a) * (DOME_R + 0.01), WALL_Y, Math.cos(a) * (DOME_R + 0.01)], r: [0, a, 0] };
      }),
    [],
  );
  const ribs = useMemo<PartTransform[]>(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        p: [0, WALL_Y + 0.27, 0] as [number, number, number],
        r: [0, (i / 6) * Math.PI, 0] as [number, number, number],
      })),
    [],
  );

  return (
    <ModuleShell {...props} anim={anim}>
      {/* Foundation pad and drum wall */}
      <mesh position={[0, 0.14, 0]} receiveShadow castShadow material={m.slab}>
        <cylinderGeometry args={[2.1, 2.2, 0.28, 40]} />
      </mesh>
      <mesh position={[0, WALL_Y, 0]} castShadow receiveShadow material={m.hull}>
        <cylinderGeometry args={[DOME_R, DOME_R, 0.6, 40]} />
      </mesh>
      {/* Dome */}
      <mesh position={[0, WALL_Y + 0.3, 0]} scale={[1, 0.82, 1]} castShadow receiveShadow material={m.hull}>
        <sphereGeometry args={[DOME_R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, WALL_Y + 0.3, 0]} material={m.trim}>
        <torusGeometry args={[DOME_R + 0.02, 0.05, 8, 48]} />
      </mesh>
      {/* Structural ribs over the dome */}
      <InstancedParts transforms={ribs} material={m.trim}>
        <torusGeometry args={[DOME_R * 1.005, 0.025, 6, 40, Math.PI]} />
      </InstancedParts>
      {/* Lit windows around the drum */}
      <InstancedParts transforms={windows} material={interior}>
        <boxGeometry args={[0.42, 0.26, 0.06]} />
      </InstancedParts>

      {/* Observation cupola */}
      <mesh position={[-0.6, 1.6, 0.55]} material={interior}>
        <sphereGeometry args={[0.42, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[-0.6, 1.58, 0.55]} material={m.trim}>
        <torusGeometry args={[0.43, 0.04, 6, 24]} />
      </mesh>

      {/* Roof hatch and comms mast */}
      <mesh position={[0.55, 2.25, -0.2]} castShadow material={m.trim}>
        <cylinderGeometry args={[0.38, 0.42, 0.14, 16]} />
      </mesh>
      <mesh position={[0.55, 2.7, -0.2]} castShadow material={m.metal}>
        <cylinderGeometry args={[0.025, 0.035, 0.95, 8]} />
      </mesh>
      <mesh position={[0.55, 3.1, -0.2]} rotation={[0.5, 0.4, 0]} castShadow material={m.hull}>
        <sphereGeometry args={[0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      {/* Entry airlock */}
      <group rotation={[0, AIRLOCK_AZIMUTH, 0]}>
        <mesh position={[0, 0.8, 2.05]} castShadow receiveShadow material={m.hull}>
          <boxGeometry args={[1.15, 1.0, 0.95]} />
        </mesh>
        <mesh position={[0, 0.75, 2.54]} material={m.windowDark}>
          <boxGeometry args={[0.62, 0.82, 0.05]} />
        </mesh>
        <mesh position={[0, 1.0, 2.58]} material={interior}>
          <boxGeometry args={[0.34, 0.26, 0.03]} />
        </mesh>
        <mesh position={[0, 0.2, 2.6]} receiveShadow material={m.hazard}>
          <boxGeometry args={[0.95, 0.12, 0.3]} />
        </mesh>
        <mesh position={[0, 1.4, 2.4]} material={m.trim}>
          <boxGeometry args={[0.8, 0.06, 0.4]} />
        </mesh>
      </group>

      {/* Pressurised ports facing connected modules */}
      {TUNNEL_TARGETS.map((id) => (
        <group key={id} rotation={[0, azimuthTo(id), 0]}>
          <mesh position={[0, 0.7, DOME_R - 0.03]} rotation={[Math.PI / 2, 0, 0]} castShadow material={m.trim}>
            <cylinderGeometry args={[0.46, 0.46, 0.3, 20]} />
          </mesh>
        </group>
      ))}

      {/* Crew-support equipment: gas storage cradle on the shaded side */}
      <group position={[-0.1, 0, -2.75]}>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 0.42, 0]} rotation={[0, 0, Math.PI / 2]} castShadow material={m.metal}>
            <cylinderGeometry args={[0.3, 0.3, 1.1, 18]} />
          </mesh>
        ))}
        <mesh position={[0, 0.07, 0]} receiveShadow material={m.darkSteel}>
          <boxGeometry args={[2.0, 0.14, 0.9]} />
        </mesh>
        <mesh position={[0, 0.42, 0.34]} material={m.pipe}>
          <boxGeometry args={[1.5, 0.05, 0.05]} />
        </mesh>
      </group>
    </ModuleShell>
  );
};
