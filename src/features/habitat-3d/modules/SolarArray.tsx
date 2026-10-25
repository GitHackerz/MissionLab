'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useModuleAnimation } from '../hooks/useModuleAnimation';
import { useMaterials } from '../components/HabitatMaterials';
import { ModuleShell } from '../components/ModuleShell';
import { NO_BATCH } from '../components/BatchedStatic';
import { InstancedParts, PartTransform } from '../components/InstancedParts';
import { solarDustLevel } from '../utils/visualState';
import { HabitatModuleProps } from './types';

const PANEL_W = 1.12;
const PANEL_D = 1.75;
const TILT_ACTIVE = 0.52; // faces the sun at +Z / high elevation (see SceneLighting)
const TILT_STOWED = 0.1;
const CELL_CLEAN = new THREE.Color('#ffffff');
const CELL_DUSTY = new THREE.Color('#c9a27a');

function createCellTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1b2f5e';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#6f8fd0';
    ctx.lineWidth = 2;
    const cells = 4;
    for (let i = 0; i <= cells; i++) {
      const p = (i / cells) * size;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    ctx.strokeStyle = '#a7b9e6';
    ctx.lineWidth = 1;
    for (let i = 0; i < cells; i++) {
      const p = ((i + 0.5) / cells) * size;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  tex.anisotropy = 4;
  return tex;
}

export const SolarArray: React.FC<HabitatModuleProps> = (props) => {
  const { module, stormRef, reducedMotion } = props;
  const m = useMaterials();
  const { anim, statusLed } = useModuleAnimation(module, reducedMotion);
  const wing = useRef<THREE.Group>(null);
  const tilt = useRef(module.status === 'offline' ? TILT_STOWED : TILT_ACTIVE);

  const texture = useMemo(createCellTexture, []);
  const cellMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        color: '#ffffff',
        roughness: 0.22,
        metalness: 0.7,
        emissive: new THREE.Color('#1d4ed8'),
        emissiveIntensity: 0.18,
      }),
    [texture],
  );
  useEffect(
    () => () => {
      cellMaterial.dispose();
      texture.dispose();
    },
    [cellMaterial, texture],
  );

  const moduleRef = useRef(module);
  useEffect(() => {
    moduleRef.current = module;
  });

  useFrame((_, delta) => {
    const mod = moduleRef.current;
    const dust = solarDustLevel(mod, stormRef.current);
    cellMaterial.color.lerpColors(CELL_CLEAN, CELL_DUSTY, dust * 0.85);
    // Dull amber-grey under dust (docs/07 §4); inactive equipment loses its glow.
    cellMaterial.emissiveIntensity = 0.18 * (1 - dust) * (0.35 + 0.65 * anim.current.glow);
    cellMaterial.roughness = 0.22 + dust * 0.6;

    const goal = mod.status === 'offline' ? TILT_STOWED : TILT_ACTIVE;
    tilt.current += (goal - tilt.current) * (reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 1.5));
    if (wing.current) wing.current.rotation.x = tilt.current;
  });

  const panels = useMemo<PartTransform[]>(() => {
    const xs = [-2.8, -1.68, -0.56, 0.56, 1.68, 2.8];
    return xs.map((x) => ({ p: [x, 0, 0] }));
  }, []);
  const frames = useMemo<PartTransform[]>(
    () => panels.map((t) => ({ p: [t.p[0], -0.015, 0] })),
    [panels],
  );

  return (
    <ModuleShell {...props} anim={anim}>
      {/* Foundation and pedestals */}
      <mesh position={[0, 0.07, 0.1]} receiveShadow material={m.slab}>
        <boxGeometry args={[6.2, 0.14, 0.9]} />
      </mesh>
      {[-2.2, 0, 2.2].map((x) => (
        <mesh key={x} position={[x, 0.65, 0.1]} castShadow material={m.darkSteel}>
          <cylinderGeometry args={[0.09, 0.12, 1.1, 10]} />
        </mesh>
      ))}

      {/* Torque tube and tilting wing */}
      <group position={[0, 1.25, 0.1]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow material={m.metal}>
          <cylinderGeometry args={[0.07, 0.07, 6.5, 10]} />
        </mesh>
        <group ref={wing} rotation={[TILT_ACTIVE, 0, 0]} userData={NO_BATCH}>
          <group position={[0, 0.03, PANEL_D / 2]}>
            <InstancedParts transforms={frames} material={m.panelFrame} castShadow>
              <boxGeometry args={[PANEL_W + 0.08, 0.05, PANEL_D + 0.08]} />
            </InstancedParts>
            <InstancedParts transforms={panels} material={cellMaterial} castShadow receiveShadow>
              <boxGeometry args={[PANEL_W, 0.03, PANEL_D]} />
            </InstancedParts>
          </group>
        </group>
      </group>

      {/* Back bracing */}
      {[-2.2, 0, 2.2].map((x) => (
        <mesh key={x} position={[x, 0.62, -0.5]} rotation={[0.55, 0, 0]} castShadow material={m.darkSteel}>
          <boxGeometry args={[0.07, 1.3, 0.07]} />
        </mesh>
      ))}

      {/* Inverter cabinet: the power-area connection */}
      <group position={[1.0, 0, 1.0]}>
        <mesh position={[0, 0.4, 0]} castShadow receiveShadow material={m.hull}>
          <boxGeometry args={[0.7, 0.8, 0.45]} />
        </mesh>
        <mesh position={[0, 0.6, 0.235]} material={statusLed}>
          <boxGeometry args={[0.4, 0.07, 0.02]} />
        </mesh>
        <mesh position={[0, 0.35, 0.235]} material={m.windowDark}>
          <boxGeometry args={[0.4, 0.3, 0.02]} />
        </mesh>
      </group>
      <mesh position={[0.4, 0.18, 0.7]} rotation={[0, 0.9, Math.PI / 2]} material={m.cable}>
        <cylinderGeometry args={[0.035, 0.035, 1.2, 6]} />
      </mesh>
    </ModuleShell>
  );
};
