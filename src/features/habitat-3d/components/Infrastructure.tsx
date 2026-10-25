'use client';

import React, { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MissionState } from '@/simulation/types';
import { AIRLOCK_AZIMUTH, Vec3 } from '../constants/layout';
import { useMaterials } from './HabitatMaterials';
import { InstancedParts, PartTransform } from './InstancedParts';
import { resolveStatusVisual } from '../utils/visualState';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

const POWER_PATH: THREE.Vector3[] = [
  V(1.0, 0.1, -3.85),
  V(1.9, 0.08, -3.2),
  V(2.35, 0.08, -1.2),
  V(2.45, 0.08, 0.5),
  V(2.25, 0.08, 1.9),
  V(2.4, 0.08, 3.1),
  V(2.4, 0.2, 3.7),
];
const WATER_PATH: THREE.Vector3[] = [V(-2.1, 0.3, -1.55), V(-1.9, 0.2, -1.45), V(-1.65, 0.2, -1.35), V(-1.42, 0.3, -1.25)];
const HUMIDITY_PATH: THREE.Vector3[] = [V(-3.2, 0.2, 0.25), V(-3.3, 0.14, -0.5), V(-3.1, 0.14, -1.3), V(-3.0, 0.3, -1.25)];
const BATTERY_BUS_PATH: THREE.Vector3[] = [V(-0.7, 0.2, 3.25), V(-0.75, 0.08, 2.6), V(-0.7, 0.08, 2.2), V(-0.65, 0.3, 1.95)];

/** Tunnel endpoints: from the habitat port to the near wall of each connected module. */
const TUNNELS: { from: Vec3; to: Vec3; radius: number }[] = [
  { from: [1.55, 0.7, -0.98], to: [2.5, 0.7, -1.55], radius: 0.34 },
  { from: [1.64, 0.7, 0.84], to: [2.85, 0.7, 1.45], radius: 0.34 },
  { from: [-1.72, 0.7, 0.64], to: [-2.7, 0.7, 0.95], radius: 0.34 },
];

const aspect = (from: THREE.Vector3, to: THREE.Vector3) => {
  const dir = to.clone().sub(from);
  const length = dir.length();
  dir.normalize();
  return { length, quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir), mid: from.clone().add(to).multiplyScalar(0.5), dir };
};

const Tunnel: React.FC<{ from: Vec3; to: Vec3; radius: number }> = ({ from, to, radius }) => {
  const m = useMaterials();
  const { length, quaternion, mid } = useMemo(() => aspect(new THREE.Vector3(...from), new THREE.Vector3(...to)), [from, to]);
  const ribs = useMemo<PartTransform[]>(() => {
    const n = Math.max(2, Math.floor(length / 0.28));
    return Array.from({ length: n }, (_, i) => ({ p: [0, -length / 2 + ((i + 0.5) * length) / n, 0] as Vec3, r: [Math.PI / 2, 0, 0] as Vec3 }));
  }, [length]);
  return (
    <group position={mid} quaternion={quaternion}>
      <mesh castShadow receiveShadow material={m.hull}>
        <cylinderGeometry args={[radius, radius, length, 18]} />
      </mesh>
      <InstancedParts transforms={ribs} material={m.trim} castShadow>
        <torusGeometry args={[radius + 0.008, 0.022, 6, 18]} />
      </InstancedParts>
    </group>
  );
};

interface TubeProps {
  curve: THREE.CatmullRomCurve3;
  radius: number;
  material: THREE.Material;
}

const Tube: React.FC<TubeProps> = ({ curve, radius, material }) => {
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 48, radius, 8, false), [curve, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
};

const pulseDummy = new THREE.Object3D();
const pulsePoint = new THREE.Vector3();

/** Small lit packets travelling along a line; speed follows the connected module's status. */
const FlowPulses: React.FC<{
  curve: THREE.CatmullRomCurve3;
  status: string;
  color: string;
  size: number;
  reducedMotion: boolean;
  count?: number;
}> = ({ curve, status, color, size, reducedMotion, count = 7 }) => {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const speed = useRef(resolveStatusVisual(status).activity);
  const target = useRef(speed.current);
  const phase = useRef(0);
  useEffect(() => {
    target.current = resolveStatusVisual(status).activity;
  });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    speed.current += (target.current - speed.current) * (1 - Math.exp(-dt * 3));
    const m = mesh.current;
    if (!m) return;
    const active = speed.current > 0.03;
    m.visible = active;
    if (!active) return;
    if (!reducedMotion) phase.current = (phase.current + dt * 0.12 * speed.current) % 1;
    for (let i = 0; i < count; i++) {
      const u = (phase.current + i / count) % 1;
      curve.getPointAt(u, pulsePoint);
      pulseDummy.position.copy(pulsePoint);
      pulseDummy.scale.setScalar(0.6 + 0.4 * speed.current);
      pulseDummy.updateMatrix();
      m.setMatrixAt(i, pulseDummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[size, 8, 6]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  );
};

/** Service walkway: grated slabs from the airlock toward the battery bank. */
function useWalkway(): PartTransform[] {
  return useMemo(() => {
    const start = new THREE.Vector3(Math.sin(AIRLOCK_AZIMUTH) * 3.0, 0.03, Math.cos(AIRLOCK_AZIMUTH) * 3.0);
    const end = new THREE.Vector3(0.9, 0.03, 3.0);
    const curve = new THREE.QuadraticBezierCurve3(start, V(2.0, 0.03, 3.1), end);
    const n = 9;
    return Array.from({ length: n }, (_, i) => {
      const u = i / (n - 1);
      const p = curve.getPoint(u);
      const t = curve.getTangent(u);
      return { p: [p.x, p.y, p.z] as Vec3, r: [0, Math.atan2(t.x, t.z), 0] as Vec3 };
    });
  }, []);
}

interface InfrastructureProps {
  modules: MissionState['modules'];
  reducedMotion: boolean;
  stormRef: MutableRefObject<number>;
}

/**
 * Pressurised connectors, resource lines, power cabling and the service
 * walkway. Static geometry; only the flow packets respond to module status.
 */
export const Infrastructure: React.FC<InfrastructureProps> = ({ modules, reducedMotion }) => {
  const m = useMaterials();
  const powerCurve = useMemo(() => new THREE.CatmullRomCurve3(POWER_PATH, false, 'centripetal'), []);
  const waterCurve = useMemo(() => new THREE.CatmullRomCurve3(WATER_PATH, false, 'centripetal'), []);
  const humidityCurve = useMemo(() => new THREE.CatmullRomCurve3(HUMIDITY_PATH, false, 'centripetal'), []);
  const busCurve = useMemo(() => new THREE.CatmullRomCurve3(BATTERY_BUS_PATH, false, 'centripetal'), []);
  const walkway = useWalkway();

  const powerSupports = useMemo<PartTransform[]>(
    () => Array.from({ length: 7 }, (_, i) => {
      const p = powerCurve.getPointAt((i + 0.5) / 7);
      return { p: [p.x, 0.03, p.z] as Vec3 };
    }),
    [powerCurve],
  );

  return (
    <group>
      {TUNNELS.map((t, i) => (
        <Tunnel key={i} {...t} />
      ))}

      {/* Main power bus: solar array to battery bank, then to the habitat */}
      <Tube curve={powerCurve} radius={0.05} material={m.cable} />
      <Tube curve={busCurve} radius={0.045} material={m.cable} />
      <InstancedParts transforms={powerSupports} material={m.darkSteel}>
        <boxGeometry args={[0.22, 0.06, 0.16]} />
      </InstancedParts>
      <FlowPulses curve={powerCurve} status={modules['solar-array']?.status ?? 'offline'} color="#fcd34d" size={0.045} reducedMotion={reducedMotion} />
      <FlowPulses curve={busCurve} status={modules['battery-bank']?.status ?? 'offline'} color="#fcd34d" size={0.04} reducedMotion={reducedMotion} count={4} />

      {/* Water loop: recycler to habitat, humidity return from life support */}
      <Tube curve={waterCurve} radius={0.07} material={m.waterPipe} />
      <FlowPulses curve={waterCurve} status={modules['water-recycler']?.status ?? 'offline'} color="#7dd3fc" size={0.06} reducedMotion={reducedMotion} count={4} />
      <Tube curve={humidityCurve} radius={0.06} material={m.pipe} />

      {/* Service walkway */}
      <InstancedParts transforms={walkway} material={m.darkSteel} receiveShadow>
        <boxGeometry args={[0.7, 0.05, 0.42]} />
      </InstancedParts>
    </group>
  );
};

