'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useModuleAnimation } from '../hooks/useModuleAnimation';
import { useMaterials } from '../components/HabitatMaterials';
import { ModuleShell } from '../components/ModuleShell';
import { NO_BATCH } from '../components/BatchedStatic';
import { InstancedParts, PartTransform } from '../components/InstancedParts';
import { Hotspot } from '../components/Hotspot';
import { hotspotKey, ServiceHotspot } from '../utils/serviceInteractions';
import { getRecyclerOperation, NOMINAL_RECOVERY_LPH } from '@/simulation/training/recycler';
import { REPLACEABLE_IDS, type ReplaceableId, type ToolId } from '@/simulation/training/types';
import { HabitatModuleProps } from './types';

const SLOT_X: Record<ReplaceableId, number> = { 'pump-cartridge': -0.55, 'filter-cartridge': -0.1, 'flow-sensor': 0.35 };
const BAY_Z = 0.3;
const FRONT_Z = 0.71;
const DOOR_OPEN = -2.3;
const TOOLS: { id: ToolId; x: number; label: string }[] = [
  { id: 'hatch-key', x: 0.0, label: 'Hatch key' },
  { id: 'retainer-driver', x: 0.32, label: 'Retainer driver' },
  { id: 'sample-kit', x: 0.64, label: 'Sample kit' },
];
const LOCKED = new THREE.Color('#f59e0b');
const RELEASED = new THREE.Color('#22c55e');

const damp = (current: number, target: number, dt: number, rate = 6) => current + (target - current) * (1 - Math.exp(-dt * rate));

/** Cartridge visual: dark worn unit for the original, bright "new" unit for spares. */
const Cartridge: React.FC<{ part: ReplaceableId; fresh: boolean }> = ({ part, fresh }) => {
  const m = useMaterials();
  const body = fresh ? m.hull : m.darkSteel;
  const trim = fresh ? m.waterPipe : m.trim;
  if (part === 'pump-cartridge') {
    return (
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={body}>
          <cylinderGeometry args={[0.17, 0.17, 0.5, 20]} />
        </mesh>
        <mesh position={[0, 0, 0.26]} rotation={[Math.PI / 2, 0, 0]} material={trim}>
          <cylinderGeometry args={[0.13, 0.13, 0.04, 20]} />
        </mesh>
        <mesh position={[0.17, 0, 0]} material={m.hazard}>
          <boxGeometry args={[0.05, 0.08, 0.14]} />
        </mesh>
      </group>
    );
  }
  if (part === 'filter-cartridge') {
    return (
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={fresh ? m.hull : m.pipe}>
          <cylinderGeometry args={[0.19, 0.19, 0.5, 22]} />
        </mesh>
        {[-0.15, 0, 0.15].map((z) => (
          <mesh key={z} position={[0, 0, z]} material={trim}>
            <torusGeometry args={[0.195, 0.02, 6, 22]} />
          </mesh>
        ))}
        <mesh position={[0.19, 0, 0]} material={m.hazard}>
          <boxGeometry args={[0.05, 0.08, 0.14]} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh material={body}>
        <boxGeometry args={[0.3, 0.3, 0.46]} />
      </mesh>
      <mesh position={[0, 0.02, 0.235]} material={m.windowDark}>
        <boxGeometry args={[0.2, 0.12, 0.01]} />
      </mesh>
      <mesh position={[0.15, 0, 0]} material={m.hazard}>
        <boxGeometry args={[0.05, 0.08, 0.14]} />
      </mesh>
    </group>
  );
};

export const WaterRecycler: React.FC<HabitatModuleProps> = (props) => {
  const { module, reducedMotion, service } = props;
  const m = useMaterials();
  const { anim, interior, statusLed } = useModuleAnimation(module, reducedMotion);
  const serviceActive = Boolean(service?.active);
  const training = service?.mission.training;
  const proc = training?.recycler.procedure;
  const hint = service?.hintKey ?? null;
  const emit = (h: ServiceHotspot) => () => service?.onHotspot(h);
  const isHint = (h: ServiceHotspot) => hint === hotspotKey(h);
  const isSelected = (id: string) => service?.selectedComponent === id;

  // Flow visibility: visual cue only, from the same recovery value the engine uses.
  const flowRatio = service ? getRecyclerOperation(service.mission).recoveryLph / NOMINAL_RECOVERY_LPH : anim.current.activity;

  const door = useRef<THREE.Group>(null);
  const cartridges = useRef<Record<ReplaceableId, THREE.Group | null>>({ 'pump-cartridge': null, 'filter-cartridge': null, 'flow-sensor': null });
  const clipMeshes = useRef<Record<ReplaceableId, THREE.Mesh | null>>({ 'pump-cartridge': null, 'filter-cartridge': null, 'flow-sensor': null });
  const held = useRef<THREE.Group>(null);
  const slide = useRef<Record<ReplaceableId, number>>({ 'pump-cartridge': 0, 'filter-cartridge': 0, 'flow-sensor': 0 });
  const doorAngle = useRef(0);
  const heldRot = useRef(0);
  const clipMaterials = useMemo(
    () => Object.fromEntries(REPLACEABLE_IDS.map((id) => [id, new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: new THREE.Color('#f59e0b'), emissiveIntensity: 0.5, roughness: 0.4 })])) as Record<ReplaceableId, THREE.MeshStandardMaterial>,
    [],
  );
  const panelLed = useMemo(() => new THREE.MeshBasicMaterial({ color: '#334155', toneMapped: false }), []);
  const readyLed = useMemo(() => new THREE.MeshBasicMaterial({ color: '#334155', toneMapped: false }), []);
  useEffect(
    () => () => {
      Object.values(clipMaterials).forEach((x) => x.dispose());
      panelLed.dispose();
      readyLed.dispose();
    },
    [clipMaterials, panelLed, readyLed],
  );

  const procRef = useRef(proc);
  useEffect(() => {
    procRef.current = proc;
  });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const p = procRef.current;
    const rate = reducedMotion ? 100 : 5;
    doorAngle.current = damp(doorAngle.current, p?.hatchOpen ? DOOR_OPEN : 0, dt, rate);
    if (door.current) door.current.rotation.y = doorAngle.current;
    for (const id of REPLACEABLE_IDS) {
      const occ = p?.slots[id].occupant ?? 'original';
      const released = p?.slots[id].retainers === 'released';
      const target = occ === 'empty' ? 1 : released ? 0.28 : 0;
      slide.current[id] = damp(slide.current[id], target, dt, rate);
      const g = cartridges.current[id];
      if (g) {
        g.position.z = BAY_Z + slide.current[id] * 0.6;
        g.visible = !(occ === 'empty' && slide.current[id] > 0.97);
        g.position.y = 0.46 + (occ === 'empty' ? slide.current[id] * 0.05 : 0);
      }
      clipMaterials[id].color.copy(released ? RELEASED : LOCKED);
      clipMaterials[id].emissive.copy(released ? RELEASED : LOCKED);
      const clip = clipMeshes.current[id];
      if (clip) clip.rotation.x = damp(clip.rotation.x, released ? 0.9 : 0, dt, rate);
    }
    if (held.current) {
      held.current.visible = Boolean(p?.held);
      heldRot.current = damp(heldRot.current, THREE.MathUtils.degToRad(p?.held?.orientation ?? 0), dt, rate);
      // Rotate along the shortest path when wrapping 270 -> 0.
      if (p?.held && Math.abs(heldRot.current - THREE.MathUtils.degToRad(p.held.orientation)) > Math.PI) heldRot.current = THREE.MathUtils.degToRad(p.held.orientation);
      held.current.rotation.z = heldRot.current;
    }
    panelLed.color.set(p?.maintenanceMode ? '#f59e0b' : '#334155');
    readyLed.color.set(p?.testReady ? '#22c55e' : '#334155');
  });

  const ribs = useMemo<PartTransform[]>(() => [0.4, 0.75, 1.1, 1.45].map((y) => ({ p: [0, y, -0.55], r: [Math.PI / 2, 0, 0] })), []);
  const flowPoints = useMemo(
    () => [new THREE.Vector3(-0.8, 0.95, -0.55), new THREE.Vector3(-0.4, 0.95, -0.55), new THREE.Vector3(0, 1.0, -0.55), new THREE.Vector3(0.4, 0.3, -0.55), new THREE.Vector3(0.85, 0.3, -0.55)],
    [],
  );
  const flowCurve = useMemo(() => new THREE.CatmullRomCurve3(flowPoints, false, 'centripetal'), [flowPoints]);
  const flowGeometry = useMemo(() => new THREE.TubeGeometry(flowCurve, 40, 0.035, 8, false), [flowCurve]);
  useEffect(() => () => flowGeometry.dispose(), [flowGeometry]);
  const flowMesh = useRef<THREE.InstancedMesh>(null);
  const flowPhase = useRef(0);
  const flowRef = useRef(flowRatio);
  useEffect(() => {
    flowRef.current = flowRatio;
  });
  const flowDummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, delta) => {
    const mesh = flowMesh.current;
    if (!mesh) return;
    const speed = reducedMotion ? 0 : flowRef.current;
    mesh.visible = flowRef.current > 0.03;
    flowPhase.current = (flowPhase.current + Math.min(delta, 0.1) * 0.15 * speed) % 1;
    for (let i = 0; i < 8; i++) {
      flowCurve.getPointAt((flowPhase.current + i / 8) % 1, flowDummy.position);
      flowDummy.updateMatrix();
      mesh.setMatrixAt(i, flowDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <ModuleShell {...props} anim={anim} interactive={!serviceActive}>
      {/* The service front faces west (-X), the one side free of pipes, tunnels and neighbours. */}
      <group rotation={[0, -Math.PI / 2, 0]}>
      {/* Foundation */}
      <mesh position={[0.3, 0.07, 0.2]} receiveShadow castShadow material={m.slab}>
        <boxGeometry args={[3.2, 0.14, 2.5]} />
      </mesh>

      {/* Back row: wastewater tank -> treatment column -> clean tank */}
      <mesh position={[-0.8, 0.6, -0.55]} castShadow receiveShadow material={m.pipe}>
        <cylinderGeometry args={[0.32, 0.32, 0.9, 24]} />
      </mesh>
      <mesh position={[-0.8, 1.05, -0.55]} castShadow material={m.pipe}>
        <sphereGeometry args={[0.32, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, 0.95, -0.55]} castShadow receiveShadow material={m.metal}>
        <cylinderGeometry args={[0.27, 0.27, 1.6, 24]} />
      </mesh>
      <mesh position={[0, 1.75, -0.55]} castShadow material={m.metal}>
        <sphereGeometry args={[0.27, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <InstancedParts transforms={ribs} material={m.trim}>
        <torusGeometry args={[0.285, 0.025, 6, 24]} />
      </InstancedParts>
      <mesh position={[0.85, 0.55, -0.55]} castShadow receiveShadow material={m.waterPipe}>
        <cylinderGeometry args={[0.32, 0.32, 0.8, 24]} />
      </mesh>
      <mesh position={[0.85, 0.95, -0.55]} castShadow material={m.waterPipe}>
        <sphereGeometry args={[0.32, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0.85, 0.5, -0.22]} material={interior}>
        <boxGeometry args={[0.06, 0.55, 0.02]} />
      </mesh>
      {/* Water path pipes */}
      <mesh position={[-0.4, 0.95, -0.55]} rotation={[0, 0, Math.PI / 2]} material={m.waterPipe}>
        <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
      </mesh>
      <mesh position={[-0.8, 0.3, -0.2]} rotation={[Math.PI / 2, 0, 0]} material={m.waterPipe}>
        <cylinderGeometry args={[0.045, 0.045, 0.7, 8]} />
      </mesh>
      <mesh position={[0.45, 0.3, -0.55]} rotation={[0, 0, Math.PI / 2]} material={m.waterPipe}>
        <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
      </mesh>
      {/* Circulation indicator pulses on the output path */}
      <instancedMesh ref={flowMesh} args={[undefined, undefined, 8]} frustumCulled={false}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshBasicMaterial color="#bae6fd" toneMapped={false} />
      </instancedMesh>
      <mesh geometry={flowGeometry} visible={false} />

      {/* Service cabinet shell (open to the front) */}
      <mesh position={[-0.05, 0.47, 0.35]} castShadow receiveShadow material={m.hull}>
        <boxGeometry args={[1.95, 0.05, 0.75]} />
      </mesh>
      <mesh position={[-0.05, 0.93, 0.35]} castShadow receiveShadow material={m.hull}>
        <boxGeometry args={[1.95, 0.05, 0.75]} />
      </mesh>
      <mesh position={[-0.05, 0.7, 0.0]} castShadow material={m.windowDark}>
        <boxGeometry args={[1.95, 0.46, 0.04]} />
      </mesh>
      {[-1.0, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.7, 0.35]} castShadow receiveShadow material={m.hull}>
          <boxGeometry args={[0.05, 0.5, 0.75]} />
        </mesh>
      ))}
      {REPLACEABLE_IDS.map((id) => (
        <mesh key={id} position={[SLOT_X[id], 0.6, 0.37]} rotation={[Math.PI / 2, 0, 0]} material={m.darkSteel}>
          <boxGeometry args={[0.36, 0.5, 0.02]} />
        </mesh>
      ))}

      {/* Pressure gauges on the cabinet roof */}
      <mesh position={[-0.2, 1.0, 0.5]} material={m.darkSteel}>
        <boxGeometry args={[0.7, 0.1, 0.16]} />
      </mesh>
      {[-0.4, -0.05].map((x) => (
        <mesh key={x} position={[x, 1.12, 0.58]} rotation={[Math.PI / 2, 0, 0]} material={m.hull}>
          <cylinderGeometry args={[0.09, 0.09, 0.03, 20]} />
        </mesh>
      ))}

      {/* Port lights on the door: one per bay (door closed) */}
      <group ref={door} position={[-0.98, 0.7, FRONT_Z]} userData={NO_BATCH}>
        <mesh position={[0.97, 0, 0]} castShadow material={m.hull}>
          <boxGeometry args={[1.95, 0.46, 0.04]} />
        </mesh>
        {REPLACEABLE_IDS.map((id) => (
          <mesh key={id} position={[SLOT_X[id] + 1.03, 0, 0.025]} material={interior}>
            <circleGeometry args={[0.05, 14]} />
          </mesh>
        ))}
        <mesh position={[1.7, 0, 0.03]} material={m.hazard}>
          <boxGeometry args={[0.12, 0.05, 0.03]} />
        </mesh>
      </group>

      {/* Replaceable cartridges, retainers and pull handles */}
      {REPLACEABLE_IDS.map((id) => {
        const occupant = proc?.slots[id].occupant ?? 'original';
        return (
          <group key={id} position={[SLOT_X[id], 0, 0]} userData={NO_BATCH}>
            <group ref={(g) => { cartridges.current[id] = g; }} position={[0, 0.46, BAY_Z]}>
              <Cartridge part={id} fresh={occupant === 'spare'} />
              {occupant === 'spare' && (
                <mesh position={[0, 0.2, 0.1]} material={m.hazard}>
                  <boxGeometry args={[0.1, 0.02, 0.1]} />
                </mesh>
              )}
              <mesh position={[0, 0, 0.3]} rotation={[0, 0, Math.PI / 2]} material={m.metal}>
                <cylinderGeometry args={[0.015, 0.015, 0.14, 8]} />
              </mesh>
              {serviceActive && (
                <>
                  <Hotspot
                    size={[0.36, 0.36, 0.5]}
                    position={[0, 0, 0]}
                    label={`${id === 'pump-cartridge' ? 'Pump cartridge' : id === 'filter-cartridge' ? 'Filter cartridge' : 'Flow sensor module'}`}
                    enabled={serviceActive && Boolean(proc?.hatchOpen) && occupant !== 'empty'}
                    active={isSelected(id)}
                    onActivate={emit({ kind: 'component', id })}
                  />
                  <Hotspot
                    size={[0.2, 0.12, 0.14]}
                    position={[0, 0, 0.3]}
                    label="Pull handle: remove cartridge"
                    enabled={serviceActive && Boolean(proc?.hatchOpen) && occupant !== 'empty'}
                    hint={isHint({ kind: 'pull-handle', slot: id })}
                    onActivate={emit({ kind: 'pull-handle', slot: id })}
                  />
                </>
              )}
            </group>
            <mesh ref={(mesh) => { clipMeshes.current[id] = mesh; }} position={[0, 0.88, 0.58]} material={clipMaterials[id]}>
              <boxGeometry args={[0.2, 0.05, 0.1]} />
            </mesh>
            {serviceActive && (
              <>
                <Hotspot
                  size={[0.26, 0.12, 0.16]}
                  position={[0, 0.88, 0.58]}
                  label={proc?.slots[id].retainers === 'locked' ? 'Retainer clip: release' : 'Retainer clip: lock'}
                  enabled={Boolean(proc?.hatchOpen)}
                  hint={isHint({ kind: 'retainer', slot: id })}
                  onActivate={emit({ kind: 'retainer', slot: id })}
                />
                <Hotspot
                  size={[0.4, 0.4, 0.5]}
                  position={[0, 0.46, BAY_Z + 0.2]}
                  label={`${id === 'pump-cartridge' ? 'Pump' : id === 'filter-cartridge' ? 'Filter' : 'Sensor'} bay${proc?.held ? ': install held part' : ''}`}
                  enabled={Boolean(proc?.hatchOpen) && occupant === 'empty'}
                  hint={isHint({ kind: 'bay', slot: id })}
                  onActivate={emit({ kind: 'bay', slot: id })}
                />
                {/* Door-closed port light: inspect the bay's status without opening */}
                <Hotspot
                  size={[0.3, 0.3, 0.1]}
                  position={[0, 0.7, FRONT_Z + 0.07]}
                  label={`${id === 'pump-cartridge' ? 'Pump' : id === 'filter-cartridge' ? 'Filter' : 'Flow sensor'} status port`}
                  enabled={!proc?.hatchOpen}
                  active={isSelected(id)}
                  onActivate={emit({ kind: 'component', id })}
                />
              </>
            )}
          </group>
        );
      })}

      {/* Hatch handle hotspot */}
      {serviceActive && (
        <Hotspot
          size={[0.3, 0.3, 0.2]}
          position={[0.9, 0.7, FRONT_Z + 0.1]}
          label={proc?.hatchOpen ? 'Service hatch: close' : 'Service hatch: open'}
          enabled
          hint={isHint({ kind: 'hatch' })}
          onActivate={emit({ kind: 'hatch' })}
        />
      )}

      {/* Gauges (inspect: pressure) */}
      {serviceActive && (
        <Hotspot
          size={[0.8, 0.3, 0.2]}
          position={[-0.22, 1.12, 0.58]}
          label="Pressure gauges"
          enabled
          active={isSelected('filter-cartridge')}
          onActivate={emit({ kind: 'component', id: 'filter-cartridge' })}
        />
      )}

      {/* Static component hotspots */}
      {serviceActive && (
        <>
          <Hotspot size={[0.7, 1.1, 0.7]} position={[-0.8, 0.65, -0.55]} label="Wastewater input tank" enabled active={isSelected('wastewater-tank')} onActivate={emit({ kind: 'component', id: 'wastewater-tank' })} />
          <Hotspot size={[0.6, 1.8, 0.6]} position={[0, 0.95, -0.55]} label="Treatment stage" enabled active={isSelected('treatment-stage')} onActivate={emit({ kind: 'component', id: 'treatment-stage' })} />
          <Hotspot size={[0.7, 1.0, 0.7]} position={[0.85, 0.6, -0.55]} label="Clean-water output tank" enabled active={isSelected('clean-tank')} onActivate={emit({ kind: 'component', id: 'clean-tank' })} />
        </>
      )}

      {/* Control console */}
      <group position={[1.5, 0, 0.7]}>
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow material={m.hull}>
          <boxGeometry args={[0.55, 0.6, 0.35]} />
        </mesh>
        <mesh position={[0, 0.68, -0.02]} rotation={[-0.5, 0, 0]} castShadow material={m.darkSteel}>
          <boxGeometry args={[0.55, 0.3, 0.06]} />
        </mesh>
        <mesh position={[0, 0.69, 0.02]} rotation={[-0.5, 0, 0]} material={m.windowDark}>
          <boxGeometry args={[0.4, 0.18, 0.01]} />
        </mesh>
        <mesh position={[-0.15, 0.48, 0.19]} material={panelLed}>
          <boxGeometry args={[0.07, 0.07, 0.02]} />
        </mesh>
        <mesh position={[0, 0.48, 0.19]} material={readyLed}>
          <boxGeometry args={[0.07, 0.07, 0.02]} />
        </mesh>
        <mesh position={[0.15, 0.48, 0.19]} material={statusLed}>
          <boxGeometry args={[0.07, 0.07, 0.02]} />
        </mesh>
        {serviceActive && (
          <Hotspot
            size={[0.7, 0.9, 0.5]}
            position={[0, 0.45, 0]}
            label="Control panel"
            enabled
            hint={isHint({ kind: 'control-panel' })}
            active={isSelected('control-panel')}
            onActivate={emit({ kind: 'control-panel' })}
          />
        )}
      </group>

      {/* Workbench: spare parts tray and tool rack */}
      <group position={[-1.45, 0, 1.95]}>
        <mesh position={[0, 0.4, 0]} castShadow receiveShadow material={m.darkSteel}>
          <boxGeometry args={[2.0, 0.06, 0.6]} />
        </mesh>
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} position={[x, 0.2, 0]} material={m.darkSteel}>
            <boxGeometry args={[0.06, 0.4, 0.5]} />
          </mesh>
        ))}
        {REPLACEABLE_IDS.map((id, i) => {
          const count = service
            ? id === 'pump-cartridge'
              ? service.mission.resources.sparePumps
              : id === 'filter-cartridge'
              ? service.mission.training!.inventory.filterCartridges
              : service.mission.training!.inventory.flowSensors
            : 1;
          const x = -0.78 + i * 0.36;
          return (
            <group key={id} position={[x, 0.58, 0]}>
              {count > 0 && (
                <group scale={0.8} rotation={[0, Math.PI / 2 * 0, 0]}>
                  <Cartridge part={id} fresh />
                </group>
              )}
              {serviceActive && (
                <Hotspot
                  size={[0.34, 0.32, 0.5]}
                  label={count > 0 ? `Spare ${id === 'pump-cartridge' ? 'pump cartridge' : id === 'filter-cartridge' ? 'filter cartridge' : 'flow sensor'} (${count} left)` : 'Spare used up'}
                  enabled
                  hint={isHint({ kind: 'spare', part: id })}
                  onActivate={emit({ kind: 'spare', part: id })}
                />
              )}
            </group>
          );
        })}
        {TOOLS.map((tool) => (
          <group key={tool.id} position={[0.45 + tool.x * 0.9 - 0.0, 0.46, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={tool.id === 'sample-kit' ? m.pipe : m.metal}>
              <cylinderGeometry args={[0.025, 0.025, 0.24, 8]} />
            </mesh>
            <mesh position={[tool.id === 'hatch-key' ? 0.12 : -0.12, 0, 0]} material={tool.id === 'retainer-driver' ? m.hazard : m.darkSteel}>
              <boxGeometry args={[0.07, 0.07, 0.07]} />
            </mesh>
            {serviceActive && (
              <Hotspot
                size={[0.3, 0.2, 0.2]}
                label={tool.label}
                enabled
                active={proc?.tool === tool.id}
                hint={isHint({ kind: 'tool', tool: tool.id })}
                onActivate={emit({ kind: 'tool', tool: tool.id })}
              />
            )}
          </group>
        ))}
      </group>

      {/* Part in hand: floats in front of the bay; click to inspect, then rotate to align the keying notch */}
      <group ref={held} position={[0.1, 1.15, 1.25]} visible={false} userData={NO_BATCH}>
        {proc?.held && <Cartridge part={proc.held.part} fresh />}
        {serviceActive && proc?.held && (
          <Hotspot
            size={[0.5, 0.5, 0.6]}
            label={proc.held.inspected ? `Rotate part (keying notch at ${proc.held.orientation}°)` : 'Inspect part label'}
            enabled
            hint={isHint({ kind: 'held-part' })}
            onActivate={emit({ kind: 'held-part' })}
          />
        )}
      </group>
      </group>
    </ModuleShell>
  );
};
