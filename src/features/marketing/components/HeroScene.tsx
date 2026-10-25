'use client';

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Decorative landing scene only. It shows the storm idea visually; it never computes mission values.

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function makeMarsTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d')!;
  const r = rng(2045);
  const base = g.createLinearGradient(0, 0, 0, 512);
  base.addColorStop(0, '#b4532a');
  base.addColorStop(0.5, '#c96435');
  base.addColorStop(1, '#9a4325');
  g.fillStyle = base;
  g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 260; i++) {
    const x = r() * 1024, y = 60 + r() * 392, rad = 20 + r() * 110, dark = r() < 0.55;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, dark ? 'rgba(92,34,18,.35)' : 'rgba(240,140,80,.22)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(x, y, rad * 1.6, rad, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 70; i++) {
    const x = r() * 1024, y = 40 + r() * 432, rad = 3 + Math.pow(r(), 2.4) * 26;
    g.fillStyle = 'rgba(70,24,12,.45)';
    g.beginPath();
    g.ellipse(x, y, rad, rad * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,170,120,.28)';
    g.lineWidth = Math.max(1, rad * 0.18);
    g.beginPath();
    g.ellipse(x - rad * 0.1, y - rad * 0.1, rad, rad * 0.8, 0, Math.PI * 0.9, Math.PI * 1.9);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeSparkTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.translate(64, 64);
  g.fillStyle = '#ff7a3d';
  g.shadowColor = '#ff7a3d';
  g.shadowBlur = 18;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, rr = i % 2 === 0 ? 60 : 12;
    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeDotTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const RING_RADIUS = 3.7;

function MarsSystem({ stormRef }: { stormRef: React.MutableRefObject<number> }) {
  const { size } = useThree();
  const narrow = size.width < 760;
  const planet = useRef<THREE.Mesh>(null);
  const spark = useRef<THREE.Sprite>(null);
  const glowMat = useRef<THREE.ShaderMaterial>(null);
  const textures = useMemo(() => ({ mars: makeMarsTexture(), spark: makeSparkTexture() }), []);
  const glowUniforms = useMemo(() => ({ c: { value: new THREE.Color('#fe5319') }, k: { value: 1 } }), []);

  useFrame((state, dt) => {
    if (planet.current) planet.current.rotation.y += dt * 0.06;
    const a = state.clock.elapsedTime * 0.35;
    if (spark.current) {
      spark.current.position.set(Math.cos(a) * RING_RADIUS, Math.sin(a) * RING_RADIUS, 0);
      spark.current.material.rotation = -state.clock.elapsedTime * 0.8;
    }
    if (glowMat.current) glowMat.current.uniforms.k.value = 1 - stormRef.current * 0.45;
  });

  return (
    <group position={narrow ? [0, 1.9, 0] : [3.2, 0, 0]} scale={narrow ? 0.78 : 1}>
      <mesh ref={planet} rotation={[0, 0, 0.25]}>
        <sphereGeometry args={[2.4, 64, 48]} />
        <meshStandardMaterial map={textures.mars} roughness={1} metalness={0} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.62, 48, 32]} />
        <shaderMaterial
          ref={glowMat}
          uniforms={glowUniforms}
          vertexShader="varying vec3 n; varying vec3 v; void main(){ n = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }"
          fragmentShader="uniform vec3 c; uniform float k; varying vec3 n; varying vec3 v; void main(){ float f = pow(1. - max(dot(n,v),0.), 3.); gl_FragColor = vec4(c, f*0.85*k); }"
          side={THREE.BackSide}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <group rotation={[1.22, -0.12, -0.32]}>
        <mesh>
          <torusGeometry args={[RING_RADIUS, 0.028, 8, 240]} />
          <meshBasicMaterial color="#fe5319" />
        </mesh>
        <mesh>
          <torusGeometry args={[RING_RADIUS + 0.22, 0.008, 6, 240]} />
          <meshBasicMaterial color="#f47a3a" transparent opacity={0.45} />
        </mesh>
        <sprite ref={spark} scale={[0.55, 0.55, 1]}>
          <spriteMaterial map={textures.spark} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      </group>
    </group>
  );
}

function Sky({ stormRef }: { stormRef: React.MutableRefObject<number> }) {
  const dot = useMemo(() => makeDotTexture(), []);
  const stars = useMemo(() => {
    const r = rng(7);
    const p = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, d = 40 + r() * 40, s = Math.sqrt(1 - u * u);
      p.set([Math.cos(th) * s * d, u * d, Math.sin(th) * s * d - 20], i * 3);
    }
    return p;
  }, []);
  const dust = useMemo(() => {
    const r = rng(11);
    const p = new Float32Array(900 * 3);
    const v = new Float32Array(900);
    for (let i = 0; i < 900; i++) {
      p.set([(r() - 0.5) * 22, (r() - 0.5) * 12, (r() - 0.5) * 8 + 1], i * 3);
      v[i] = 0.6 + r() * 1.4;
    }
    return { p, v };
  }, []);
  const starMat = useRef<THREE.PointsMaterial>(null);
  const dustMat = useRef<THREE.PointsMaterial>(null);
  const dustGeo = useRef<THREE.BufferGeometry>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const { scene, camera, pointer, size } = useThree();

  useFrame((state, dt) => {
    const mix = stormRef.current;
    if (key.current) key.current.intensity = 4.2 - mix * 2.6;
    if (amb.current) amb.current.intensity = 1.6 + mix * 0.9;
    if (starMat.current) starMat.current.opacity = 0.85 - mix * 0.7;
    if (dustMat.current) dustMat.current.opacity = mix * 0.75;
    if (scene.fog instanceof THREE.FogExp2) scene.fog.density = mix * 0.045;
    const pos = dustGeo.current?.attributes.position;
    if (pos && mix > 0.01) {
      const arr = pos.array as Float32Array;
      for (let i = 0; i < 900; i++) {
        arr[i * 3] += dt * dust.v[i] * (1 + mix * 3);
        arr[i * 3 + 1] += Math.sin(state.clock.elapsedTime + i) * dt * 0.1;
        if (arr[i * 3] > 11) arr[i * 3] = -11;
      }
      pos.needsUpdate = true;
    }
    camera.position.x += (pointer.x * 0.6 - camera.position.x) * 0.04;
    camera.position.y += (pointer.y * 0.4 - camera.position.y) * 0.04;
    const narrow = size.width < 760;
    camera.lookAt(narrow ? 0 : 1.2, narrow ? 0.9 : 0, 0);
  });

  return (
    <>
      <fogExp2 attach="fog" args={['#2a1009', 0]} />
      <directionalLight ref={key} color="#ffc29a" intensity={4.2} position={[-6, 4, 6]} />
      <directionalLight color="#fe5319" intensity={3.2} position={[6, 1, -5]} />
      <ambientLight ref={amb} color="#3a1a12" intensity={1.6} />
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial ref={starMat} color="#fdfaf5" size={0.16} map={dot} transparent depthWrite={false} opacity={0.85} />
      </points>
      <points>
        <bufferGeometry ref={dustGeo}>
          <bufferAttribute attach="attributes-position" args={[dust.p, 3]} />
        </bufferGeometry>
        <pointsMaterial ref={dustMat} color="#e0864e" size={0.09} map={dot} transparent depthWrite={false} opacity={0} />
      </points>
    </>
  );
}

function StormEase({ storm, stormRef }: { storm: boolean; stormRef: React.MutableRefObject<number> }) {
  useFrame((_, dt) => {
    stormRef.current += ((storm ? 1 : 0) - stormRef.current) * Math.min(1, dt * 2.2);
  });
  return null;
}

export default function HeroScene({ storm, reducedMotion }: { storm: boolean; reducedMotion: boolean }) {
  const stormRef = useRef(storm ? 1 : 0);
  if (reducedMotion) stormRef.current = storm ? 1 : 0;

  return (
    <Canvas
      camera={{ position: [0, 0, 11], fov: 35 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      frameloop={reducedMotion ? 'demand' : 'always'}
      aria-hidden
    >
      <StormEase storm={storm} stormRef={stormRef} />
      <Sky stormRef={stormRef} />
      <MarsSystem stormRef={stormRef} />
    </Canvas>
  );
}
