'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BatchedStatic } from '@/features/habitat-3d/components/BatchedStatic';
import { ROOM_LIST } from './layout';

/** Physical signage uses local canvas textures: no font download or network dependency. */
function Sign({ title, subtitle, color, position, floor = false, width = 2.6 }: { title: string; subtitle: string; color: string; position: [number, number, number]; floor?: boolean; width?: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 768; canvas.height = 192;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#16252c'; ctx.fillRect(0, 0, 768, 192);
    ctx.fillStyle = color; ctx.fillRect(0, 0, 10, 192);
    ctx.font = '600 46px sans-serif'; ctx.fillText(title, 36, 82);
    ctx.fillStyle = '#b8c9d0'; ctx.font = '24px monospace'; ctx.fillText(subtitle, 36, 135);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [title, subtitle, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={position} rotation={floor ? [-Math.PI / 2, 0, 0] : [0, 0, 0]} raycast={() => null}><planeGeometry args={[width, width / 4]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>;
}

export function HabitatDressing() {
  const materials = useMemo(() => ({
    steel: new THREE.MeshStandardMaterial({ color: '#24343c', roughness: .65, metalness: .45 }),
    trim: new THREE.MeshStandardMaterial({ color: '#899ba1', roughness: .55, metalness: .5 }),
    ground: new THREE.MeshStandardMaterial({ color: '#714c3d', roughness: 1 }),
    rock: new THREE.MeshStandardMaterial({ color: '#87614e', roughness: 1 }),
    line: new THREE.MeshStandardMaterial({ color: '#c3bd9e', roughness: .8 }),
  }), []);
  useEffect(() => () => Object.values(materials).forEach(m => m.dispose()), [materials]);
  return <group>
    <BatchedStatic>
      <mesh position={[0, -.72, 0]} rotation={[-Math.PI / 2, 0, 0]} material={materials.ground}><planeGeometry args={[180, 180]} /></mesh>
      {/* A continuous insulated foundation makes the cutaway read as a real station. */}
      {ROOM_LIST.map(([id, r]) => <group key={id}>
        <mesh position={[(r.minX + r.maxX) / 2, -.27, (r.minZ + r.maxZ) / 2]} material={materials.steel}><boxGeometry args={[r.maxX - r.minX + .3, .45, r.maxZ - r.minZ + .3]} /></mesh>
        {Array.from({ length: Math.floor((r.maxX - r.minX) / .8) }, (_, i) => <mesh key={i} position={[r.minX + .4 + i * .8, .008, (r.minZ + r.maxZ) / 2]} material={materials.trim}><boxGeometry args={[.012, .01, r.maxZ - r.minZ - .25]} /></mesh>)}
        {/* Rear wall ribs and an overhead service rail keep the near walls cut away. */}
        {Array.from({ length: Math.ceil((r.maxX - r.minX) / 2) }, (_, i) => <mesh key={i} position={[r.minX + .25 + i * 2, .68, r.minZ + .12]} material={materials.steel}><boxGeometry args={[.12, 1.36, .12]} /></mesh>)}
        <mesh position={[(r.minX + r.maxX) / 2, 1.34, r.minZ]} material={materials.steel}><boxGeometry args={[r.maxX - r.minX, .12, .28]} /></mesh>
        <mesh position={[(r.minX + r.maxX) / 2, .18, r.minZ + .15]} rotation={[0, 0, Math.PI / 2]} material={materials.trim}><cylinderGeometry args={[.035, .035, r.maxX - r.minX - .2, 6]} /></mesh>
      </group>)}
      {/* Door jambs retain open, collision-free entrances. */}
      {[[-1.17, -3.9], [1.17, -3.9], [-1.17, 3.9], [1.17, 3.9], [-3.9, -1.17], [-3.9, 1.17], [3.9, -1.17], [3.9, 1.17]].map(([x, z], i) => <mesh key={i} position={[x, .7, z]} material={materials.steel}><boxGeometry args={[.12, 1.4, .12]} /></mesh>)}
      {/* Floor route dashes lead outward from the hub without covering the equipment. */}
      {[-1, 1].flatMap(dir => Array.from({ length: 7 }, (_, i) => <group key={`${dir}-${i}`}>
        <mesh position={[dir * (1 + i * .42), .02, .72]} material={materials.line}><boxGeometry args={[.2, .02, .04]} /></mesh>
        <mesh position={[.72, .02, dir * (1 + i * .42)]} material={materials.line}><boxGeometry args={[.04, .02, .2]} /></mesh>
      </group>))}
      {/* Life-support manifolds, inspection ports and braced pressure cylinders. */}
      {[-9.65, -9.4].map(x => <mesh key={x} position={[x, .7, -.2]} rotation={[Math.PI / 2, 0, 0]} material={materials.trim}><cylinderGeometry args={[.055, .055, 4.8, 10]} /></mesh>)}
      {[-2.2, -.7, .8].map(z => <group key={z} position={[-9.5, .7, z]}><mesh material={materials.steel}><boxGeometry args={[.55, .65, .22]} /></mesh><mesh position={[0, .05, .14]} rotation={[Math.PI / 2, 0, 0]} material={materials.line}><cylinderGeometry args={[.16, .16, .04, 16]} /></mesh></group>)}
      {/* Communication rack vents and battery enclosure detail. */}
      {[5.6, 6.9, 8.2, -3.45].map((x, i) => <group key={x} position={[x, 0, i === 3 ? -6.6 : -2.4]}>
        {[.25, .55, .85, 1.15, 1.45].map(y => <mesh key={y} position={[0, y, .415]} material={materials.trim}><boxGeometry args={[.88, .045, .025]} /></mesh>)}
      </group>)}
      {/* Deterministic low-poly rocks remain outside the walkable footprint. */}
      {Array.from({ length: 45 }, (_, i) => {
        const angle = i * 2.399; const radius = 16 + (i % 9) * 2;
        return <mesh key={i} position={[Math.cos(angle) * radius, -.6, Math.sin(angle) * radius]} scale={[.5 + i % 3 * .3, .3 + i % 2 * .2, .7]} rotation={[0, angle, .2]} material={materials.rock}><dodecahedronGeometry args={[1, 0]} /></mesh>;
      })}
    </BatchedStatic>
    <Sign title="ARES / 01" subtitle="RESEARCH STATION · CENTRAL HUB" color="#eab28c" position={[0, .025, -.8]} floor width={2.4} />
    <Sign title="01 / MISSION CONTROL" subtitle="COMMUNICATIONS · MISSION LOG" color="#38bdf8" position={[0, 1.7, -8.9]} width={4.2} />
    <Sign title="02 / POWER SYSTEMS" subtitle="GENERATION → STORAGE → LOADS" color="#fbbf24" position={[7.2, .025, 1.3]} floor width={3.3} />
    <Sign title="03 / LIFE SUPPORT" subtitle="WATER RECOVERY · AIR REVITALIZATION" color="#22d3ee" position={[-7.3, .025, 2.3]} floor width={3.6} />
    <Sign title="04 / BOTANY" subtitle="LIGHT + WATER + ENERGY → FOOD" color="#4ade80" position={[0, .025, 8.5]} floor width={3.5} />
    <Sign title="POWER →" subtitle="02 / ELECTRICAL" color="#fbbf24" position={[1.1, .025, .25]} floor width={1.4} />
    <Sign title="← WATER / AIR" subtitle="03 / LIFE SUPPORT" color="#22d3ee" position={[-1.05, .025, -.25]} floor width={1.4} />
  </group>;
}
