/**
 * Pure adapters from canonical mission state to render parameters.
 * Nothing here computes simulation results: it only maps values the engine
 * already exposes (status, health, battery charge, stormActive) to visuals.
 */
import {
  ALL_MODULE_IDS,
  MissionState,
  ModuleId,
  ModuleState,
  Resources,
} from '@/simulation/types';
import { STATUS_VISUALS, StatusVisual, UNKNOWN_STATUS_VISUAL } from '../constants/statusVisuals';

export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === 'string' && (ALL_MODULE_IDS as string[]).includes(value);
}

export function resolveStatusVisual(status: string | undefined): StatusVisual {
  if (status && Object.prototype.hasOwnProperty.call(STATUS_VISUALS, status)) {
    return STATUS_VISUALS[status as keyof typeof STATUS_VISUALS];
  }
  return UNKNOWN_STATUS_VISUAL;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Battery charge as 0..1, straight from the authoritative resource values. */
export function batteryChargeFraction(resources: Pick<Resources, 'batteryKwh' | 'batteryCapacityKwh'>): number {
  if (!(resources.batteryCapacityKwh > 0)) return 0;
  return clamp01(resources.batteryKwh / resources.batteryCapacityKwh);
}

/** Dust cover (0..1) on exposed solar equipment: reported health loss plus storm haze. */
export function solarDustLevel(module: Pick<ModuleState, 'health'>, stormIntensity: number): number {
  return clamp01(Math.max(1 - clamp01(module.health), clamp01(stormIntensity) * 0.55));
}

/** Modules the scene can draw, in stable order, ignoring unknown keys. */
export function getRenderableModules(state: Pick<MissionState, 'modules'>): ModuleState[] {
  return ALL_MODULE_IDS.map((id) => state.modules[id]).filter(
    (m): m is ModuleState => Boolean(m) && isModuleId(m.id),
  );
}

export type StormPhase = 'clear' | 'approaching' | 'active' | 'recovering';

/** The engine exposes a boolean; the scene eases toward it, so ramps read as approach/recovery. */
export function stormTarget(state: Pick<MissionState, 'stormActive'>): number {
  return state.stormActive ? 1 : 0;
}

export function getStormPhase(intensity: number, target: number): StormPhase {
  const t = clamp01(intensity);
  if (target >= 0.5) return t >= 0.95 ? 'active' : 'approaching';
  return t <= 0.02 ? 'clear' : 'recovering';
}

export interface StormParams {
  fogDensity: number;
  fogColor: string;
  skyHorizon: string;
  skyZenith: string;
  sunIntensity: number;
  sunColor: string;
  ambientIntensity: number;
  envIntensity: number;
  dustOpacity: number;
}

/** Endpoints from docs/07 §4, with a lighter haze so the daytime sky reads as Mars rather than night. */
export const CLEAR_SKY: StormParams = {
  fogDensity: 0.015,
  fogColor: '#c88a62',
  skyHorizon: '#c88a62',
  skyZenith: '#8f5a46',
  sunIntensity: 2.2,
  sunColor: '#ffedd5',
  ambientIntensity: 0.55,
  envIntensity: 0.9,
  dustOpacity: 0,
};

export const STORM_SKY: StormParams = {
  fogDensity: 0.042,
  fogColor: '#7a3a22',
  skyHorizon: '#7a3a22',
  skyZenith: '#4d2318',
  sunIntensity: 0.8,
  sunColor: '#f97316',
  ambientIntensity: 0.62,
  envIntensity: 0.45,
  dustOpacity: 0.55,
};

export type StormNumericKey =
  | 'fogDensity'
  | 'sunIntensity'
  | 'ambientIntensity'
  | 'envIntensity'
  | 'dustOpacity';

export function mixStorm(key: StormNumericKey, intensity: number): number {
  const t = clamp01(intensity);
  return CLEAR_SKY[key] + (STORM_SKY[key] - CLEAR_SKY[key]) * t;
}
