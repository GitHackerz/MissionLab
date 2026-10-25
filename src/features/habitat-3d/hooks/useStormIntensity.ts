import { MutableRefObject, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * Eases a 0..1 storm intensity toward the authoritative target. This is a
 * transient render value only: it makes arrival/recovery readable and never
 * feeds back into mission state. The first value is the target itself, so
 * loading a mid-storm state does not replay the approach.
 */
export function useStormIntensity(target: number, reducedMotion: boolean): MutableRefObject<number> {
  const intensity = useRef(target);
  const targetRef = useRef(target);
  targetRef.current = target;

  useFrame((_, delta) => {
    const goal = targetRef.current;
    if (reducedMotion) {
      intensity.current = goal;
      return;
    }
    const rate = goal > intensity.current ? 0.45 : 0.3; // per second
    const step = Math.min(delta, 0.1) * rate;
    const diff = goal - intensity.current;
    intensity.current = Math.abs(diff) <= step ? goal : intensity.current + Math.sign(diff) * step;
  });

  return intensity;
}
