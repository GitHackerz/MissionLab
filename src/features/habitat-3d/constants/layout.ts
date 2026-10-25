import { ModuleId } from '@/simulation/types';

export type Vec3 = [number, number, number];

export interface ModuleLayout {
  position: Vec3;
  shortName: string;
  /** Invisible selection proxy: forgiving click target for the whole module. */
  hitShape: 'box' | 'cylinder';
  hitSize: Vec3;
  /** Height of the status beacon above the module origin. */
  beaconHeight: number;
  /** Camera distance used when focusing this module. */
  focusDistance: number;
}

/**
 * Spatial layout from docs/07-3D-ENVIRONMENT.md. Scene composition owns this;
 * the simulation never sees positions.
 */
export const MODULE_LAYOUT: Record<ModuleId, ModuleLayout> = {
  'crew-habitat': {
    position: [0, 0, 0],
    shortName: 'Crew Habitat',
    hitShape: 'cylinder',
    hitSize: [4.4, 2.6, 4.4],
    beaconHeight: 3.3,
    focusDistance: 10,
  },
  'solar-array': {
    position: [0, 0, -5],
    shortName: 'Solar Array',
    hitShape: 'box',
    hitSize: [7.4, 2.8, 2.8],
    beaconHeight: 3.6,
    focusDistance: 12,
  },
  'battery-bank': {
    position: [0, 0, 3.8],
    shortName: 'Battery Bank',
    hitShape: 'box',
    hitSize: [5.3, 1.6, 1.8],
    beaconHeight: 2.2,
    focusDistance: 8.5,
  },
  'life-support': {
    position: [-3.2, 0, 1.2],
    shortName: 'Life Support',
    hitShape: 'box',
    hitSize: [2.2, 2.2, 2.6],
    beaconHeight: 2.9,
    focusDistance: 8.5,
  },
  'water-recycler': {
    position: [-2.8, 0, -2.4],
    shortName: 'Water Recycler',
    hitShape: 'box',
    hitSize: [2.8, 2.2, 3.2],
    beaconHeight: 2.9,
    focusDistance: 8,
  },
  greenhouse: {
    position: [3.5, 0, 1.8],
    shortName: 'Greenhouse',
    hitShape: 'box',
    hitSize: [1.9, 1.5, 3.0],
    beaconHeight: 2.3,
    focusDistance: 8.5,
  },
  'research-lab': {
    position: [3.2, 0, -2.0],
    shortName: 'Research Lab',
    hitShape: 'cylinder',
    hitSize: [2.5, 3.2, 2.5],
    beaconHeight: 3.7,
    focusDistance: 8.5,
  },
};

/** Azimuth (radians from +Z toward +X) of the crew habitat airlock. */
export const AIRLOCK_AZIMUTH = 0.7;

/** Radius of the flat, compacted pad that all modules sit on. */
export const PAD_RADIUS = 9;

export const CAMERA = {
  /** Overview offset from the orbit target, authored for a 16:9 viewport. */
  overviewOffset: [7, 11.2, 12.8] as Vec3,
  overviewTarget: [0, 0.4, -0.4] as Vec3,
  minDistance: 5,
  maxDistance: 35,
  /** Strictly below horizontal so the orbit never dips beneath terrain. */
  maxPolarAngle: Math.PI / 2.05,
  /** Orbit target is kept within this radius of the pad centre. */
  maxPanRadius: 14,
  groundClearance: 0.8,
  fov: 45,
} as const;
