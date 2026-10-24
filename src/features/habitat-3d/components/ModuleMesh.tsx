'use client';

import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ModuleId, ModuleState, ModuleStatus } from '@/simulation/types';

interface ModuleMeshProps {
  module: ModuleState;
  position: [number, number, number];
  isSelected: boolean;
  onSelect: (id: ModuleId) => void;
}

const STATUS_COLORS: Record<ModuleStatus, string> = {
  operational: '#10b981', // Emerald green
  warning: '#f59e0b',     // Amber
  degraded: '#f97316',    // Orange
  offline: '#ef4444',     // Crimson red
  repairing: '#06b6d4',   // Cyan pulse
};

export const ModuleMesh: React.FC<ModuleMeshProps> = ({
  module,
  position,
  isSelected,
  onSelect,
}) => {
  const meshRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const statusColor = STATUS_COLORS[module.status] || '#94a3b8';

  // Subtle rotation for selection ring and repair pulsing
  useFrame((_, delta) => {
    if (ringRef.current && isSelected) {
      ringRef.current.rotation.z += delta * 1.5;
    }
    if (module.status === 'repairing' && meshRef.current) {
      const scale = 1 + Math.sin(Date.now() * 0.005) * 0.03;
      meshRef.current.scale.set(scale, scale, scale);
    }
  });

  // Geometry variation per module type
  const renderGeometry = () => {
    switch (module.id) {
      case 'crew-habitat':
        return (
          <group>
            {/* Main Central Habitat Dome */}
            <mesh castShadow receiveShadow position={[0, 0.4, 0]}>
              <cylinderGeometry args={[1.8, 2.0, 1.2, 16]} />
              <meshStandardMaterial
                color={hovered ? '#e2e8f0' : '#cbd5e1'}
                metalness={0.4}
                roughness={0.5}
              />
            </mesh>
            <mesh position={[0, 1.0, 0]}>
              <sphereGeometry args={[1.8, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.4} />
            </mesh>
          </group>
        );

      case 'solar-array':
        return (
          <group>
            {/* Central Mast */}
            <mesh position={[0, 0.6, 0]}>
              <cylinderGeometry args={[0.08, 0.1, 1.2, 8]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
            {/* Solar Wings */}
            <mesh position={[-1.2, 1.0, 0]} rotation={[0.4, 0, 0]}>
              <boxGeometry args={[1.8, 0.04, 1.0]} />
              <meshStandardMaterial
                color={module.status === 'warning' ? '#78350f' : '#1e3a8a'}
                emissive={module.status === 'warning' ? '#b45309' : '#1d4ed8'}
                emissiveIntensity={module.status === 'warning' ? 0.3 : 0.6}
                roughness={0.2}
                metalness={0.8}
              />
            </mesh>
            <mesh position={[1.2, 1.0, 0]} rotation={[0.4, 0, 0]}>
              <boxGeometry args={[1.8, 0.04, 1.0]} />
              <meshStandardMaterial
                color={module.status === 'warning' ? '#78350f' : '#1e3a8a'}
                emissive={module.status === 'warning' ? '#b45309' : '#1d4ed8'}
                emissiveIntensity={module.status === 'warning' ? 0.3 : 0.6}
                roughness={0.2}
                metalness={0.8}
              />
            </mesh>
          </group>
        );

      case 'battery-bank':
        return (
          <group>
            {/* Battery Storage Pods */}
            <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
              <boxGeometry args={[1.4, 0.6, 0.8]} />
              <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Power cells indicator strip */}
            <mesh position={[0, 0.62, 0]}>
              <boxGeometry args={[1.2, 0.05, 0.4]} />
              <meshStandardMaterial
                color={statusColor}
                emissive={statusColor}
                emissiveIntensity={0.8}
              />
            </mesh>
          </group>
        );

      case 'life-support':
        return (
          <group>
            {/* ECLSS Cylindrical Air Scrubbers */}
            <mesh castShadow position={[-0.3, 0.5, 0]}>
              <cylinderGeometry args={[0.35, 0.35, 1.0, 16]} />
              <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh castShadow position={[0.3, 0.5, 0]}>
              <cylinderGeometry args={[0.35, 0.35, 1.0, 16]} />
              <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        );

      case 'water-recycler':
        return (
          <group>
            {/* Water Distillation Unit & Condensate Tank */}
            <mesh castShadow position={[0, 0.4, 0]}>
              <boxGeometry args={[1.0, 0.8, 1.0]} />
              <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.9, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 0.4, 12]} />
              <meshStandardMaterial
                color="#0284c7"
                emissive={statusColor}
                emissiveIntensity={0.5}
                roughness={0.2}
              />
            </mesh>
          </group>
        );

      case 'greenhouse':
        return (
          <group>
            {/* Elongated Hydroponic Tunnel */}
            <mesh castShadow position={[0, 0.45, 0]}>
              <boxGeometry args={[1.4, 0.9, 2.0]} />
              <meshStandardMaterial
                color="#0f172a"
                metalness={0.3}
                roughness={0.6}
              />
            </mesh>
            {/* Translucent LED Grow Bay */}
            <mesh position={[0, 0.92, 0]}>
              <boxGeometry args={[1.2, 0.1, 1.8]} />
              <meshStandardMaterial
                color={module.enabled ? '#84cc16' : '#334155'}
                emissive={module.enabled ? '#65a30d' : '#000000'}
                emissiveIntensity={module.enabled ? 0.9 : 0.0}
              />
            </mesh>
          </group>
        );

      case 'research-lab':
        return (
          <group>
            {/* Hexagonal Science Hub */}
            <mesh castShadow position={[0, 0.5, 0]}>
              <cylinderGeometry args={[1.0, 1.1, 1.0, 6]} />
              <meshStandardMaterial
                color={module.enabled ? '#475569' : '#1e293b'}
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>
            {/* Sensor Array Mast */}
            <mesh position={[0, 1.2, 0]}>
              <coneGeometry args={[0.3, 0.5, 8]} />
              <meshStandardMaterial
                color="#94a3b8"
                emissive={module.enabled ? '#38bdf8' : '#000000'}
                emissiveIntensity={module.enabled ? 0.5 : 0.0}
              />
            </mesh>
          </group>
        );

      default:
        return (
          <mesh castShadow position={[0, 0.5, 0]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        );
    }
  };

  return (
    <group
      ref={meshRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(module.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {/* 3D Geometry */}
      {renderGeometry()}

      {/* Status Beacon Marker */}
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshBasicMaterial color={statusColor} />
      </mesh>

      {/* Selection Ring */}
      {isSelected && (
        <mesh
          ref={ringRef}
          position={[0, 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[1.6, 1.8, 32]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Hover Ring */}
      {hovered && !isSelected && (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.6, 32]} />
          <meshBasicMaterial color="#94a3b8" side={THREE.DoubleSide} transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
};
