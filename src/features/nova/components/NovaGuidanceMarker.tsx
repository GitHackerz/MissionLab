'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { SpriteLabel } from '@/features/habitat-3d/components/SpriteLabel';
import { getTarget } from '../targets';
import { useNovaStore } from '../state/store';

const UP = new THREE.Vector3(0, 1, 0);

interface Props {
  /** Live world position of the companion, so the beam always starts at the orb. */
  orb: React.MutableRefObject<THREE.Vector3>;
  reducedMotion: boolean;
}

/**
 * Projected guidance: a floor halo (readable from the elevated camera), a camera-facing halo at the
 * part's height, a thin beam from NOVA to the target, and a short label. All driven by a target id
 * from the registry; positions are never taken from the model.
 */
export const NovaGuidanceMarker: React.FC<Props> = ({ orb, reducedMotion }) => {
  const guidance = useNovaStore((s) => s.guidance);
  const target = guidance ? getTarget(guidance.targetId) : null;
  const camera = useThree((s) => s.camera);
  const floor = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const root = useRef<THREE.Group>(null);
  const mid = useMemo(() => new THREE.Vector3(), []);
  const end = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const fade = useRef(0);
  const mats = useMemo(() => {
    const base = { color: '#56f0c8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide } as const;
    return { floor: new THREE.MeshBasicMaterial({ ...base, opacity: 0 }), halo: new THREE.MeshBasicMaterial({ ...base, opacity: 0 }), beam: new THREE.MeshBasicMaterial({ ...base, opacity: 0 }) };
  }, []);

  useFrame(({ clock }, delta) => {
    const g = useNovaStore.getState().guidance;
    const live = g && getTarget(g.targetId) && Date.now() < g.until;
    fade.current += ((live ? 1 : 0) - fade.current) * (1 - Math.exp(-Math.min(delta, 0.05) * 6));
    if (root.current) root.current.visible = fade.current > 0.01 && Boolean(target);
    if (!target || fade.current <= 0.01) return;
    const t = clock.elapsedTime;
    const pulse = reducedMotion ? 0.8 : 0.65 + 0.35 * Math.sin(t * 3);
    mats.floor.opacity = 0.55 * fade.current * pulse;
    mats.halo.opacity = 0.7 * fade.current * pulse;
    mats.beam.opacity = 0.28 * fade.current;
    if (floor.current) floor.current.scale.setScalar(1 + (reducedMotion ? 0 : 0.06 * Math.sin(t * 2.4)));
    if (halo.current) halo.current.quaternion.copy(camera.quaternion);
    if (beam.current) {
      end.set(target.world[0], target.kind === 'part' ? target.world[1] : 0.9, target.world[2]);
      dir.subVectors(end, orb.current);
      const len = Math.max(0.01, dir.length());
      mid.addVectors(orb.current, end).multiplyScalar(0.5);
      beam.current.position.copy(mid);
      beam.current.quaternion.setFromUnitVectors(UP, dir.normalize());
      beam.current.scale.set(1, len, 1);
    }
  });

  if (!target) return null;
  const [x, y, z] = target.world;
  const isPart = target.kind === 'part';
  return (
    <group>
      <group ref={root} visible={false}>
        <mesh ref={floor} position={[x, 0.04, z]} rotation={[-Math.PI / 2, 0, 0]} material={mats.floor} raycast={() => null}>
          <ringGeometry args={[target.radius * 0.82, target.radius, 56]} />
        </mesh>
        {isPart && (
          <mesh ref={halo} position={[x, y, z]} material={mats.halo} raycast={() => null}>
            <ringGeometry args={[target.radius * 0.8, target.radius, 48]} />
          </mesh>
        )}
        <mesh ref={beam} material={mats.beam} raycast={() => null}>
          <cylinderGeometry args={[0.012, 0.012, 1, 6, 1, true]} />
        </mesh>
        <SpriteLabel text={target.label} position={[x, (isPart ? y : 0.2) + target.radius + 0.35, z]} heightPx={26} />
      </group>
    </group>
  );
};
