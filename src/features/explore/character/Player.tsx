'use client';

import React, { MutableRefObject, Suspense, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Astronaut, AstronautPose } from './Astronaut';
import type { GameKeys } from '../input/useGameInput';
import { moveWithCollision } from '../world/collision';
import { COLLIDERS, INTERACTABLES, PLAYER_RADIUS, roomAt } from '../world/layout';
import { pickInteractable } from '../interaction';
import { useExploreStore } from '../store';

export interface PlayerRef {
  x: number;
  z: number;
  yaw: number;
}

const WALK = 3.1;
const RUN = 5.4;
const ACCEL = 16;

interface PlayerProps {
  keys: MutableRefObject<GameKeys>;
  state: MutableRefObject<PlayerRef>;
  reducedMotion: boolean;
}

/**
 * Character controller: camera-relative (the camera looks north, so W = -Z),
 * frame-rate independent, with sliding AABB collision. Movement is purely
 * kinematic and never touches mission state. Only discrete changes (nearest
 * interactable, current room) are pushed to the store.
 */
export const Player: React.FC<PlayerProps> = ({ keys, state, reducedMotion }) => {
  const root = useRef<THREE.Group>(null);
  const vel = useRef({ x: 0, z: 0 });
  const pose = useRef<AstronautPose>({ anim: 'idle', speed: 0, turn: 0 });
  const nearby = useRef<string | null>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const store = useExploreStore.getState();
    const s = state.current;
    const exploring = store.mode === 'exploration' && store.worldMode === 'habitat' && !store.showObjectives;

    let ix = 0;
    let iz = 0;
    if (exploring) {
      const k = keys.current;
      ix = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      iz = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    }
    const len = Math.hypot(ix, iz);
    const sprint = exploring && keys.current.sprint;
    const top = sprint ? RUN : WALK;
    const tx = len > 0 ? (ix / len) * top : 0;
    const tz = len > 0 ? (iz / len) * top : 0;
    const a = 1 - Math.exp(-ACCEL * dt);
    vel.current.x += (tx - vel.current.x) * a;
    vel.current.z += (tz - vel.current.z) * a;
    if (Math.abs(vel.current.x) < 0.01 && tx === 0) vel.current.x = 0;
    if (Math.abs(vel.current.z) < 0.01 && tz === 0) vel.current.z = 0;

    if (!exploring) { vel.current.x = 0; vel.current.z = 0; }
    const moved = moveWithCollision(s.x, s.z, vel.current.x * dt, vel.current.z * dt, PLAYER_RADIUS, COLLIDERS);
    s.x = moved.x;
    s.z = moved.z;

    const speed = Math.hypot(vel.current.x, vel.current.z);
    let turn = 0;
    if (speed > 0.3) {
      const target = Math.atan2(vel.current.x, vel.current.z);
      let diff = target - s.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const step = Math.sign(diff) * Math.min(Math.abs(diff), 12 * dt);
      s.yaw += step;
      turn = step / dt;
    }
    pose.current.speed = Math.min(1, speed / (sprint ? RUN : WALK));
    pose.current.turn = turn;
    pose.current.anim = store.mode === 'task' || (store.mode === 'transitioning' && store.transitionDirection === 'in')
      ? 'interact'
      : speed > WALK + 0.4
      ? 'run'
      : speed > 0.2
      ? 'walk'
      : 'idle';

    if (root.current) {
      root.current.position.set(s.x, 0, s.z);
      root.current.rotation.y = s.yaw;
      // The recycler camera looks over the astronaut's shoulder; hide the avatar so it never blocks the machine.
      root.current.visible = !(store.mode === 'task' && store.activeTaskId === 'water-recycler');
    }

    if (exploring) {
      const best = pickInteractable(INTERACTABLES, { x: s.x, z: s.z, yaw: s.yaw, current: nearby.current });
      const id = best?.id ?? null;
      if (id !== nearby.current) {
        nearby.current = id;
        store.setNearby(id);
      }
      store.setRoom(roomAt(s.x, s.z));
    } else if (nearby.current !== null && store.mode !== 'task' && store.mode !== 'transitioning') {
      nearby.current = null;
      store.setNearby(null);
    }
  });

  return (
    <group ref={root}>
      <mesh position={[0, .012, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}><circleGeometry args={[.32, 20]} /><meshBasicMaterial color="#10212a" transparent opacity={.24} depthWrite={false} /></mesh>
      <Suspense fallback={null}>
        <Astronaut pose={pose} reducedMotion={reducedMotion} />
      </Suspense>
    </group>
  );
};
