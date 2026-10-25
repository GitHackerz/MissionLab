'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

interface SpriteLabelProps {
  text: string;
  /** Optional coloured suffix (e.g. the status word). */
  suffix?: string;
  suffixColor?: string;
  glyph?: string;
  position: [number, number, number];
  visible?: boolean;
  /** On-screen height in CSS pixels. */
  heightPx?: number;
}

const PAD = 14;
const FONT_PX = 30;

/**
 * Screen-space label drawn with a canvas texture on a sprite. Replaces drei's `Html`,
 * whose separate React root throws when it unmounts during a parent unmount (React 19).
 */
export const SpriteLabel: React.FC<SpriteLabelProps> = ({ text, suffix, suffixColor = '#e2e8f0', glyph, position, visible = true, heightPx = 28 }) => {
  const { size, camera } = useThree();
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const font = `600 ${FONT_PX}px system-ui, sans-serif`;
    ctx.font = font;
    const parts = [glyph ? `${glyph} ` : '', text, suffix ? `  ${suffix.toUpperCase()}` : ''];
    const widths = parts.map((p) => ctx.measureText(p).width);
    const w = Math.ceil(widths.reduce((a, b) => a + b, 0) + PAD * 2);
    const h = FONT_PX + PAD;
    canvas.width = w;
    canvas.height = h;
    ctx.font = font;
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();
    ctx.textBaseline = 'middle';
    let x = PAD;
    parts.forEach((p, i) => {
      ctx.fillStyle = i === 2 || (i === 0 && glyph) ? suffixColor : '#f1f5f9';
      ctx.fillText(p, x, h / 2 + 1);
      x += widths[i];
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { texture: tex, aspect: w / h };
  }, [text, suffix, suffixColor, glyph]);
  useEffect(() => () => texture.dispose(), [texture]);

  const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
  const h = (heightPx / size.height) * 2 * Math.tan(THREE.MathUtils.degToRad(fov / 2));
  return (
    <sprite position={position} scale={[h * aspect, h, 1]} visible={visible} renderOrder={20} raycast={() => null}>
      <spriteMaterial map={texture} sizeAttenuation={false} depthTest={false} transparent toneMapped={false} />
    </sprite>
  );
};
