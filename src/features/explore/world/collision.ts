/**
 * Minimal 2D (top-down) collision for the walkable habitat: a circle
 * (the astronaut) against axis-aligned boxes. Pure, deterministic, and
 * independent of the mission engine. Resolved per axis so the player slides
 * along walls instead of sticking.
 */
export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function box(cx: number, cz: number, w: number, d: number): Box {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
}

export function circleHitsBox(x: number, z: number, r: number, b: Box): boolean {
  const nx = Math.max(b.minX, Math.min(x, b.maxX));
  const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
  const dx = x - nx;
  const dz = z - nz;
  return dx * dx + dz * dz < r * r;
}

export function collides(x: number, z: number, r: number, boxes: readonly Box[]): boolean {
  for (const b of boxes) if (circleHitsBox(x, z, r, b)) return true;
  return false;
}

/** Largest single step per substep, so fast movement cannot tunnel through a 0.2 m wall. */
const MAX_STEP = 0.1;

/** Moves (x,z) by (dx,dz), sliding along obstacles. */
export function moveWithCollision(
  x: number,
  z: number,
  dx: number,
  dz: number,
  r: number,
  boxes: readonly Box[],
): { x: number; z: number; blocked: boolean } {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_STEP));
  const sx = dx / steps;
  const sz = dz / steps;
  let blocked = false;
  for (let i = 0; i < steps; i++) {
    if (!collides(x + sx, z, r, boxes)) x += sx;
    else if (sx !== 0) blocked = true;
    if (!collides(x, z + sz, r, boxes)) z += sz;
    else if (sz !== 0) blocked = true;
  }
  return { x, z, blocked };
}
