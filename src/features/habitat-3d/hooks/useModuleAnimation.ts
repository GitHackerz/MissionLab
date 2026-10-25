import { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ModuleState } from '@/simulation/types';
import { resolveStatusVisual } from '../utils/visualState';

/** Transient render values for one module. Never read back by the simulation. */
export interface ModuleAnimation {
  /** Damped 0..1 light level. */
  glow: number;
  /** Damped 0..1 functional activity (before reduced-motion). */
  activity: number;
  /** Activity actually used for movement: 0 when the user prefers reduced motion. */
  motion: number;
  /** 0..1 beacon pulse. Steady when reduced motion is requested. */
  pulse: number;
  /** Accumulated movement phase: rotation = phase * speed. */
  phase: number;
  time: number;
}

export interface ModuleAnimationResult {
  anim: MutableRefObject<ModuleAnimation>;
  /** Warm interior / window light, scales with `glow`. */
  interior: THREE.MeshStandardMaterial;
  /** Status-coloured indicator, scales with pulse. */
  statusLed: THREE.MeshBasicMaterial;
}

const flicker = (t: number) => {
  const v = Math.sin(t * 9.1) * Math.sin(t * 3.7 + 1.3) + Math.sin(t * 17.3) * 0.25;
  return THREE.MathUtils.clamp(0.55 + v * 0.45, 0.1, 1);
};

export function useModuleAnimation(module: ModuleState, reducedMotion: boolean): ModuleAnimationResult {
  const visual = resolveStatusVisual(module.status);
  const visualRef = useRef(visual);
  const reducedRef = useRef(reducedMotion);
  useEffect(() => {
    visualRef.current = visual;
    reducedRef.current = reducedMotion;
  });

  const anim = useRef<ModuleAnimation>({
    glow: visual.glow,
    activity: visual.activity,
    motion: reducedMotion ? 0 : visual.activity,
    pulse: 0.75,
    phase: 0,
    time: 0,
  });

  const interior = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2a2622',
        emissive: new THREE.Color('#ffcf8a'),
        emissiveIntensity: visual.glow,
        roughness: 0.4,
      }),
    // Created once; per-frame updates below drive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const statusLed = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(visual.color), toneMapped: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(
    () => () => {
      interior.dispose();
      statusLed.dispose();
    },
    [interior, statusLed],
  );

  const target = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const v = visualRef.current;
    const s = anim.current;
    const k = 1 - Math.exp(-dt * 4);

    s.time += dt;
    s.glow += (v.glow - s.glow) * k;
    s.activity += (v.activity - s.activity) * k;

    const reduced = reducedRef.current;
    const stutter = v.flicker ? flicker(s.time) : 1;
    s.motion = reduced ? 0 : s.activity * stutter;
    s.phase += dt * s.motion;

    if (reduced || v.pulseHz === 0) s.pulse = reduced ? 0.8 : 0.9;
    else if (v.flicker) s.pulse = flicker(s.time + 4);
    else s.pulse = 0.5 + 0.5 * Math.sin(s.time * Math.PI * 2 * v.pulseHz);

    const lightFlicker = v.flicker && !reduced ? 0.7 + 0.3 * flicker(s.time + 2) : 1;
    interior.emissiveIntensity = s.glow * 1.3 * lightFlicker;

    target.set(v.color);
    statusLed.color.lerp(target, k);
  });

  return { anim, interior, statusLed };
}
