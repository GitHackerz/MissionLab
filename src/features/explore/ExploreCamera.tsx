'use client';

import React, { MutableRefObject, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useExploreStore } from './store';
import { INTERACTABLES } from './world/layout';
import type { PlayerRef } from './character/Player';

const FOLLOW_OFFSET = new THREE.Vector3(0, 8.2, 6.2);
const LOOK_OFFSET = new THREE.Vector3(0, 0.9, 0);
/** A transition always completes within this time, so controls can never stay locked. */
const MAX_TRANSITION_S = 2.2;

const goalPos = new THREE.Vector3();
const goalLook = new THREE.Vector3();
const look = new THREE.Vector3();

interface Props {
  player: MutableRefObject<PlayerRef>;
  reducedMotion: boolean;
}

/**
 * Elevated third-person follow camera with fixed yaw (movement stays camera-relative and
 * predictable) and damped transitions into and out of tasks. Walls are low "dollhouse"
 * walls, so the player is never hidden behind them. In the water-recycler task the
 * camera hands over to a limited orbit so the learner can rotate around the machine.
 */
export const ExploreCamera: React.FC<Props> = ({ player, reducedMotion }) => {
  const camera = useThree((s) => s.camera);
  const mode = useExploreStore((s) => s.mode);
  const taskId = useExploreStore((s) => s.activeTaskId);
  const started = useRef(0);
  const last = useRef<{ mode: string; dir: string | null }>({ mode: '', dir: null });
  const orbit = mode === 'task' && taskId === 'water-recycler';
  const orbitTarget = useRef<[number, number, number]>([0, 0.5, 0]);
  const focusRef = useRef<(typeof INTERACTABLES)[number] | null>(null);

  useEffect(() => {
    const id = useExploreStore.getState().activeInteractableId;
    if (id) focusRef.current = INTERACTABLES.find((i) => i.id === id) ?? null;
  }, [mode, taskId]);

  // Start from the follow position so there is no jump when the habitat opens.
  useEffect(() => {
    const p = player.current;
    camera.position.set(p.x + FOLLOW_OFFSET.x, FOLLOW_OFFSET.y, p.z + FOLLOW_OFFSET.z);
    camera.lookAt(p.x, 0.9, p.z);
    look.set(p.x, 0.9, p.z);
  }, [camera, player]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const st = useExploreStore.getState();
    const p = player.current;
    const focus = focusRef.current;
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * (st.mode === 'transitioning' ? 4.2 : 6.5));

    const inTask = (st.mode === 'task' || (st.mode === 'transitioning' && st.transitionDirection === 'in')) && focus;
    if (inTask && focus) {
      goalLook.set(...focus.focus.target);
      goalPos.copy(goalLook).add(new THREE.Vector3(...focus.focus.offset));
      orbitTarget.current = focus.focus.target;
    } else {
      goalLook.set(p.x, 0, p.z).add(LOOK_OFFSET);
      goalPos.set(p.x, 0, p.z).add(FOLLOW_OFFSET);
    }

    if (!(orbit && st.mode === 'task')) {
      camera.position.lerp(goalPos, k);
      look.lerp(goalLook, k);
      camera.lookAt(look);
    }

    // Transition bookkeeping: finish when close, or after the time limit.
    if (st.mode === 'transitioning') {
      if (last.current.mode !== 'transitioning' || last.current.dir !== st.transitionDirection) started.current = clock.elapsedTime;
      const near = camera.position.distanceTo(goalPos) < 0.2;
      if (near || clock.elapsedTime - started.current > MAX_TRANSITION_S) st.finishTransition();
    }
    last.current = { mode: st.mode, dir: st.transitionDirection };
  });

  return (
    <OrbitControls
      enabled={orbit}
      target={orbitTarget.current}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minDistance={2.5}
      maxDistance={8}
      maxPolarAngle={Math.PI / 2.15}
      minPolarAngle={0.3}
    />
  );
};
