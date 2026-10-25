'use client';

import React, { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mulberry32 } from '../utils/terrain';
import { mixStorm } from '../utils/visualState';

const BOX = 70;
const HEIGHT = 14;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  attribute float aSeed;
  void main() {
    vec3 p = position;
    float speed = 4.0 + aSeed * 5.0;
    p.x = mod(p.x - uTime * speed + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};
    p.z += sin(uTime * 0.4 + aSeed * 20.0) * 1.5;
    p.y += sin(uTime * 0.6 + aSeed * 31.0) * 0.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (0.6 + aSeed) / max(0.5, -mv.z) * 40.0;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(d));
    gl_FragColor = vec4(uColor, a * uOpacity);
    #include <colorspace_fragment>
  }
`;

interface DustStormEffectProps {
  stormRef: MutableRefObject<number>;
  count: number;
  reducedMotion: boolean;
}

/**
 * Wind-blown dust: a single Points draw call animated entirely on the GPU.
 * It is only visible while the eased storm value is above zero.
 */
export const DustStormEffect: React.FC<DustStormEffectProps> = ({ stormRef, count, reducedMotion }) => {
  const points = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const geometry = useMemo(() => {
    const rand = mulberry32(99);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() - 0.5) * BOX;
      positions[i * 3 + 1] = 0.3 + rand() * HEIGHT;
      positions[i * 3 + 2] = (rand() - 0.5) * BOX;
      seeds[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return geo;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: 1.6 },
          uOpacity: { value: 0 },
          uColor: { value: new THREE.Color('#e0a074') },
        },
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((_, delta) => {
    const t = stormRef.current;
    if (points.current) points.current.visible = t > 0.02;
    if (!reducedMotion) timeRef.current += Math.min(delta, 0.1);
    material.uniforms.uTime.value = timeRef.current;
    material.uniforms.uOpacity.value = mixStorm('dustOpacity', t);
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} visible={false} renderOrder={5} />;
};
