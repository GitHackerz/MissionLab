'use client';

import React, { MutableRefObject, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CLEAR_SKY, STORM_SKY } from '../utils/visualState';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const horizonA = new THREE.Color(CLEAR_SKY.skyHorizon);
const horizonB = new THREE.Color(STORM_SKY.skyHorizon);
const zenithA = new THREE.Color(CLEAR_SKY.skyZenith);
const zenithB = new THREE.Color(STORM_SKY.skyZenith);

/** Gradient sky dome whose horizon matches the fog so distant terrain dissolves into haze. */
export const MarsSky: React.FC<{ stormRef: MutableRefObject<number> }> = ({ stormRef }) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uHorizon: { value: new THREE.Color(CLEAR_SKY.skyHorizon) },
          uZenith: { value: new THREE.Color(CLEAR_SKY.skyZenith) },
        },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const t = stormRef.current;
    (material.uniforms.uHorizon.value as THREE.Color).lerpColors(horizonA, horizonB, t);
    (material.uniforms.uZenith.value as THREE.Color).lerpColors(zenithA, zenithB, t);
  });

  return (
    <mesh renderOrder={-10} frustumCulled={false} material={material}>
      <sphereGeometry args={[160, 24, 12]} />
    </mesh>
  );
};
