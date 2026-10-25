'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { MissionState } from '@/simulation/types';
import { ROOM_LIST } from './layout';
import { getRoomPower } from './power';

/** Only easing is animated. Targets always come from the engine's allocation. */
export function RoomLighting({ mission, reducedMotion }: { mission: MissionState; reducedMotion: boolean }) {
  const lights = useRef<Record<string, THREE.PointLight | null>>({});
  const fixtures = useRef<Record<string, THREE.MeshStandardMaterial | null>>({});
  useFrame((_, delta) => {
    const k = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, .1) * 8);
    for (const [id] of ROOM_LIST) {
      const state = getRoomPower(mission, id);
      for (const [kind, level] of [['main', state.main], ['safety', state.safety]] as const) {
        const key = `${id}-${kind}`;
        const light = lights.current[key], material = fixtures.current[key];
        const target = level * (kind === 'main' ? 34 : 7.5);
        if (light) light.intensity += (target - light.intensity) * k;
        if (material) material.emissiveIntensity += (level * (kind === 'main' ? 1.5 : .8) - material.emissiveIntensity) * k;
      }
    }
  });
  return <group name="allocated-room-lighting">
    {ROOM_LIST.map(([id, r]) => {
      const x = (r.minX + r.maxX) / 2, z = (r.minZ + r.maxZ) / 2;
      const power = getRoomPower(mission, id);
      return <group key={id} name={`circuit-${id}`} userData={{ lightingMode: power.mode, circuit: power.circuit, main: power.main, safety: power.safety }}>
        <pointLight ref={el => { lights.current[`${id}-main`] = el; }} name={`main-light-${id}`} position={[x, 2.7, z]} intensity={34 * power.main} distance={6.8} decay={1.6} color={id === 'greenhouse' ? '#e4f5bf' : '#d4e7ee'} />
        <pointLight ref={el => { lights.current[`${id}-safety`] = el; }} name={`safety-light-${id}`} position={[x, 1.8, z]} intensity={7.5 * power.safety} distance={5.2} decay={1.5} color="#efaa69" />
        <mesh position={[x, 1.35, r.minZ + .12]}>
          <boxGeometry args={[Math.min(3, r.maxX - r.minX - .5), .07, .08]} />
          <meshStandardMaterial ref={el => { fixtures.current[`${id}-main`] = el; }} color="#26363c" emissive="#d4e7ee" emissiveIntensity={1.5 * power.main} />
        </mesh>
        <mesh position={[r.minX + .3, .75, r.minZ + .13]}>
          <boxGeometry args={[.16, .2, .05]} />
          <meshStandardMaterial ref={el => { fixtures.current[`${id}-safety`] = el; }} color="#362b22" emissive="#efaa69" emissiveIntensity={.8 * power.safety} />
        </mesh>
      </group>;
    })}
    {/* Low natural fill survives an outage. Passive floor markings stay legible. */}
    <directionalLight position={[-8, 18, 7]} color="#d0a286" intensity={mission.stormActive ? .18 : .65} />
    <hemisphereLight args={['#8faaaa', '#261c18', mission.stormActive ? .2 : .35]} />
  </group>;
}
