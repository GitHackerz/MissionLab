'use client';

import React, { MutableRefObject, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { CLEAR_SKY, STORM_SKY, mixStorm } from '../utils/visualState';

const sunClear = new THREE.Color(CLEAR_SKY.sunColor);
const sunStorm = new THREE.Color(STORM_SKY.sunColor);
const fogClear = new THREE.Color(CLEAR_SKY.fogColor);
const fogStorm = new THREE.Color(STORM_SKY.fogColor);
const skyUp = new THREE.Color('#e7b48c');
const skyUpStorm = new THREE.Color('#b0653d');
const groundBounce = new THREE.Color('#7b3d24');

/** Sun direction shared with the solar array tilt: high, from +Z / +X. */
export const SUN_POSITION: [number, number, number] = [15, 20, 10];

interface SceneLightingProps {
  stormRef: MutableRefObject<number>;
  shadowMapSize: number;
}

/**
 * Sunlight, haze and fill all follow one eased storm value. Shadow contrast
 * drops during a storm because the directional light fades while fill rises.
 */
export const SceneLighting: React.FC<SceneLightingProps> = ({ stormRef, shadowMapSize }) => {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const scene = useThree((s) => s.scene);

  useFrame(() => {
    const t = stormRef.current;
    if (sun.current) {
      sun.current.intensity = mixStorm('sunIntensity', t);
      sun.current.color.lerpColors(sunClear, sunStorm, t);
    }
    if (hemi.current) {
      hemi.current.intensity = mixStorm('ambientIntensity', t);
      hemi.current.color.lerpColors(skyUp, skyUpStorm, t);
    }
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = mixStorm('fogDensity', t);
      scene.fog.color.lerpColors(fogClear, fogStorm, t);
    }
    scene.environmentIntensity = mixStorm('envIntensity', t);
  });

  return (
    <>
      <fogExp2 attach="fog" args={[CLEAR_SKY.fogColor, CLEAR_SKY.fogDensity]} />
      <hemisphereLight ref={hemi} args={['#e7b48c', groundBounce, CLEAR_SKY.ambientIntensity]} />
      <directionalLight
        ref={sun}
        position={SUN_POSITION}
        intensity={CLEAR_SKY.sunIntensity}
        color={CLEAR_SKY.sunColor}
        castShadow
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={5}
        shadow-camera-far={60}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      {/* Local image-based light for metal and panel reflections: no network fetch. */}
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={3.2} color="#ffd9b0" position={[6, 8, 5]} scale={[10, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.1} color="#e8a47a" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} />
        <Lightformer form="rect" intensity={0.7} color="#8c4a2e" position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[24, 24, 1]} />
      </Environment>
    </>
  );
};
