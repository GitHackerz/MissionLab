'use client';
import { useMemo, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export function InteriorAtmosphere({ storm, stormRef, reducedMotion }: { storm: boolean; stormRef: MutableRefObject<number>; reducedMotion: boolean }) {
  const scene = useThree(s => s.scene);
  const clear = useMemo(() => new THREE.Color('#a17f69'), []);
  const dust = useMemo(() => new THREE.Color('#715346'), []);
  useFrame((_, delta) => {
    const k = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, .1) * 3);
    stormRef.current += ((storm ? 1 : 0) - stormRef.current) * k;
    const haze = stormRef.current;
    if (scene.background instanceof THREE.Color) scene.background.copy(clear).lerp(dust, haze);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(clear).lerp(dust, haze);
      scene.fog.near = 32 - haze * 20;
      scene.fog.far = 90 - haze * 45;
    }
  });
  return null;
}
