/**
 * Compact Mars habitat interior. Plain data: walls, floors, props and
 * interactables. Units are metres; +Z is "south" on screen, the camera looks north.
 *
 *            [ Mission Control ]
 *                    |
 *   [ Life Support ]-[ Hub ]-[ Power Room ]
 *                    |
 *             [ Greenhouse ]
 */
import type { ModuleId } from '@/simulation/types';
import { Box, box } from './collision';

export type Vec3 = [number, number, number];
export type RoomId = 'hub' | 'mission-control' | 'power' | 'life-support' | 'greenhouse';

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const ROOMS: Record<RoomId, Rect & { label: string; accent: string; floor: string }> = {
  hub: { minX: -2, maxX: 2, minZ: -2, maxZ: 2, label: 'Central Hub', accent: '#e2e8f0', floor: '#52616a' },
  'mission-control': { minX: -4, maxX: 4, minZ: -9, maxZ: -4, label: 'Mission Control', accent: '#38bdf8', floor: '#3f5565' },
  power: { minX: 4, maxX: 10, minZ: -3, maxZ: 3, label: 'Power Room', accent: '#fbbf24', floor: '#625e50' },
  'life-support': { minX: -10, maxX: -4, minZ: -3, maxZ: 3, label: 'Life Support', accent: '#22d3ee', floor: '#45636a' },
  greenhouse: { minX: -4, maxX: 4, minZ: 4, maxZ: 9, label: 'Greenhouse', accent: '#4ade80', floor: '#4f6657' },
};

/** Short connecting corridors (floor only; walls below). */
export const CORRIDORS: Rect[] = [
  { minX: -1.2, maxX: 1.2, minZ: -4, maxZ: -2 },
  { minX: -1.2, maxX: 1.2, minZ: 2, maxZ: 4 },
  { minX: 2, maxX: 4, minZ: -1.2, maxZ: 1.2 },
  { minX: -4, maxX: -2, minZ: -1.2, maxZ: 1.2 },
];

export const WALL_T = 0.2;
export const WALL_H = 1.25;

/** Wall segments as boxes: used for both rendering and collision. */
function hWall(z: number, x1: number, x2: number): Box {
  return { minX: x1, maxX: x2, minZ: z - WALL_T / 2, maxZ: z + WALL_T / 2 };
}
function vWall(x: number, z1: number, z2: number): Box {
  return { minX: x - WALL_T / 2, maxX: x + WALL_T / 2, minZ: z1, maxZ: z2 };
}

/** Half-width of every doorway and corridor (2.4 m wide: comfortable for the astronaut). */
const G = 1.2;

export const WALLS: Box[] = [
  // Hub, with a doorway on every side
  hWall(-2, -2, -G), hWall(-2, G, 2), hWall(2, -2, -G), hWall(2, G, 2),
  vWall(2, -2, -G), vWall(2, G, 2), vWall(-2, -2, -G), vWall(-2, G, 2),
  // Corridors
  vWall(-G, -4, -2), vWall(G, -4, -2), vWall(-G, 2, 4), vWall(G, 2, 4),
  hWall(-G, 2, 4), hWall(G, 2, 4), hWall(-G, -4, -2), hWall(G, -4, -2),
  // Mission Control (doorway on its south wall)
  hWall(-9, -4, 4), vWall(-4, -9, -4), vWall(4, -9, -4), hWall(-4, -4, -G), hWall(-4, G, 4),
  // Power Room (doorway on its west wall)
  vWall(10, -3, 3), hWall(-3, 4, 10), hWall(3, 4, 10), vWall(4, -3, -G), vWall(4, G, 3),
  // Life Support (doorway on its east wall)
  vWall(-10, -3, 3), hWall(-3, -10, -4), hWall(3, -10, -4), vWall(-4, -3, -G), vWall(-4, G, 3),
  // Greenhouse (doorway on its north wall)
  hWall(9, -4, 4), vWall(-4, 4, 9), vWall(4, 4, 9), hWall(4, -4, -G), hWall(4, G, 4),
];

export type PropKind = 'console' | 'rack' | 'tank' | 'bench' | 'planter' | 'crate' | 'terminal';

export interface Prop {
  id: string;
  kind: PropKind;
  room: RoomId;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** Which way the operator side faces (radians, 0 = +Z). */
  facing?: number;
  /** Props that are wall-mounted or decorative do not block the player. */
  collide: boolean;
  accent?: string;
}

export const PROPS: Prop[] = [
  // Mission Control
  { id: 'mc-desk', kind: 'console', room: 'mission-control', x: 0, z: -8.35, w: 5, d: 0.9, h: 0.95, facing: 0, collide: true },
  { id: 'mc-comms', kind: 'terminal', room: 'mission-control', x: -3.45, z: -6.6, w: 0.8, d: 1.6, h: 1.0, facing: Math.PI / 2, collide: true },
  { id: 'mc-table', kind: 'bench', room: 'mission-control', x: 2.4, z: -6.0, w: 2.2, d: 1.0, h: 0.8, collide: true },
  // Power Room
  { id: 'pw-rack-1', kind: 'rack', room: 'power', x: 5.6, z: -2.4, w: 1.1, d: 0.8, h: 1.7, collide: true },
  { id: 'pw-rack-2', kind: 'rack', room: 'power', x: 6.9, z: -2.4, w: 1.1, d: 0.8, h: 1.7, collide: true },
  { id: 'pw-rack-3', kind: 'rack', room: 'power', x: 8.2, z: -2.4, w: 1.1, d: 0.8, h: 1.7, collide: true },
  { id: 'pw-console', kind: 'console', room: 'power', x: 9.4, z: 0, w: 0.9, d: 2.2, h: 1.1, facing: -Math.PI / 2, collide: true },
  { id: 'pw-transformer', kind: 'crate', room: 'power', x: 6.5, z: 2.3, w: 1.4, d: 0.9, h: 1.2, collide: true },
  // Life Support (the water recycler is added from the existing module model)
  { id: 'ls-tank-1', kind: 'tank', room: 'life-support', x: -5.3, z: -2.55, w: 0.7, d: 0.7, h: 1.9, collide: true },
  { id: 'ls-tank-2', kind: 'tank', room: 'life-support', x: -4.55, z: -2.55, w: 0.7, d: 0.7, h: 1.9, collide: true },
  { id: 'ls-desk', kind: 'bench', room: 'life-support', x: -9.2, z: 2.55, w: 1.2, d: 0.7, h: 0.9, collide: true },
  // Greenhouse
  { id: 'gh-bed-1', kind: 'planter', room: 'greenhouse', x: -0.5, z: 5.7, w: 5.2, d: 0.9, h: 0.5, collide: true },
  { id: 'gh-bed-2', kind: 'planter', room: 'greenhouse', x: -0.5, z: 7.5, w: 5.2, d: 0.9, h: 0.5, collide: true },
  { id: 'gh-station', kind: 'terminal', room: 'greenhouse', x: 3.35, z: 6.6, w: 0.8, d: 1.4, h: 1.0, facing: -Math.PI / 2, collide: true },
  { id: 'gh-tank', kind: 'tank', room: 'greenhouse', x: -3.4, z: 8.3, w: 0.8, d: 0.8, h: 1.2, collide: true },
  // Hub
  { id: 'hub-terminal', kind: 'terminal', room: 'hub', x: -1.45, z: 1.45, w: 0.8, d: 0.6, h: 1.0, facing: Math.PI / 4, collide: true },
];

/** Position and footprint of the existing water-recycler model placed in the Life Support room. */
export const RECYCLER_POSITION: Vec3 = [-7.0, 0, -0.5];
/** Footprint of the recycler slab and its bench (derived from the model, rotated to face west). */
export const RECYCLER_COLLIDERS: Box[] = [
  { minX: -8.4, maxX: -6.0, minZ: -1.8, maxZ: 1.4 },
  { minX: -9.25, maxX: -8.65, minZ: -2.95, maxZ: -0.95 },
];

export const COLLIDERS: Box[] = [
  ...WALLS,
  ...PROPS.filter((p) => p.collide).map((p) => box(p.x, p.z, p.w, p.d)),
  ...RECYCLER_COLLIDERS,
];

export const SPAWN = { x: 0.9, z: -0.2, yaw: Math.PI };
export const PLAYER_RADIUS = 0.34;

export type TaskId = 'water-recycler' | 'power-console' | 'mission-console' | 'greenhouse-station' | 'crew-terminal' | 'air-unit';

export interface WorldInteractable {
  id: string;
  moduleId: ModuleId;
  taskId: TaskId;
  label: string;
  /** Verb phrase for the prompt: "Press E to {verb}". */
  verb: string;
  description: string;
  position: Vec3;
  interactionRadius: number;
  room: RoomId;
  /** World point the camera looks at, and its offset, while the task is open. */
  focus: { target: Vec3; offset: Vec3 };
  enabled: boolean;
}

export const INTERACTABLES: WorldInteractable[] = [
  {
    id: 'mission-console', moduleId: 'crew-habitat', taskId: 'mission-console', label: 'Mission Console', verb: 'Review the mission',
    description: 'Objectives, mission events, forecasts and documentation.',
    position: [0, 0, -7.3], interactionRadius: 2.0, room: 'mission-control', enabled: true,
    focus: { target: [0, 1.0, -8.3], offset: [0, 3.2, 4.2] },
  },
  {
    id: 'power-console', moduleId: 'battery-bank', taskId: 'power-console', label: 'Power Distribution Board', verb: 'Manage power',
    description: 'Solar input, battery storage and which loads to keep running.',
    position: [8.4, 0, 0], interactionRadius: 2.1, room: 'power', enabled: true,
    focus: { target: [9.4, 1.0, 0], offset: [-4.2, 3.2, 0.3] },
  },
  {
    id: 'water-recycler', moduleId: 'water-recycler', taskId: 'water-recycler', label: 'Water Recycler', verb: 'Inspect',
    description: 'Recovers drinking water from used water.',
    position: [-7.0, 0, -0.5], interactionRadius: 3.2, room: 'life-support', enabled: true,
    focus: { target: [-7.8, 0.5, 0.6], offset: [-5.8, 3.4, 0.4] },
  },
  {
    id: 'air-unit', moduleId: 'life-support', taskId: 'air-unit', label: 'Air Revitalization Unit', verb: 'Inspect',
    description: 'Scrubs carbon dioxide and makes oxygen.',
    position: [-4.95, 0, -1.75], interactionRadius: 1.7, room: 'life-support', enabled: true,
    focus: { target: [-4.95, 1.0, -2.55], offset: [0, 3.0, 3.6] },
  },
  {
    id: 'greenhouse-station', moduleId: 'greenhouse', taskId: 'greenhouse-station', label: 'Greenhouse Workstation', verb: 'Check the crops',
    description: 'Growing conditions, light and the power trade-off.',
    position: [2.55, 0, 6.6], interactionRadius: 2.0, room: 'greenhouse', enabled: true,
    focus: { target: [3.35, 1.0, 6.6], offset: [-4.0, 3.0, 0.2] },
  },
  {
    id: 'crew-terminal', moduleId: 'crew-habitat', taskId: 'crew-terminal', label: 'Crew Habitat Terminal', verb: 'Check crew safety',
    description: 'Air, water, food and power reserves for the crew.',
    position: [-0.7, 0, 0.55], interactionRadius: 1.7, room: 'hub', enabled: true,
    focus: { target: [-1.45, 1.0, 1.45], offset: [2.2, 3.0, 2.6] },
  },
];

export const ROOM_LIST = Object.entries(ROOMS) as [RoomId, (typeof ROOMS)[RoomId]][];

/** Which room contains this point, for the HUD location label. */
export function roomAt(x: number, z: number): RoomId | null {
  for (const [id, r] of ROOM_LIST) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return id;
  return null;
}

/** Stable interaction IDs keep navigation compatible; display labels describe the selected mission's equipment. */
export function missionInteractables(scenarioId: string): WorldInteractable[] {
  return INTERACTABLES.map(item=>scenarioId==='mission-02-pressure-drop'&&item.id==='crew-terminal'
    ? {...item,label:'Atmospheric Control Console',verb:'Investigate pressure',description:'Compartment gauges, isolation valves and sealed maintenance access.'}
    : scenarioId==='mission-03-silent-air'&&item.id==='air-unit'
    ? {...item,label:'Air Treatment Console',verb:'Investigate cabin air',description:'Ventilation, scrubber and independent gas diagnostics.'}:item);
}
