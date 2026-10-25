'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useNovaStore, selectNovaMode } from '../state/store';
import { novaAudioLevel } from '../audio/speech';
import type { NovaMode } from '../types';

/** Per-mode look. Everything animates toward these with damping, so state changes never pop. */
const LOOK: Record<NovaMode, { color: string; core: number; ring: number; spin: number; shell: number; pulse: number; spread: number }> = {
  idle: { color: '#5fd8ff', core: 1.0, ring: 0.7, spin: 0.35, shell: 0.22, pulse: 0.04, spread: 1 },
  listening: { color: '#7cf0ff', core: 1.3, ring: 0.85, spin: 0.5, shell: 0.3, pulse: 0.1, spread: 1.25 },
  thinking: { color: '#8aa6ff', core: 1.1, ring: 0.9, spin: 2.2, shell: 0.28, pulse: 0.05, spread: 0.9 },
  speaking: { color: '#6fe6ff', core: 1.35, ring: 0.9, spin: 0.7, shell: 0.34, pulse: 0.18, spread: 1.1 },
  guiding: { color: '#56f0c8', core: 1.25, ring: 0.95, spin: 0.9, shell: 0.3, pulse: 0.07, spread: 1.05 },
  warning: { color: '#ffb347', core: 1.35, ring: 0.95, spin: 0.9, shell: 0.34, pulse: 0.12, spread: 1.1 },
  offline: { color: '#8fb0c4', core: 1.0, ring: 0.6, spin: 0.15, shell: 0.12, pulse: 0.02, spread: 0.9 },
  error: { color: '#ff8a7a', core: 0.7, ring: 0.5, spin: 0.2, shell: 0.16, pulse: 0.03, spread: 0.95 },
};

const RING_RADII = [0.27, 0.36, 0.45];
const PARTICLES = 28;

const SHELL_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const SHELL_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
varying vec3 vN; varying vec3 vV;
void main(){
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
  float scan = 0.82 + 0.18 * sin(vN.y * 14.0 + uTime * 1.6);
  gl_FragColor = vec4(uColor, f * scan * uOpacity);
}`;

interface Props {
  /** 0..1 materialisation progress, driven by the parent. */
  appear: React.MutableRefObject<number>;
  reducedMotion: boolean;
}

/**
 * NOVA's body: a bright core inside a fresnel hologram shell, three thin orbital rings and a few
 * orbiting motes. ~35 draw-calls-worth of tiny geometry, no lights, no postprocessing, no shadows.
 */
export const NovaHologram: React.FC<Props> = ({ appear, reducedMotion }) => {
  const root = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const pointsRef = useRef<THREE.Points>(null);
  const cur = useRef({ ...LOOK.idle, c: new THREE.Color(LOOK.idle.color), ring: LOOK.idle.ring, level: 0 });
  const target = useRef(new THREE.Color());

  const shellMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uColor: { value: new THREE.Color(LOOK.idle.color) }, uOpacity: { value: 0.22 }, uTime: { value: 0 } } }),
    [],
  );
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: LOOK.idle.color, toneMapped: false }), []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: LOOK.idle.color, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }), []);
  const moteMat = useMemo(() => new THREE.PointsMaterial({ color: LOOK.idle.color, size: 0.04, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false }), []);
  const moteGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLES * 3), 3));
    return g;
  }, []);
  const seeds = useMemo(() => Array.from({ length: PARTICLES }, (_, i) => ({ a: (i / PARTICLES) * Math.PI * 2, r: 0.3 + ((i * 37) % 11) / 11 * 0.22, s: 0.4 + ((i * 17) % 7) / 7 * 0.6, y: (((i * 29) % 13) / 13 - 0.5) * 0.5 })), []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    const st = useNovaStore.getState();
    const mode = selectNovaMode(st);
    const look = LOOK[mode];
    const k = 1 - Math.exp(-dt * 5);
    const c = cur.current;
    target.current.set(look.color);
    c.c.lerp(target.current, k);
    c.core += (look.core - c.core) * k;
    c.ring += (look.ring - c.ring) * k;
    c.spin += (look.spin - c.spin) * k;
    c.shell += (look.shell - c.shell) * k;
    c.pulse += (look.pulse - c.pulse) * k;
    c.spread += (look.spread - c.spread) * k;
    c.level += ((mode === 'speaking' ? novaAudioLevel.value : 0) - c.level) * (1 - Math.exp(-dt * 14));

    const a = appear.current;
    const motion = reducedMotion ? 0 : 1;
    const breathe = 1 + Math.sin(t * 1.7) * c.pulse * motion + c.level * 0.35 * motion;

    shellMat.uniforms.uColor.value.copy(c.c);
    shellMat.uniforms.uOpacity.value = c.shell * a * (1 + c.level);
    shellMat.uniforms.uTime.value = t * motion;
    coreMat.color.copy(c.c).multiplyScalar(c.core * (0.9 + 0.1 * a));
    ringMat.color.copy(c.c);
    ringMat.opacity = c.ring * a;
    moteMat.color.copy(c.c);
    moteMat.opacity = 0.8 * a * (mode === 'offline' ? 0.4 : 1);

    if (core.current) core.current.scale.setScalar(0.115 * breathe * (0.3 + 0.7 * a));
    if (root.current) root.current.rotation.y += c.spin * dt * 0.4 * motion;

    rings.current.forEach((m, i) => {
      if (!m) return;
      // Rings assemble one after another during materialisation.
      const local = Math.min(1, Math.max(0, a * 3 - i));
      const s = local * c.spread * (mode === 'listening' ? 1 + Math.sin(t * 3 + i) * 0.06 * motion : 1) * (1 + c.level * 0.12);
      m.scale.setScalar(Math.max(0.0001, s));
      m.rotation.x = (0.9 + i * 1.1) + t * c.spin * (0.5 + i * 0.35) * motion;
      m.rotation.z = i * 0.7 + t * c.spin * 0.3 * (i % 2 ? -1 : 1) * motion;
    });

    const pos = moteGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLES; i++) {
      const p = seeds[i];
      const ang = p.a + t * c.spin * p.s * motion;
      const r = p.r * c.spread * a;
      pos.setXYZ(i, Math.cos(ang) * r, p.y * a + Math.sin(t * p.s + i) * 0.02 * motion, Math.sin(ang) * r);
    }
    pos.needsUpdate = true;
  });

  return (
    <group ref={root} raycast={() => null}>
      <mesh ref={core} material={coreMat} raycast={() => null}>
        <icosahedronGeometry args={[1, 2]} />
      </mesh>
      <mesh material={shellMat} scale={0.2} raycast={() => null}>
        <icosahedronGeometry args={[1, 3]} />
      </mesh>
      {RING_RADII.map((r, i) => (
        <mesh key={r} ref={(m) => { rings.current[i] = m; }} material={ringMat} raycast={() => null}>
          <torusGeometry args={[r, 0.011, 6, 72]} />
        </mesh>
      ))}
      <points ref={pointsRef} geometry={moteGeo} material={moteMat} frustumCulled={false} raycast={() => null} />
    </group>
  );
};
