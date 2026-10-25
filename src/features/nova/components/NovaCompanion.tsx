'use client';

import React, { MutableRefObject, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useExploreStore } from '@/features/explore/store';
import { INTERACTABLES } from '@/features/explore/world/layout';
import type { PlayerRef } from '@/features/explore/character/Player';
import { NovaHologram } from './NovaHologram';
import { NovaGuidanceMarker } from './NovaGuidanceMarker';
import { getTarget } from '../targets';
import { useNovaStore } from '../state/store';

const FOLLOW = new THREE.Vector3(0.95, 2.05, 0.1);
const goal = new THREE.Vector3();
const toTarget = new THREE.Vector3();

interface Props {
  player: MutableRefObject<PlayerRef>;
  reducedMotion: boolean;
}

/**
 * In-world companion. Not a physics body: a damped anchor that hovers beside the astronaut while
 * exploring, drifts to the equipment while a task is open, and leans toward the guided target.
 * Its pose lives in refs, so moving never re-renders React.
 */
export const NovaCompanion: React.FC<Props> = ({ player, reducedMotion }) => {
  const group = useRef<THREE.Group>(null);
  const orb = useRef(new THREE.Vector3());
  const appear = useRef(reducedMotion ? 1 : 0);
  const placed = useRef(false);
  const base = useRef(new THREE.Vector3());

  useEffect(() => {
    // Leaving the habitat (unmount) must not leave speech or markers behind.
    return () => useNovaStore.getState().patch({ guidance: null });
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const ex = useExploreStore.getState();
    const g = group.current;
    if (!g) return;
    const p = player.current;
    const inTask = (ex.mode === 'task' || (ex.mode === 'transitioning' && ex.transitionDirection === 'in')) && ex.activeInteractableId;
    let scale = 1.7; // the follow camera is ~12 m away, so the body is drawn larger than its apparent size up close
    if (inTask) {
      const it = INTERACTABLES.find((i) => i.id === ex.activeInteractableId);
      if (it) {
        // Beside the equipment, on the side facing the camera, smaller so it never covers the task.
        goal.set(...it.focus.target);
        toTarget.set(it.focus.offset[0], 0, it.focus.offset[2]).normalize();
        goal.x += toTarget.x * 0.6 - toTarget.z * 0.5;
        goal.z += toTarget.z * 0.6 + toTarget.x * 0.5;
        goal.y += 1.35;
        scale = 0.95;
      }
    } else {
      goal.set(p.x + FOLLOW.x, FOLLOW.y, p.z + FOLLOW.z);
      const gd = useNovaStore.getState().guidance;
      const tgt = gd ? getTarget(gd.targetId) : null;
      if (tgt) {
        // Lean toward the destination without leaving the astronaut's side.
        toTarget.set(tgt.world[0] - p.x, 0, tgt.world[2] - p.z);
        const d = toTarget.length();
        if (d > 0.5) goal.addScaledVector(toTarget.normalize(), Math.min(0.9, d * 0.25));
      }
    }
    if (!placed.current) {
      base.current.copy(goal);
      placed.current = true;
    }
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * (inTask ? 2.6 : 3.4));
    base.current.lerp(goal, k);
    // Hover, off when the user prefers reduced motion.
    g.position.copy(base.current);
    if (!reducedMotion) g.position.y += Math.sin(performance.now() / 1000 * 1.3) * 0.06;
    orb.current.copy(g.position);
    const s = g.scale.x + (scale - g.scale.x) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 4));
    g.scale.setScalar(s);
    appear.current = reducedMotion ? 1 : Math.min(1, appear.current + dt / 1.4);
    g.visible = ex.mode !== 'debrief';
  });

  return (
    <>
      <group ref={group}>
        <NovaHologram appear={appear} reducedMotion={reducedMotion} />
      </group>
      <NovaGuidanceMarker orb={orb} reducedMotion={reducedMotion} />
    </>
  );
};
