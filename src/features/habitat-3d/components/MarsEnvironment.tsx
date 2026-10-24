'use client';

import React from 'react';

interface MarsEnvironmentProps {
  stormActive: boolean;
}

export const MarsEnvironment: React.FC<MarsEnvironmentProps> = ({ stormActive }) => {
  const fogColor = stormActive ? '#5c2217' : '#26120d';
  const fogDensity = stormActive ? 0.045 : 0.015;

  return (
    <>
      {/* Atmospheric Fog */}
      <fogExp2 attach="fog" args={[fogColor, fogDensity]} />

      {/* Ambient Light for Habitat Fill */}
      <ambientLight intensity={stormActive ? 0.35 : 0.6} color={stormActive ? '#d97706' : '#fed7aa'} />

      {/* Directional Martian Sunlight */}
      <directionalLight
        position={[15, 20, 10]}
        intensity={stormActive ? 0.8 : 2.2}
        color={stormActive ? '#f97316' : '#ffedd5'}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/* Ground Terrain Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100, 32, 32]} />
        <meshStandardMaterial
          color="#92400e"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* Surrounding Crater Rim Dunes */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <ringGeometry args={[14, 45, 32]} />
        <meshStandardMaterial color="#78350f" roughness={1.0} />
      </mesh>
    </>
  );
};
