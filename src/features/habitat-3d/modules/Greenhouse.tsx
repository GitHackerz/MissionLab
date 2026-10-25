'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useModuleAnimation } from '../hooks/useModuleAnimation';
import { useMaterials } from '../components/HabitatMaterials';
import { ModuleShell } from '../components/ModuleShell';
import { InstancedParts, PartTransform } from '../components/InstancedParts';
import { mulberry32 } from '../utils/terrain';
import { HabitatModuleProps } from './types';

const LENGTH = 2.6;
const RADIUS = 0.78;
const BASE_Y = 0.34;
const PLANT_DRY = new THREE.Color('#5a4a30');
const PLANT_LUSH = new THREE.Color('#58a53a');

export const Greenhouse: React.FC<HabitatModuleProps> = (props) => {
  const { module, reducedMotion } = props;
  const m = useMaterials();
  const { anim, interior, statusLed } = useModuleAnimation(module, reducedMotion);

  const growLight = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#26301a',
        emissive: new THREE.Color('#d9f99d'),
        emissiveIntensity: 1,
      }),
    [],
  );
  const plantMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#58a53a', roughness: 0.8 }),
    [],
  );
  const soil = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a2a22', roughness: 1 }), []);
  useEffect(
    () => () => {
      growLight.dispose();
      plantMaterial.dispose();
      soil.dispose();
    },
    [growLight, plantMaterial, soil],
  );

  useFrame(() => {
    const g = anim.current.glow;
    // Reduced operating mode dims the grow lights; offline extinguishes them.
    growLight.emissiveIntensity = g * (0.9 + 0.3 * (reducedMotion ? 0.5 : anim.current.pulse));
    plantMaterial.color.lerpColors(PLANT_DRY, PLANT_LUSH, 0.25 + 0.75 * g);
  });

  const arches = useMemo<PartTransform[]>(
    () => Array.from({ length: 6 }, (_, i) => ({ p: [0, BASE_Y, -LENGTH / 2 + 0.1 + (i * (LENGTH - 0.2)) / 5] })),
    [],
  );
  const plants = useMemo(() => {
    const rand = mulberry32(42);
    const transforms: PartTransform[] = [];
    const colors: THREE.Color[] = [];
    for (const x of [-0.34, 0.34]) {
      for (let i = 0; i < 12; i++) {
        const s = 0.7 + rand() * 0.6;
        transforms.push({
          p: [x + (rand() - 0.5) * 0.12, BASE_Y + 0.28 + s * 0.08, -1.05 + i * 0.19 + (rand() - 0.5) * 0.05],
          r: [0, rand() * 6, 0],
          s: [s, s * (0.9 + rand() * 0.5), s],
        });
        colors.push(new THREE.Color().setHSL(0.27 + rand() * 0.05, 0.45 + rand() * 0.2, 0.75 + rand() * 0.3));
      }
    }
    return { transforms, colors };
  }, []);

  return (
    <ModuleShell {...props} anim={anim}>
      <mesh position={[0, 0.06, 0]} receiveShadow material={m.slab}>
        <boxGeometry args={[1.8, 0.12, LENGTH + 0.3]} />
      </mesh>
      {/* Low plinth walls */}
      {[-RADIUS, RADIUS].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]} castShadow receiveShadow material={m.hull}>
          <boxGeometry args={[0.05, 0.28, LENGTH]} />
        </mesh>
      ))}

      {/* Growing beds with crops */}
      {[-0.34, 0.34].map((x) => (
        <mesh key={x} position={[x, BASE_Y - 0.02, 0]} receiveShadow material={soil}>
          <boxGeometry args={[0.4, 0.3, LENGTH - 0.3]} />
        </mesh>
      ))}
      <InstancedParts transforms={plants.transforms} material={plantMaterial} colors={plants.colors}>
        <icosahedronGeometry args={[0.1, 0]} />
      </InstancedParts>

      {/* LED grow lights under the ridge */}
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.98, 0]} material={growLight}>
          <boxGeometry args={[0.07, 0.03, LENGTH - 0.4]} />
        </mesh>
      ))}
      <mesh position={[0, 1.08, 0]} material={m.trim}>
        <boxGeometry args={[0.05, 0.04, LENGTH - 0.1]} />
      </mesh>

      {/* Translucent barrel vault: a single transparent surface, depth-write off */}
      <mesh position={[0, BASE_Y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.glass} renderOrder={1}>
        <cylinderGeometry args={[RADIUS, RADIUS, LENGTH, 24, 1, true, Math.PI / 2, Math.PI]} />
      </mesh>
      <InstancedParts transforms={arches} material={m.panelFrame} castShadow>
        <torusGeometry args={[RADIUS, 0.028, 6, 24, Math.PI]} />
      </InstancedParts>
      <mesh position={[0, BASE_Y + RADIUS, 0]} material={m.panelFrame}>
        <boxGeometry args={[0.04, 0.04, LENGTH]} />
      </mesh>

      {/* End walls; the east end carries the status panel */}
      {[-LENGTH / 2, LENGTH / 2].map((z) => (
        <mesh key={z} position={[0, BASE_Y, z]} rotation={[0, z < 0 ? Math.PI : 0, 0]} castShadow material={m.hull}>
          <circleGeometry args={[RADIUS, 24, 0, Math.PI]} />
        </mesh>
      ))}
      <mesh position={[0, 0.45, LENGTH / 2 + 0.01]} material={interior}>
        <boxGeometry args={[0.3, 0.2, 0.02]} />
      </mesh>
      <mesh position={[0, 0.66, LENGTH / 2 + 0.01]} material={statusLed}>
        <boxGeometry args={[0.3, 0.05, 0.02]} />
      </mesh>

      {/* Entry vestibule toward the habitat tunnel */}
      <group position={[-0.95, 0, -0.3]}>
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow material={m.hull}>
          <boxGeometry args={[0.36, 0.7, 0.62]} />
        </mesh>
        <mesh position={[-0.19, 0.4, 0]} material={m.windowDark}>
          <boxGeometry args={[0.02, 0.42, 0.3]} />
        </mesh>
      </group>

      {/* Nutrient tank and feed line behind the structure */}
      <mesh position={[0.2, 0.3, -1.55]} castShadow receiveShadow material={m.hull}>
        <cylinderGeometry args={[0.24, 0.24, 0.55, 18]} />
      </mesh>
      <mesh position={[0.2, 0.62, -1.55]} material={m.trim}>
        <sphereGeometry args={[0.24, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0.2, 0.2, -1.38]} rotation={[Math.PI / 2, 0, 0]} material={m.waterPipe}>
        <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
      </mesh>
    </ModuleShell>
  );
};
