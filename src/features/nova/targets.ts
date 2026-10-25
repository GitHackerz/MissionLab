/**
 * Registry of everything NOVA may point at or talk about. The model only ever names an id
 * from here; world positions come from this table (derived from the habitat layout), never
 * from model output. Unknown ids are rejected by validation.
 */
import { INTERACTABLES, RECYCLER_POSITION, ROOMS, type RoomId, type Vec3 } from '@/features/explore/world/layout';
import type { HintLevel, NovaIntent } from './types';

export type TargetKind = 'room' | 'station' | 'part';

export interface NovaTarget {
  id: string;
  kind: TargetKind;
  label: string;
  /** World position of the marker (metres). */
  world: Vec3;
  /** Halo radius in metres. */
  radius: number;
}

/** Recycler model is rotated -90deg about Y: local (x, y, z) -> world (px - z, y, pz + x). */
const part = (lx: number, ly: number, lz: number): Vec3 => [RECYCLER_POSITION[0] - lz, ly, RECYCLER_POSITION[2] + lx];

const PART_LIST: [string, string, Vec3][] = [
  ['pump-cartridge', 'Pump cartridge', part(-0.55, 0.9, 0.55)],
  ['filter-cartridge', 'Filter cartridge', part(-0.1, 0.9, 0.55)],
  ['flow-sensor', 'Flow sensor module', part(0.35, 0.9, 0.55)],
  ['pressure-gauges', 'Pressure gauges', part(-0.2, 1.12, 0.62)],
  ['wastewater-tank', 'Wastewater input tank', part(-0.8, 1.2, -0.55)],
  ['treatment-stage', 'Treatment stage', part(0, 1.9, -0.55)],
  ['clean-tank', 'Clean-water output tank', part(0.85, 1.2, -0.55)],
  ['control-panel', 'Control panel', part(1.5, 0.8, 0.7)],
  ['service-hatch', 'Service hatch', part(0.9, 0.7, 0.6)],
];

const ROOM_CENTRE = (r: RoomId): Vec3 => [(ROOMS[r].minX + ROOMS[r].maxX) / 2, 0, (ROOMS[r].minZ + ROOMS[r].maxZ) / 2];

const targets: NovaTarget[] = [
  ...(Object.keys(ROOMS) as RoomId[]).map((r): NovaTarget => ({ id: `room:${r}`, kind: 'room', label: ROOMS[r].label, world: ROOM_CENTRE(r), radius: 1.6 })),
  ...INTERACTABLES.map((i): NovaTarget => ({ id: `station:${i.id}`, kind: 'station', label: i.label, world: [i.position[0], 0, i.position[2]], radius: 0.9 })),
  ...PART_LIST.map(([id, label, world]): NovaTarget => ({ id: `part:${id}`, kind: 'part', label, world, radius: 0.45 })),
];

export const NOVA_TARGETS: Readonly<Record<string, NovaTarget>> = Object.freeze(Object.fromEntries(targets.map((t) => [t.id, t])));
export const NOVA_TARGET_IDS: readonly string[] = targets.map((t) => t.id);

export function getTarget(id: string): NovaTarget | null {
  return Object.prototype.hasOwnProperty.call(NOVA_TARGETS, id) ? NOVA_TARGETS[id] : null;
}

/**
 * Short authored science cards NOVA can "project". The model picks an id; the text is ours,
 * so it is always accurate and never invented.
 */
export const NOVA_CONCEPTS: Readonly<Record<string, { title: string; text: string }>> = Object.freeze({
  'battery-balance': { title: 'Generation vs demand', text: 'A battery only stores energy panels already made. When demand is higher than generation, the battery drains.' },
  'power-priority': { title: 'Essential vs optional', text: 'Life support keeps people alive. Research and crops help the mission goals, so they are what you trim first.' },
  'oxygen-energy': { title: 'Oxygen needs energy', text: 'Splitting water into oxygen takes electricity. Less power for life support means less oxygen made.' },
  'water-loop': { title: 'Closing the water loop', text: 'Recycling returns used water to the clean tank, so the crew does not run out between resupply trips.' },
  'pressure-flow': { title: 'Pressure and flow', text: 'A pump builds pressure to push water through. A big pressure drop across a part means flow is being held back there.' },
  'sensor-vs-reality': { title: 'Trust, then check', text: 'A sensor is a measurement, not the truth. Compare it with an independent reading before you decide.' },
  'greenhouse-light': { title: 'Light is power', text: 'Plants need light to grow, and lamps use electricity. Food and energy are a trade-off.' },
  'verify-with-measurement': { title: 'Prove the repair', text: 'A repair is finished only when measurements return to their expected range.' },
});

export function isConceptId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(NOVA_CONCEPTS, id);
}

/**
 * Anti-spoiler gating. Rooms and stations are objective-level destinations (always fine).
 * Individual equipment parts during diagnosis may only be highlighted at the directional hint
 * level, or when the learner asked what a part does, or once the answer is legitimately known.
 */
export function canTarget(id: string, ctx: { hintLevel: HintLevel; intent: NovaIntent; revealed: boolean }): boolean {
  const t = getTarget(id);
  if (!t) return false;
  if (t.kind !== 'part') return true;
  return ctx.revealed || ctx.hintLevel >= 3 || ctx.intent === 'explain' || ctx.intent === 'debrief' || ctx.intent === 'reflect';
}

/** Recycler component ids that are also registry parts. */
export function partTargetId(componentId: string): string {
  return `part:${componentId}`;
}
