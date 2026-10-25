'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
import { ModuleId } from '@/simulation/types';
import { CAMERA, MODULE_LAYOUT } from '../constants/layout';
import { terrainHeight } from '../utils/terrain';

export type CameraRequest =
  | { kind: 'overview'; nonce: number }
  | { kind: 'focus'; moduleId: ModuleId; nonce: number }
  | { kind: 'service'; nonce: number };

interface CameraControllerProps {
  selectedModuleId: ModuleId | null;
  serviceActive: boolean;
  request: CameraRequest | null;
  reducedMotion: boolean;
}

interface Goal {
  target: THREE.Vector3;
  /** Unit offset direction; when absent the current viewing direction is kept. */
  direction?: THREE.Vector3;
  distance: number;
}

const overviewDirection = new THREE.Vector3(...CAMERA.overviewOffset).normalize();
const overviewDistance = new THREE.Vector3(...CAMERA.overviewOffset).length();

/** Pull the camera back on narrow viewports so the whole colony stays framed. */
export function overviewDistanceForAspect(aspect: number): number {
  const factor = aspect >= 1.3 ? 1 : Math.min(2.1, 1.3 / Math.max(aspect, 0.4));
  return Math.min(CAMERA.maxDistance - 1, overviewDistance * factor);
}

const tmpOffset = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();

/**
 * Orbit/zoom/pan with smooth, interruptible transitions. Selection retargets
 * the orbit centre without changing the viewing angle; the overview reset and
 * the explicit Focus control also adjust the angle. Nothing moves on mission
 * state updates, and any user input cancels the current transition.
 */
export const CameraController: React.FC<CameraControllerProps> = ({ selectedModuleId, serviceActive, request, reducedMotion }) => {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const goal = useRef<Goal | null>(null);
  const touched = useRef(false);
  const previousSelection = useRef<ModuleId | null>(selectedModuleId);

  const aspect = size.width / Math.max(1, size.height);

  // Initial framing and re-framing on resize until the user takes over.
  useEffect(() => {
    if (!controls || touched.current) return;
    controls.target.set(...CAMERA.overviewTarget);
    camera.position.copy(controls.target).addScaledVector(overviewDirection, overviewDistanceForAspect(aspect));
    controls.update();
  }, [controls, camera, aspect]);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => {
      touched.current = true;
      goal.current = null;
    };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  // Selection (from the scene or the app's own UI) re-centres softly; no angle change.
  useEffect(() => {
    if (selectedModuleId && selectedModuleId !== previousSelection.current) {
      const [x, , z] = MODULE_LAYOUT[selectedModuleId].position;
      goal.current = {
        target: new THREE.Vector3(x, 0.8, z),
        distance: THREE.MathUtils.clamp(
          controls ? camera.position.distanceTo(controls.target) : 14,
          MODULE_LAYOUT[selectedModuleId].focusDistance,
          18,
        ),
      };
    }
    previousSelection.current = selectedModuleId;
  }, [selectedModuleId, camera, controls]);

  useEffect(() => {
    if (!request) return;
    if (request.kind === 'overview') {
      goal.current = {
        target: new THREE.Vector3(...CAMERA.overviewTarget),
        direction: overviewDirection,
        distance: overviewDistanceForAspect(aspect),
      };
    } else if (request.kind === 'service') {
      const [x, , z] = MODULE_LAYOUT['water-recycler'].position;
      goal.current = {
        target: new THREE.Vector3(x - 0.8, 0.5, z - 0.1),
        direction: new THREE.Vector3(-0.85, 0.55, 0.2).normalize(),
        distance: 5.4,
      };
    } else {
      const layout = MODULE_LAYOUT[request.moduleId];
      goal.current = {
        target: new THREE.Vector3(layout.position[0], 0.9, layout.position[2]),
        direction: new THREE.Vector3(0.55, 0.6, 0.85).normalize(),
        distance: layout.focusDistance,
      };
    }
    // `aspect` is intentionally read at request time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  useFrame((_, delta) => {
    if (!controls) return;
    const g = goal.current;
    if (g) {
      const k = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 5);
      tmpTarget.copy(controls.target).lerp(g.target, k);
      tmpOffset.copy(camera.position).sub(controls.target);
      const currentDistance = tmpOffset.length();
      tmpOffset.normalize();
      if (g.direction) tmpOffset.lerp(g.direction, k).normalize();
      const distance = THREE.MathUtils.lerp(currentDistance, g.distance, k);
      controls.target.copy(tmpTarget);
      camera.position.copy(tmpTarget).addScaledVector(tmpOffset, distance);
      const done =
        tmpTarget.distanceTo(g.target) < 0.02 &&
        Math.abs(distance - g.distance) < 0.05 &&
        (!g.direction || tmpOffset.distanceTo(g.direction) < 0.01);
      if (done) goal.current = null;
    }

    // Keep the orbit centre over the pad and the camera above the local ground.
    const t = controls.target;
    const radius = Math.hypot(t.x, t.z);
    if (radius > CAMERA.maxPanRadius) {
      t.x *= CAMERA.maxPanRadius / radius;
      t.z *= CAMERA.maxPanRadius / radius;
    }
    t.y = THREE.MathUtils.clamp(t.y, 0, 4);
    const floor = terrainHeight(camera.position.x, camera.position.z) + CAMERA.groundClearance;
    if (camera.position.y < floor) camera.position.y = floor;
  });

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={serviceActive ? 2.5 : CAMERA.minDistance}
      maxDistance={CAMERA.maxDistance}
      maxPolarAngle={CAMERA.maxPolarAngle}
      minPolarAngle={0.2}
      screenSpacePanning={false}
      panSpeed={0.8}
      rotateSpeed={0.7}
      zoomSpeed={0.8}
    />
  );
};
