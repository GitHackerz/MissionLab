import type { WorldInteractable } from './world/layout';

export interface PickInput {
  x: number;
  z: number;
  /** Player facing in radians (0 = +Z). */
  yaw: number;
  /** Currently targeted id, kept unless another target is clearly better (prevents flicker). */
  current: string | null;
}

/** Facing bonus: a target straight ahead counts as up to 0.5 m closer. */
const FACING_BONUS = 0.5;
/** A new target must beat the current one by this much to take over. */
const HYSTERESIS = 0.45;

function score(i: WorldInteractable, p: PickInput): number | null {
  const dx = i.position[0] - p.x;
  const dz = i.position[2] - p.z;
  const dist = Math.hypot(dx, dz);
  if (!i.enabled || dist > i.interactionRadius) return null;
  const facing = dist < 0.001 ? 1 : (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) / dist;
  return dist - FACING_BONUS * Math.max(0, facing);
}

/** Deterministic nearest-in-range target with facing preference and hysteresis. */
export function pickInteractable(list: readonly WorldInteractable[], p: PickInput): WorldInteractable | null {
  let best: WorldInteractable | null = null;
  let bestScore = Infinity;
  let currentScore: number | null = null;
  for (const i of list) {
    const s = score(i, p);
    if (s === null) continue;
    if (i.id === p.current) currentScore = s;
    if (s < bestScore || (s === bestScore && best && i.id < best.id)) {
      best = i;
      bestScore = s;
    }
  }
  if (best && p.current && best.id !== p.current && currentScore !== null && currentScore - bestScore < HYSTERESIS) {
    return list.find((i) => i.id === p.current) ?? best;
  }
  return best;
}
