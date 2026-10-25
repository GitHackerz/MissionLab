'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { Html, useCursor } from '@react-three/drei';
import { Vec3 } from '../constants/layout';

const DRAG_THRESHOLD_PX = 5;

interface HotspotProps {
  /** Invisible, forgiving click volume (metres). */
  size: Vec3;
  position?: Vec3;
  rotation?: Vec3;
  label: string;
  /** When false the hotspot is inert (colony overview): no handlers, no highlight. */
  enabled: boolean;
  /** Cadet guidance: pulse the outline to say "look here". */
  hint?: boolean;
  /** Persistently highlighted (selected component / selected tool). */
  active?: boolean;
  onActivate: () => void;
  children?: React.ReactNode;
}

/**
 * A single named, selectable part of an equipment model. Hovering shows an
 * outline and name; clicking emits a request. It never changes state itself.
 */
export const Hotspot: React.FC<HotspotProps> = ({ size, position, rotation, label, enabled, hint, active, onActivate, children }) => {
  const [hovered, setHovered] = useState(false);
  useCursor(enabled && hovered, 'pointer', 'auto');
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size]);
  useEffect(() => () => edges.dispose(), [edges]);
  const material = useRef<THREE.LineBasicMaterial>(null);

  useEffect(() => {
    if (!enabled) setHovered(false);
  }, [enabled]);

  useFrame(({ clock }) => {
    if (!material.current) return;
    if (hovered) material.current.color.set('#7dd3fc');
    else if (active) material.current.color.set('#38bdf8');
    else material.current.color.set('#fbbf24');
    material.current.opacity = hovered || active ? 1 : hint ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4)) : 0;
  });

  const handlers = enabled
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
        },
        onPointerOut: () => setHovered(false),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > DRAG_THRESHOLD_PX) return;
          e.stopPropagation();
          onActivate();
        },
      }
    : {};

  return (
    <group position={position} rotation={rotation} userData={{ noBatch: true }} {...handlers}>
      {children}
      {enabled && (
        <>
          <mesh visible={false}>
            <boxGeometry args={size} />
            <meshBasicMaterial />
          </mesh>
          <lineSegments geometry={edges} renderOrder={10} raycast={() => null}>
            <lineBasicMaterial ref={material} color="#fbbf24" transparent opacity={0} depthTest={false} toneMapped={false} />
          </lineSegments>
          {hovered && (
            <Html position={[0, size[1] / 2 + 0.12, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
              <div className="whitespace-nowrap rounded border border-white/10 bg-black/80 px-2 py-0.5 text-xs font-medium text-stone-100">{label}</div>
            </Html>
          )}
        </>
      )}
    </group>
  );
};
