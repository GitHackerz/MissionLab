'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { PAD_RADIUS } from '../constants/layout';
import { fbm, generateScatter, smoothstep, terrainHeight, valueNoise } from '../utils/terrain';

const SIZE = 180;
const SEGMENTS = 120;

function createGrainTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = 0.55 * valueNoise(x * 0.09, y * 0.09) + 0.3 * valueNoise(x * 0.3, y * 0.3) + 0.15 * Math.random();
        const v = 150 + n * 105;
        const i = (y * size + x) * 4;
        img.data[i] = v;
        img.data[i + 1] = v * 0.97;
        img.data[i + 2] = v * 0.94;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(36, 36);
  tex.anisotropy = 4;
  return tex;
}

function createTerrainGeometry(): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const ground = new THREE.Color('#a8532c');
  const dusty = new THREE.Color('#c27a4a');
  const dark = new THREE.Color('#6e3720');
  const pad = new THREE.Color('#8a5a3c');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const patch = fbm(x * 0.07 + 20, z * 0.07, 3);
    c.copy(dark).lerp(ground, smoothstep(0.2, 0.55, patch)).lerp(dusty, smoothstep(0.55, 0.85, patch) * 0.8);
    c.lerp(dusty, smoothstep(0.5, 3.5, h) * 0.4);
    // Compacted regolith pad under the colony.
    c.lerp(pad, 1 - smoothstep(PAD_RADIUS - 3, PAD_RADIUS + 1.5, Math.hypot(x, z)));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

const rockDummy = new THREE.Object3D();

function useRockInstances(count: number, seed: number, minR: number, maxR: number, minS: number, maxS: number) {
  return useMemo(() => {
    const scatter = generateScatter(count, seed, minR, maxR, minS, maxS);
    const matrices = scatter.map((s) => {
      rockDummy.position.set(s.x, s.y, s.z);
      rockDummy.rotation.set(...s.rotation);
      rockDummy.scale.set(...s.scale);
      rockDummy.updateMatrix();
      return rockDummy.matrix.clone();
    });
    const base = new THREE.Color('#7a3f26');
    const light = new THREE.Color('#a8663f');
    const colors = scatter.map((s) => new THREE.Color().lerpColors(base, light, s.tone));
    return { matrices, colors };
  }, [count, seed, minR, maxR, minS, maxS]);
}

const Rocks: React.FC<{
  detail: number;
  count: number;
  seed: number;
  minR: number;
  maxR: number;
  minS: number;
  maxS: number;
  castShadow: boolean;
}> = ({ detail, count, seed, minR, maxR, minS, maxS, castShadow }) => {
  const { matrices, colors } = useRockInstances(count, seed, minR, maxR, minS, maxS);
  const ref = React.useRef<THREE.InstancedMesh>(null);
  React.useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((mx, i) => {
      mesh.setMatrixAt(i, mx);
      mesh.setColorAt(i, colors[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices, colors]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow={castShadow} receiveShadow>
      <icosahedronGeometry args={[1, detail]} />
      <meshStandardMaterial roughness={0.95} metalness={0.02} flatShading />
    </instancedMesh>
  );
};

/** Displaced terrain, instanced rock scatter and a ring of distant ridgeline silhouettes. */
export const MarsTerrain: React.FC<{ quality: 'high' | 'low' }> = ({ quality }) => {
  const geometry = useMemo(createTerrainGeometry, []);
  const grain = useMemo(createGrainTexture, []);
  const ridgeGeometry = useMemo(() => {
    const steps = 160;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      // Periodic noise: sample on a circle so the ridge closes seamlessly.
      const n = fbm(Math.cos(a) * 3 + 11, Math.sin(a) * 3 + 5, 4);
      const h = 4 + n * 20 + Math.max(0, Math.sin(a * 3 + 1) * 5);
      const r = 95 + n * 8;
      positions.push(Math.cos(a) * r, -3, Math.sin(a) * r, Math.cos(a) * (r + 6), h, Math.sin(a) * (r + 6));
      if (i < steps) {
        const k = i * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      grain.dispose();
      ridgeGeometry.dispose();
    },
    [geometry, grain, ridgeGeometry],
  );

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors map={grain} roughness={1} metalness={0} />
      </mesh>
      <Rocks detail={1} count={quality === 'high' ? 90 : 50} seed={7} minR={10} maxR={70} minS={0.25} maxS={1.7} castShadow />
      <Rocks detail={0} count={quality === 'high' ? 320 : 150} seed={19} minR={6.5} maxR={60} minS={0.06} maxS={0.28} castShadow={false} />
      <mesh geometry={ridgeGeometry} frustumCulled={false}>
        <meshBasicMaterial color="#6d3524" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
