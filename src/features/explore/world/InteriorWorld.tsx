'use client';

import React, { MutableRefObject, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MissionState, ModuleId } from '@/simulation/types';
import { BatchedStatic, NO_BATCH } from '@/features/habitat-3d/components/BatchedStatic';
import { InstancedParts, PartTransform } from '@/features/habitat-3d/components/InstancedParts';
import { StatusBeacon } from '@/features/habitat-3d/components/StatusBeacon';
import { WaterRecycler } from '@/features/habitat-3d/modules/WaterRecycler';
import { useModuleAnimation } from '@/features/habitat-3d/hooks/useModuleAnimation';
import { MODULE_LAYOUT } from '@/features/habitat-3d/constants/layout';
import { batteryChargeFraction } from '@/features/habitat-3d/utils/visualState';
import { litSegments } from '@/features/habitat-3d/modules/BatteryBank';
import type { HabitatModuleProps } from '@/features/habitat-3d/modules/types';
import type { ServiceHotspot } from '@/features/habitat-3d/utils/serviceInteractions';
import type { RecyclerComponentId } from '@/simulation/training/types';
import {
  CORRIDORS,
  INTERACTABLES,
  PROPS,
  Prop,
  RECYCLER_POSITION,
  ROOM_LIST,
  ROOMS,
  WALLS,
  WALL_H,
  WorldInteractable,
} from './layout';
import { HabitatDressing } from './HabitatDressing';
import { mulberry32 } from '@/features/habitat-3d/utils/terrain';

/** Soften an accent colour toward white so rooms read as tinted, not washed out. */
const tint = (hex: string) => new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.55);
const w = (b: { minX: number; maxX: number }) => b.maxX - b.minX;
const d = (b: { minZ: number; maxZ: number }) => b.maxZ - b.minZ;
const cx = (b: { minX: number; maxX: number }) => (b.minX + b.maxX) / 2;
const cz = (b: { minZ: number; maxZ: number }) => (b.minZ + b.maxZ) / 2;

function useInteriorMaterials() {
  const mats = useMemo(() => {
    const std = (color: string, roughness = 0.7, metalness = 0.1) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const floors = Object.fromEntries(ROOM_LIST.map(([id, r]) => [id, std(r.floor, 0.85, 0.05)])) as Record<string, THREE.MeshStandardMaterial>;
    const accents = Object.fromEntries(ROOM_LIST.map(([id, r]) => [id, new THREE.MeshBasicMaterial({ color: r.accent, toneMapped: false })])) as Record<string, THREE.MeshBasicMaterial>;
    const screens = Object.fromEntries(
      ROOM_LIST.map(([id, r]) => [id, new THREE.MeshStandardMaterial({ color: '#0d141b', emissive: new THREE.Color(r.accent), emissiveIntensity: 0.9, roughness: 0.3 })]),
    ) as Record<string, THREE.MeshStandardMaterial>;
    return {
      floors,
      accents,
      screens,
      corridor: std('#585049', 0.9, 0.05),
      wall: std('#aab8b9', 0.75, 0.05),
      wallTop: std('#354b55', 0.6, 0.2),
      panel: std('#2b3138', 0.55, 0.45),
      body: std('#aeb4ba', 0.5, 0.35),
      soil: std('#3a2a22', 1, 0),
      pipe: std('#6f8696', 0.35, 0.65),
      cable: std('#16110f', 0.7, 0.2),
      hazard: std('#c79a2b', 0.6, 0.2),
      growLight: new THREE.MeshStandardMaterial({ color: '#26301a', emissive: new THREE.Color('#d9f99d'), emissiveIntensity: 1 }),
      plant: new THREE.MeshStandardMaterial({ color: '#58a53a', roughness: 0.8 }),
      led: new THREE.MeshBasicMaterial({ toneMapped: false }),
    };
  }, []);
  useEffect(
    () => () => {
      const all: THREE.Material[] = [
        ...Object.values(mats.floors), ...Object.values(mats.accents), ...Object.values(mats.screens),
        mats.corridor, mats.wall, mats.wallTop, mats.panel, mats.body, mats.soil, mats.pipe, mats.cable, mats.hazard, mats.growLight, mats.plant, mats.led,
      ];
      all.forEach((m) => m.dispose());
    },
    [mats],
  );
  return mats;
}
type InteriorMats = ReturnType<typeof useInteriorMaterials>;

const PropVisual: React.FC<{ prop: Prop; mats: InteriorMats }> = ({ prop, mats }) => {
  const accent = mats.screens[prop.room];
  const rot = prop.facing ?? 0;
  const { w: pw, d: pd, h } = prop;
  switch (prop.kind) {
    case 'console':
      return (
        <group position={[prop.x, 0, prop.z]} rotation={[0, rot, 0]}>
          <mesh position={[0, h / 2, 0]} material={mats.body}>
            <boxGeometry args={[pw, h, pd]} />
          </mesh>
          <mesh position={[0, h + 0.02, 0.05]} material={mats.panel}>
            <boxGeometry args={[pw - 0.1, 0.05, pd - 0.2]} />
          </mesh>
          {Array.from({ length: Math.max(1, Math.round(Math.max(pw, pd) / 1.4)) }, (_, i) => {
            const n = Math.max(1, Math.round(Math.max(pw, pd) / 1.4));
            const span = Math.max(pw, pd) - 0.6;
            const off = n === 1 ? 0 : -span / 2 + (i * span) / (n - 1);
            const alongX = pw >= pd;
            return (
              <mesh key={i} position={alongX ? [off, h + 0.38, -0.2] : [-0.2, h + 0.38, off]} rotation={alongX ? [-0.25, 0, 0] : [-0.25, Math.PI / 2, 0]} material={accent}>
                <boxGeometry args={[0.9, 0.5, 0.05]} />
              </mesh>
            );
          })}
        </group>
      );
    case 'terminal':
      return (
        <group position={[prop.x, 0, prop.z]} rotation={[0, rot, 0]}>
          <mesh position={[0, h / 2, 0]} material={mats.body}>
            <boxGeometry args={[pw, h, pd]} />
          </mesh>
          <mesh position={[0, h + 0.28, 0]} rotation={[-0.35, 0, 0]} material={accent}>
            <boxGeometry args={[Math.min(pw, 0.7), 0.5, 0.05]} />
          </mesh>
        </group>
      );
    case 'rack':
      return (
        <group position={[prop.x, 0, prop.z]}>
          <mesh position={[0, h / 2, 0]} material={mats.panel}>
            <boxGeometry args={[pw, h, pd]} />
          </mesh>
          <mesh position={[0, h + 0.03, 0]} material={mats.wallTop}>
            <boxGeometry args={[pw + 0.05, 0.05, pd + 0.05]} />
          </mesh>
        </group>
      );
    case 'tank':
      return (
        <group position={[prop.x, 0, prop.z]}>
          <mesh position={[0, h / 2, 0]} material={mats.pipe}>
            <cylinderGeometry args={[Math.min(pw, pd) / 2, Math.min(pw, pd) / 2, h, 20]} />
          </mesh>
          {[0.3, 0.6, 0.9].map((f) => (
            <mesh key={f} position={[0, h * f, 0]} material={mats.wallTop}>
              <torusGeometry args={[Math.min(pw, pd) / 2 + 0.01, 0.025, 6, 20]} />
            </mesh>
          ))}
          <mesh position={[0, h + 0.05, 0]} material={mats.wallTop}>
            <sphereGeometry args={[Math.min(pw, pd) / 2, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      );
    case 'bench':
      return (
        <group position={[prop.x, 0, prop.z]}>
          <mesh position={[0, h, 0]} material={mats.body}>
            <boxGeometry args={[pw, 0.07, pd]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[(s * (pw - 0.12)) / 2, h / 2, 0]} material={mats.panel}>
              <boxGeometry args={[0.07, h, pd - 0.1]} />
            </mesh>
          ))}
          {prop.room === 'life-support' && (
            <mesh position={[0, h + 0.3, -0.1]} rotation={[-0.2, 0, 0]} material={accent}>
              <boxGeometry args={[0.6, 0.4, 0.04]} />
            </mesh>
          )}
        </group>
      );
    case 'planter':
      return (
        <group position={[prop.x, 0, prop.z]}>
          <mesh position={[0, h / 2, 0]} material={mats.panel}>
            <boxGeometry args={[pw, h, pd]} />
          </mesh>
          <mesh position={[0, h + 0.01, 0]} material={mats.soil}>
            <boxGeometry args={[pw - 0.1, 0.03, pd - 0.1]} />
          </mesh>
        </group>
      );
    case 'crate':
      return (
        <group position={[prop.x, 0, prop.z]}>
          <mesh position={[0, h / 2, 0]} material={mats.body}>
            <boxGeometry args={[pw, h, pd]} />
          </mesh>
          <mesh position={[0, h * 0.8, 0]} material={mats.hazard}>
            <boxGeometry args={[pw + 0.02, 0.12, pd + 0.02]} />
          </mesh>
        </group>
      );
  }
};

/** Everything that never changes: floors, walls, props and wayfinding. Merged by material at mount. */
const StaticShell: React.FC<{ mats: InteriorMats }> = ({ mats }) => {
  return (
    <BatchedStatic>
      {ROOM_LIST.map(([id, r]) => (
        <mesh key={id} position={[cx(r), -0.05, cz(r)]} material={mats.floors[id]}>
          <boxGeometry args={[w(r), 0.1, d(r)]} />
        </mesh>
      ))}
      {CORRIDORS.map((c, i) => (
        <mesh key={i} position={[cx(c), -0.05, cz(c)]} material={mats.corridor}>
          <boxGeometry args={[w(c) + 0.02, 0.1, d(c) + 0.02]} />
        </mesh>
      ))}
      {WALLS.map((b, i) => (
        <group key={i} position={[cx(b), 0, cz(b)]}>
          <mesh position={[0, WALL_H / 2, 0]} material={mats.wall}>
            <boxGeometry args={[w(b), WALL_H, d(b)]} />
          </mesh>
          <mesh position={[0, WALL_H + 0.03, 0]} material={mats.wallTop}>
            <boxGeometry args={[w(b) + 0.04, 0.06, d(b) + 0.04]} />
          </mesh>
        </group>
      ))}
      {/* Doorway thresholds in the destination room's accent colour: wayfinding by light */}
      {[
        { x: 0, z: -3.95, room: 'mission-control', alongX: true },
        { x: 3.95, z: 0, room: 'power', alongX: false },
        { x: -3.95, z: 0, room: 'life-support', alongX: false },
        { x: 0, z: 3.95, room: 'greenhouse', alongX: true },
      ].map((t) => (
        <mesh key={t.room} position={[t.x, 0.012, t.z]} material={mats.accents[t.room]}>
          <boxGeometry args={t.alongX ? [2.3, 0.02, 0.12] : [0.12, 0.02, 2.3]} />
        </mesh>
      ))}
      {/* Hub floor emblem */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.accents.hub}>
        <ringGeometry args={[0.75, 0.85, 40]} />
      </mesh>
      {PROPS.map((p) => (
        <PropVisual key={p.id} prop={p} mats={mats} />
      ))}
      {/* Cable trunks: power room racks to console, and a pipe run along the greenhouse wall */}
      <mesh position={[7.2, 0.03, -1.6]} material={mats.cable}>
        <boxGeometry args={[4.2, 0.06, 0.16]} />
      </mesh>
      <mesh position={[9.0, 0.03, -0.8]} material={mats.cable}>
        <boxGeometry args={[0.16, 0.06, 1.6]} />
      </mesh>
      <mesh position={[-3.5, 0.5, 6.4]} rotation={[Math.PI / 2, 0, 0]} material={mats.pipe}>
        <cylinderGeometry args={[0.05, 0.05, 4.4, 8]} />
      </mesh>
    </BatchedStatic>
  );
};

/** Battery rack charge strips: lit segments follow the authoritative battery fraction. */
const BatteryRackLeds: React.FC<{ mission: MissionState; mats: InteriorMats }> = ({ mission, mats }) => {
  const frac = batteryChargeFraction(mission.resources);
  const lit = mission.modules['battery-bank'].status === 'offline' ? 0 : litSegments(frac);
  const racks = PROPS.filter((p) => p.id.startsWith('pw-rack'));
  const transforms = useMemo<PartTransform[]>(
    () => racks.flatMap((r) => Array.from({ length: 8 }, (_, s) => ({ p: [r.x, 0.35 + s * 0.14, r.z + 0.42] as [number, number, number], s: [0.8, 1, 1] as [number, number, number] }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const colors = useMemo(() => {
    const on = new THREE.Color('#10b981');
    const off = new THREE.Color('#1c1512');
    const warn = new THREE.Color(mission.modules['battery-bank'].status === 'warning' ? '#f59e0b' : '#10b981');
    const total = 24;
    return transforms.map((_, i) => (Math.round((i / transforms.length) * total) < lit ? (mission.modules['battery-bank'].status === 'warning' ? warn : on) : off));
  }, [transforms, lit, mission.modules]);
  return (
    <InstancedParts transforms={transforms} material={mats.led} colors={colors}>
      <boxGeometry args={[0.8, 0.07, 0.02]} />
    </InstancedParts>
  );
};

const GreenhouseDressing: React.FC<{ mission: MissionState; mats: InteriorMats; reducedMotion: boolean }> = ({ mission, mats, reducedMotion }) => {
  const { anim } = useModuleAnimation(mission.modules.greenhouse, reducedMotion);
  const plants = useMemo(() => {
    const rand = mulberry32(7);
    const transforms: PartTransform[] = [];
    for (const bed of PROPS.filter((p) => p.id.startsWith('gh-bed'))) {
      for (let i = 0; i < 16; i++) {
        const s = 0.7 + rand() * 0.7;
        transforms.push({ p: [bed.x - bed.w / 2 + 0.3 + i * ((bed.w - 0.6) / 15), 0.5 + 0.12 * s, bed.z + (rand() - 0.5) * 0.4], s: [s, s * 1.2, s], r: [0, rand() * 6, 0] });
      }
    }
    return transforms;
  }, []);
  const dry = useMemo(() => new THREE.Color('#5a4a30'), []);
  const lush = useMemo(() => new THREE.Color('#58a53a'), []);
  useFrame(() => {
    const g = anim.current.glow;
    mats.growLight.emissiveIntensity = g * 1.3;
    mats.plant.color.lerpColors(dry, lush, 0.25 + 0.75 * g);
  });
  return (
    <group>
      <InstancedParts transforms={plants} material={mats.plant}>
        <icosahedronGeometry args={[0.13, 0]} />
      </InstancedParts>
      {[5.7, 7.5].map((z) => (
        <mesh key={z} position={[-0.5, 1.15, z]} material={mats.growLight}>
          <boxGeometry args={[5.0, 0.06, 0.18]} />
        </mesh>
      ))}
    </group>
  );
};

/** Floor ring, bobbing chevron and the equipment's own status beacon. */
const Marker: React.FC<{ item: WorldInteractable; mission: MissionState; targeted: boolean; reducedMotion: boolean }> = ({ item, mission, targeted, reducedMotion }) => {
  const { anim } = useModuleAnimation(mission.modules[item.moduleId], reducedMotion);
  const chevron = React.useRef<THREE.Mesh>(null);
  const ring = React.useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (chevron.current) {
      chevron.current.position.y = 2.55 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 3) * 0.08);
      chevron.current.scale.setScalar(targeted ? 1.3 : 0.85);
    }
    if (ring.current) ring.current.scale.setScalar(targeted ? 1 + (reducedMotion ? 0 : 0.06 * Math.sin(clock.elapsedTime * 4)) : 0.85);
  });
  return (
    <group position={[item.position[0], 0, item.position[2]]}>
      <mesh ref={ring} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <ringGeometry args={[0.75, 0.85, 36]} />
        <meshBasicMaterial color={targeted ? '#7dd3fc' : '#94a3b8'} transparent opacity={targeted ? 0.95 : 0.18} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={chevron} visible={targeted} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.16, 0.26, 4]} />
        <meshBasicMaterial color={targeted ? '#7dd3fc' : '#cbd5e1'} toneMapped={false} />
      </mesh>
      {item.moduleId !== 'crew-habitat' && <StatusBeacon status={mission.modules[item.moduleId].status} anim={anim} height={1.9} selected={targeted} />}
    </group>
  );
};

interface InteriorWorldProps {
  mission: MissionState;
  targetedId: string | null;
  showMarkers: boolean;
  reducedMotion: boolean;
  stormRef: MutableRefObject<number>;
  serviceActive: boolean;
  selectedComponent: RecyclerComponentId | null;
  hintKey: string | null;
  onHotspot: (h: ServiceHotspot) => void;
}

const noop = () => {};

export const InteriorWorld: React.FC<InteriorWorldProps> = ({ mission, targetedId, showMarkers, reducedMotion, stormRef, serviceActive, selectedComponent, hintKey, onHotspot }) => {
  const mats = useInteriorMaterials();
  useEffect(() => {
    // Service cameras can sit outside a room. Fade its cutaway wall rather than
    // letting the wall hide the cartridge handles and tool tray.
    for (const material of [mats.wall, mats.wallTop]) {
      material.transparent = serviceActive;
      material.opacity = serviceActive ? .08 : 1;
      material.depthWrite = !serviceActive;
      material.needsUpdate = true;
    }
  }, [mats, serviceActive]);
  const layout = MODULE_LAYOUT['water-recycler'].position;
  const recyclerProps: HabitatModuleProps = {
    module: mission.modules['water-recycler'],
    resources: mission.resources,
    selected: false,
    reducedMotion,
    stormRef,
    onSelect: noop as (id: ModuleId) => void,
    onFocus: noop as (id: ModuleId) => void,
    service: mission.training
      ? { active: serviceActive, mission, selectedComponent, hintKey, onHotspot }
      : undefined,
  };
  return (
    <group>
      <HabitatDressing />
      <StaticShell mats={mats} />
      <BatteryRackLeds mission={mission} mats={mats} />
      <GreenhouseDressing mission={mission} mats={mats} reducedMotion={reducedMotion} />
      {/* The existing detailed water-recycler model, reused as-is (same hotspots, same training mechanics). */}
      <group position={RECYCLER_POSITION}>
        <group position={[-layout[0], 0, -layout[2]]}>
          <WaterRecycler {...recyclerProps} />
        </group>
      </group>
      {showMarkers && INTERACTABLES.map((i) => (
        <Marker key={i.id} item={i} mission={mission} targeted={targetedId === i.id} reducedMotion={reducedMotion} />
      ))}
      {/* Room lighting: one soft point light per room, in its accent colour, no shadows */}
      {ROOM_LIST.map(([id, r]) => (
        <pointLight key={id} position={[cx(r), 3.4, cz(r)]} color={tint(r.accent)} intensity={id === 'hub' ? 14 : 24} distance={11} decay={1.6} />
      ))}
      <directionalLight position={[-8, 18, 7]} color="#ffe0ba" intensity={1.5} />
      <hemisphereLight args={['#dfe7ef', '#3a312c', 0.85]} />
      <group userData={NO_BATCH} />
    </group>
  );
};

export { ROOMS };
