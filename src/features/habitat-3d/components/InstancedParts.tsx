'use client';

import React, { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { Vec3 } from '../constants/layout';

export interface PartTransform {
  p: Vec3;
  r?: Vec3;
  s?: Vec3 | number;
}

const dummy = new THREE.Object3D();

/** One draw call for many identical static parts (ribs, windows, slats, plants). */
export const InstancedParts: React.FC<{
  transforms: PartTransform[];
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Per-instance colours (hex), same length as `transforms`. */
  colors?: THREE.Color[];
  children: React.ReactNode;
}> = ({ transforms, material, castShadow = false, receiveShadow = false, colors, children }) => {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    transforms.forEach((t, i) => {
      dummy.position.set(...t.p);
      dummy.rotation.set(...(t.r ?? [0, 0, 0]));
      if (typeof t.s === 'number') dummy.scale.setScalar(t.s);
      else dummy.scale.set(...(t.s ?? [1, 1, 1]));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (colors?.[i]) mesh.setColorAt(i, colors[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [transforms, colors]);

  return (
    <instancedMesh
      key={transforms.length}
      ref={ref}
      args={[undefined, undefined, transforms.length]}
      material={material}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      {children}
    </instancedMesh>
  );
};
