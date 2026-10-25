'use client';

import React, { MutableRefObject, useRef, useState } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { ModuleId, ModuleState } from '@/simulation/types';
import { MODULE_LAYOUT } from '../constants/layout';
import { ModuleAnimation } from '../hooks/useModuleAnimation';
import { StatusBeacon } from './StatusBeacon';
import { SelectionIndicator } from './SelectionIndicator';
import { ModuleLabel } from './ModuleLabel';
import { BatchedStatic } from './BatchedStatic';

/** Pointer travel (px) above which a click is treated as an orbit drag, not a selection. */
const DRAG_THRESHOLD_PX = 5;

interface ModuleShellProps {
  module: ModuleState;
  anim: MutableRefObject<ModuleAnimation>;
  selected: boolean;
  reducedMotion: boolean;
  /** False while the learner is inside an equipment service view. */
  interactive?: boolean;
  onSelect: (id: ModuleId) => void;
  onFocus: (id: ModuleId) => void;
  children: React.ReactNode;
}

/**
 * One interaction group per module: a single set of handlers, an invisible
 * forgiving hit proxy, hover/selection feedback, beacon and repair indicator.
 * Decorative meshes inside never carry their own handlers.
 */
export const ModuleShell: React.FC<ModuleShellProps> = ({
  module,
  anim,
  selected,
  reducedMotion,
  interactive = true,
  onSelect,
  onFocus,
  children,
}) => {
  const layout = MODULE_LAYOUT[module.id];
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && interactive, 'pointer', 'auto');

  const [hx, hy, hz] = layout.hitSize;
  const repairing = module.status === 'repairing';

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
  };
  const handlePointerOut = () => setHovered(false);
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > DRAG_THRESHOLD_PX) return;
    e.stopPropagation();
    onSelect(module.id);
  };
  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > DRAG_THRESHOLD_PX) return;
    e.stopPropagation();
    onSelect(module.id);
    onFocus(module.id);
  };

  return (
    <group
      name={`module-${module.id}`}
      position={layout.position}
      onPointerOver={interactive ? handlePointerOver : undefined}
      onPointerOut={interactive ? handlePointerOut : undefined}
      onClick={interactive ? handleClick : undefined}
      onDoubleClick={interactive ? handleDoubleClick : undefined}
    >
      <BatchedStatic>{children}</BatchedStatic>

      {/* Hit proxy: invisible but raycastable. */}
      <mesh position={[0, hy / 2, 0]} visible={false}>
        {layout.hitShape === 'cylinder' ? (
          <cylinderGeometry args={[hx / 2, hx / 2, hy, 20]} />
        ) : (
          <boxGeometry args={[hx, hy, hz]} />
        )}
        <meshBasicMaterial />
      </mesh>

      {interactive && <StatusBeacon status={module.status} anim={anim} height={layout.beaconHeight} selected={selected} />}

      {interactive && (selected || hovered) && (
        <SelectionIndicator
          radiusX={hx / 2 + 0.15}
          radiusZ={(layout.hitShape === 'cylinder' ? hx : hz) / 2 + 0.15}
          variant={selected ? 'selected' : 'hover'}
          reducedMotion={reducedMotion}
        />
      )}

      {repairing && interactive && <RepairScan radiusX={hx / 2} radiusZ={(layout.hitShape === 'cylinder' ? hx : hz) / 2} height={hy} reducedMotion={reducedMotion} />}

      {(hovered || selected) && <ModuleLabel module={module} shortName={layout.shortName} height={layout.beaconHeight} hidden={!interactive} />}
    </group>
  );
};

/** Maintenance indicator: a cyan ring sweeping up and down the module while a repair is in progress. */
const RepairScan: React.FC<{ radiusX: number; radiusZ: number; height: number; reducedMotion: boolean }> = ({
  radiusX,
  radiusZ,
  height,
  reducedMotion,
}) => {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const t = reducedMotion ? 0.5 : (Math.sin(clock.elapsedTime * 1.6) + 1) / 2;
    ring.current.position.y = 0.1 + t * (height - 0.2);
  });
  return (
    <group scale={[radiusX, 1, radiusZ]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.96, 1, 48]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
};
