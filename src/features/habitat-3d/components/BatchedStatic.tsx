'use client';

import React, { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Mark a subtree (e.g. a spinning fan group) so the batcher leaves it untouched. */
export const NO_BATCH = { noBatch: true } as const;

const inverse = new THREE.Matrix4();
const relative = new THREE.Matrix4();

/**
 * Bakes the static meshes below it into one mesh per (material, shadow flags)
 * after mount, cutting draw calls without changing how modules are authored.
 * Materials stay shared objects, so per-frame material updates (status
 * lights, dust tint) still apply. Subtrees tagged with `NO_BATCH`, instanced
 * meshes and anything that moves per frame are left as they are.
 */
export const BatchedStatic: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const root = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;
    group.updateWorldMatrix(true, true);
    inverse.copy(group.matrixWorld).invert();

    type Bucket = { material: THREE.Material; cast: boolean; receive: boolean; renderOrder: number; geos: THREE.BufferGeometry[] };
    const buckets = new Map<string, Bucket>();
    const hidden: THREE.Mesh[] = [];

    const visit = (obj: THREE.Object3D) => {
      if (obj.userData.noBatch) return;
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && !(mesh as THREE.InstancedMesh).isInstancedMesh && mesh.visible && !Array.isArray(mesh.material)) {
        const key = `${mesh.material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}|${mesh.renderOrder}`;
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { material: mesh.material, cast: mesh.castShadow, receive: mesh.receiveShadow, renderOrder: mesh.renderOrder, geos: [] };
          buckets.set(key, bucket);
        }
        const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        // Keep only attributes every primitive shares, so merging never fails on a mismatch.
        for (const name of Object.keys(geo.attributes)) {
          if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
        }
        relative.multiplyMatrices(inverse, mesh.matrixWorld);
        geo.applyMatrix4(relative);
        bucket.geos.push(geo);
        hidden.push(mesh);
      }
      obj.children.forEach(visit);
    };
    group.children.forEach(visit);

    const merged: THREE.Mesh[] = [];
    buckets.forEach((b) => {
      const geometry = mergeGeometries(b.geos);
      b.geos.forEach((g) => g.dispose());
      if (!geometry) return;
      const mesh = new THREE.Mesh(geometry, b.material);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.renderOrder = b.renderOrder;
      mesh.name = 'batched-static';
      group.add(mesh);
      merged.push(mesh);
    });
    hidden.forEach((m) => (m.visible = false));

    return () => {
      merged.forEach((m) => {
        group.remove(m);
        m.geometry.dispose();
      });
      hidden.forEach((m) => (m.visible = true));
    };
  }, []);

  return <group ref={root}>{children}</group>;
};
