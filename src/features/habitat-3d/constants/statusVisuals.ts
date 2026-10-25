import { ModuleStatus } from '@/simulation/types';

export type BeaconShape = 'sphere' | 'cone' | 'octahedron' | 'box' | 'torus';

export interface StatusVisual {
  /** Beacon hex colour (docs/07 §3). Never the only status cue: see `shape`. */
  color: string;
  label: string;
  /** Glyph used in the DOM legend; mirrors the beacon shape. */
  glyph: string;
  shape: BeaconShape;
  pulseHz: number;
  /** Irregular flicker instead of a steady pulse (degraded equipment). */
  flicker: boolean;
  /** 0..1 brightness of interior and equipment lights. */
  glow: number;
  /** 0..1 speed of functional animation (fans, pumps, flow). */
  activity: number;
}

export const STATUS_VISUALS: Record<ModuleStatus, StatusVisual> = {
  operational: {
    color: '#10b981',
    label: 'Operational',
    glyph: '●',
    shape: 'sphere',
    pulseHz: 0.2,
    flicker: false,
    glow: 1,
    activity: 1,
  },
  warning: {
    color: '#f59e0b',
    label: 'Warning',
    glyph: '▲',
    shape: 'cone',
    pulseHz: 1,
    flicker: false,
    glow: 0.8,
    activity: 0.8,
  },
  degraded: {
    color: '#f97316',
    label: 'Degraded',
    glyph: '◆',
    shape: 'octahedron',
    pulseHz: 1.4,
    flicker: true,
    glow: 0.45,
    activity: 0.35,
  },
  offline: {
    color: '#ef4444',
    label: 'Offline',
    glyph: '■',
    shape: 'box',
    pulseHz: 0,
    flicker: false,
    glow: 0,
    activity: 0,
  },
  repairing: {
    color: '#06b6d4',
    label: 'Repairing',
    glyph: '◯',
    shape: 'torus',
    pulseHz: 2,
    flicker: false,
    glow: 0.4,
    activity: 0.15,
  },
};

/** Neutral appearance for a status value the scene does not recognise. */
export const UNKNOWN_STATUS_VISUAL: StatusVisual = {
  color: '#94a3b8',
  label: 'Unknown',
  glyph: '?',
  shape: 'sphere',
  pulseHz: 0,
  flicker: false,
  glow: 0.3,
  activity: 0,
};

export const LEGEND_STATUSES: ModuleStatus[] = [
  'operational',
  'warning',
  'degraded',
  'offline',
  'repairing',
];
