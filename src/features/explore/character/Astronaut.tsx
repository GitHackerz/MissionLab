'use client';

import React, { MutableRefObject, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

export type AstronautAnim = 'idle' | 'walk' | 'run' | 'interact';

export interface AstronautPose {
  anim: AstronautAnim;
  /** 0..1 fraction of top speed, drives limb swing amplitude/frequency. */
  speed: number;
  /** Signed turn rate (rad/s): leans the body into turns. */
  turn: number;
}

/** Built by scripts/blender/build_astronaut.py (nodes: ArmL/ArmR/LegL/LegR pivoted at the joints). */
const MODEL_URL = '/models/astronaut.glb';
/** Fankouch is a short, small bot: rendered at the modelled size (~1.29 m), well under door height. */
const MODEL_SCALE = 1;

/**
 * MissionLab mascot astronaut (Blender model, public/models/astronaut.glb).
 * Animation is driven by a pose ref so walking never re-renders React.
 * Clips available: idle (breathing + arm sway), walk, run (faster, leaning),
 * interact (reaching pose), and a lean while turning.
 */
export const Astronaut: React.FC<{ pose: MutableRefObject<AstronautPose>; reducedMotion: boolean }> = ({ pose, reducedMotion }) => {
  const { scene } = useGLTF(MODEL_URL);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return clone;
  }, [scene]);
  const limbs = useMemo(
    () => ({
      lArm: model.getObjectByName('ArmL'),
      rArm: model.getObjectByName('ArmR'),
      lLeg: model.getObjectByName('LegL'),
      rLeg: model.getObjectByName('LegR'),
    }),
    [model],
  );
  const body = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const smooth = useRef({ speed: 0, reach: 0, lean: 0 });

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
    if (limbs.lLeg) limbs.lLeg.rotation.x = swing;
    if (limbs.rLeg) limbs.rLeg.rotation.x = -swing;
    if (limbs.lArm) limbs.lArm.rotation.x = -swing * 0.8 + (1 - s.speed) * Math.sin(t * 1.2) * (reducedMotion ? 0 : 0.04);
    if (limbs.rArm) {
      // Interact: raise the right arm forward as if touching a panel.
      limbs.rArm.rotation.x = THREE.MathUtils.lerp(swing * 0.8, -1.35, s.reach);
      limbs.rArm.rotation.z = THREE.MathUtils.lerp(0, -0.12, s.reach);
    }
  });

  return (
    <group ref={body}>
      <primitive object={model} scale={MODEL_SCALE} />
    </group>
  );
};

useGLTF.preload(MODEL_URL);
