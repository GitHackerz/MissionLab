'use client';

import React, { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export type AstronautAnim = 'idle' | 'walk' | 'run' | 'interact';

export interface AstronautPose {
  anim: AstronautAnim;
  /** 0..1 fraction of top speed, drives limb swing amplitude/frequency. */
  speed: number;
  /** Signed turn rate (rad/s): leans the body into turns. */
  turn: number;
}

/**
 * Stylised procedural astronaut (no external model is bundled; see docs/17).
 * Animation is driven by a pose ref so walking never re-renders React.
 * Clips available: idle (breathing + arm sway), walk, run (faster, leaning),
 * interact (reaching pose), and a lean while turning.
 */
export const Astronaut: React.FC<{ pose: MutableRefObject<AstronautPose>; reducedMotion: boolean }> = ({ pose, reducedMotion }) => {
  const body = useRef<THREE.Group>(null);
  const lArm = useRef<THREE.Group>(null);
  const rArm = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Group>(null);
  const rLeg = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const smooth = useRef({ speed: 0, reach: 0, lean: 0 });

  const m = useMemo(
    () => ({
      suit: new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.55, metalness: 0.1 }),
      trim: new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.5, metalness: 0.2 }),
      dark: new THREE.MeshStandardMaterial({ color: '#2a2f36', roughness: 0.6, metalness: 0.4 }),
      visor: new THREE.MeshStandardMaterial({ color: '#1b2430', roughness: 0.08, metalness: 0.9, emissive: new THREE.Color('#0b2540'), emissiveIntensity: 0.6 }),
      light: new THREE.MeshBasicMaterial({ color: '#38bdf8', toneMapped: false }),
    }),
    [],
  );
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const p = pose.current;
    const s = smooth.current;
    const k = 1 - Math.exp(-dt * 10);
    s.speed += (p.speed - s.speed) * k;
    s.reach += ((p.anim === 'interact' ? 1 : 0) - s.reach) * k;
    s.lean += ((reducedMotion ? 0 : THREE.MathUtils.clamp(-p.turn * 0.08, -0.25, 0.25)) - s.lean) * k;
    const running = p.anim === 'run';
    if (!reducedMotion) phase.current += dt * (s.speed * (running ? 13 : 8.5));
    const swing = reducedMotion ? 0 : Math.sin(phase.current) * s.speed * (running ? 0.95 : 0.65);
    const t = performance.now() / 1000;
    const breathe = reducedMotion ? 0 : Math.sin(t * 1.6) * 0.012;

    if (body.current) {
      body.current.position.y = Math.abs(Math.sin(phase.current)) * s.speed * 0.04 + breathe;
      body.current.rotation.x = (running ? 0.18 : 0.05) * s.speed;
      body.current.rotation.z = s.lean;
    }
    if (lLeg.current) lLeg.current.rotation.x = swing;
    if (rLeg.current) rLeg.current.rotation.x = -swing;
    if (lArm.current) lArm.current.rotation.x = -swing * 0.8 + (1 - s.speed) * Math.sin(t * 1.2) * (reducedMotion ? 0 : 0.04);
    if (rArm.current) {
      // Interact: raise the right arm forward as if touching a panel.
      rArm.current.rotation.x = THREE.MathUtils.lerp(swing * 0.8, -1.35, s.reach);
      rArm.current.rotation.z = THREE.MathUtils.lerp(0, -0.12, s.reach);
    }
  });

  return (
    <group ref={body}>
      {/* torso and life-support pack */}
      <mesh position={[0, 1.05, 0]} castShadow material={m.suit}>
        <capsuleGeometry args={[0.2, 0.32, 6, 14]} />
      </mesh>
      <mesh position={[0, 0.82, 0]} material={m.trim}>
        <cylinderGeometry args={[0.215, 0.215, 0.07, 14]} />
      </mesh>
      <mesh position={[0, 1.1, -0.24]} castShadow material={m.dark}>
        <boxGeometry args={[0.36, 0.5, 0.16]} />
      </mesh>
      <mesh position={[0, 1.2, 0.205]} material={m.light}>
        <boxGeometry args={[0.1, 0.06, 0.02]} />
      </mesh>
      {/* helmet */}
      <mesh position={[0, 1.54, 0]} castShadow material={m.suit}>
        <sphereGeometry args={[0.25, 20, 16]} />
      </mesh>
      <mesh position={[0, 1.55, 0.1]} scale={[1, 0.82, 0.8]} material={m.visor}>
        <sphereGeometry args={[0.2, 18, 14]} />
      </mesh>
      {/* arms */}
      <group ref={lArm} position={[-0.3, 1.28, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow material={m.suit}>
          <capsuleGeometry args={[0.075, 0.3, 4, 10]} />
        </mesh>
        <mesh position={[0, -0.46, 0]} material={m.dark}>
          <sphereGeometry args={[0.08, 10, 8]} />
        </mesh>
      </group>
      <group ref={rArm} position={[0.3, 1.28, 0]}>
        <mesh position={[0, -0.22, 0]} castShadow material={m.suit}>
          <capsuleGeometry args={[0.075, 0.3, 4, 10]} />
        </mesh>
        <mesh position={[0, -0.46, 0]} material={m.dark}>
          <sphereGeometry args={[0.08, 10, 8]} />
        </mesh>
      </group>
      {/* legs */}
      <group ref={lLeg} position={[-0.12, 0.8, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow material={m.suit}>
          <capsuleGeometry args={[0.09, 0.34, 4, 10]} />
        </mesh>
        <mesh position={[0, -0.6, 0.04]} castShadow material={m.dark}>
          <boxGeometry args={[0.16, 0.12, 0.26]} />
        </mesh>
      </group>
      <group ref={rLeg} position={[0.12, 0.8, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow material={m.suit}>
          <capsuleGeometry args={[0.09, 0.34, 4, 10]} />
        </mesh>
        <mesh position={[0, -0.6, 0.04]} castShadow material={m.dark}>
          <boxGeometry args={[0.16, 0.12, 0.26]} />
        </mesh>
      </group>
    </group>
  );
};
