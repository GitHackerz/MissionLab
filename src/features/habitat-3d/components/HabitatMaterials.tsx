'use client';

import React, { createContext, MutableRefObject, useContext, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/** Shared, reused materials: one consistent surface language across all modules. */
export interface HabitatMaterials {
  hull: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  pipe: THREE.MeshStandardMaterial;
  waterPipe: THREE.MeshStandardMaterial;
  cable: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  windowDark: THREE.MeshStandardMaterial;
  slab: THREE.MeshStandardMaterial;
  panelFrame: THREE.MeshStandardMaterial;
  hazard: THREE.MeshStandardMaterial;
}

function createMaterials(): HabitatMaterials {
  const std = (color: string, roughness: number, metalness: number) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return {
    hull: std('#ddd6cb', 0.55, 0.12),
    trim: std('#8b8782', 0.5, 0.45),
    metal: std('#9aa0a8', 0.38, 0.75),
    darkSteel: std('#3f444b', 0.5, 0.65),
    rubber: std('#1f1c1b', 0.92, 0.05),
    pipe: std('#6f8696', 0.35, 0.65),
    waterPipe: std('#3f7fa6', 0.3, 0.55),
    cable: std('#1b1614', 0.7, 0.2),
    glass: new THREE.MeshStandardMaterial({
      color: '#a9d9c9',
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
    windowDark: std('#12171c', 0.12, 0.9),
    slab: std('#6b4b3a', 0.95, 0.02),
    panelFrame: std('#a7aeb6', 0.4, 0.8),
    hazard: std('#c79a2b', 0.6, 0.2),
  };
}

const HULL_CLEAN = new THREE.Color('#ddd6cb');
const HULL_DUSTY = new THREE.Color('#b98b66');

const Ctx = createContext<HabitatMaterials | null>(null);

export const HabitatMaterialsProvider: React.FC<{
  stormRef: MutableRefObject<number>;
  children: React.ReactNode;
}> = ({ stormRef, children }) => {
  const materials = useMemo(createMaterials, []);

  useEffect(
    () => () => {
      Object.values(materials).forEach((m) => m.dispose());
    },
    [materials],
  );

  // Dust settles on exposed hull surfaces as the storm intensifies.
  useFrame(() => {
    materials.hull.color.lerpColors(HULL_CLEAN, HULL_DUSTY, stormRef.current * 0.45);
  });

  return <Ctx.Provider value={materials}>{children}</Ctx.Provider>;
};

export function useMaterials(): HabitatMaterials {
  const value = useContext(Ctx);
  if (!value) throw new Error('useMaterials must be used inside HabitatMaterialsProvider');
  return value;
}
