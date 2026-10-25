'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { ModuleState } from '@/simulation/types';
import { useModuleAnimation } from '@/features/habitat-3d/hooks/useModuleAnimation';

export function AirUnit({ module, reducedMotion }: { module: ModuleState; reducedMotion: boolean }) {
  const { anim, interior } = useModuleAnimation(module, reducedMotion);
  const rotor = useRef<Group>(null);
  useFrame(() => { if (rotor.current) rotor.current.rotation.z = anim.current.phase * 6; });
  return <group position={[-4.95, 1.2, -2.12]} name="air-revitalization-fan">
    <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.25, .25, .13, 20]} /><meshStandardMaterial color="#172b35" metalness={.5} roughness={.5} /></mesh>
    <group ref={rotor} position={[0, 0, .085]}>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(angle => <mesh key={angle} rotation={[0, 0, angle]} position={[0, 0, .01]}><boxGeometry args={[.38, .065, .03]} /><meshStandardMaterial color="#b0c3c7" metalness={.5} roughness={.5} /></mesh>)}
    </group>
    <mesh position={[0, -.4, .02]} material={interior}><boxGeometry args={[.38, .08, .03]} /></mesh>
  </group>;
}
