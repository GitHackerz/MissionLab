import type { GasZone } from './types';
/** kPa·m³/(mol·K); pressure always derives from tracked species, never a separate mutable inventory. */
export const GAS_CONSTANT = .008314462618;
export const OXYGEN_KG_PER_MOL = .032;
export const totalMol = (z: GasZone) => z.inertMol + z.oxygenMol + z.co2Mol;
export const pressureKpa = (z: GasZone, temperatureK: number) => z.volumeM3 > 0 ? totalMol(z) * GAS_CONSTANT * temperatureK / z.volumeM3 : 0;
export const oxygenKpa = (z: GasZone, temperatureK: number) => z.volumeM3 > 0 ? z.oxygenMol * GAS_CONSTANT * temperatureK / z.volumeM3 : 0;
export const co2Ppm = (z: GasZone) => totalMol(z) > 0 ? z.co2Mol / totalMol(z) * 1e6 : 0;
export function takeGas(zone: GasZone, requestedMol: number): Omit<GasZone, 'volumeM3'> {
  const fraction = totalMol(zone) > 0 ? Math.min(1, Math.max(0, requestedMol) / totalMol(zone)) : 0;
  const gas = { inertMol: zone.inertMol * fraction, oxygenMol: zone.oxygenMol * fraction, co2Mol: zone.co2Mol * fraction };
  zone.inertMol -= gas.inertMol; zone.oxygenMol -= gas.oxygenMol; zone.co2Mol -= gas.co2Mol;
  return gas;
}
export function transferGas(from: GasZone, to: GasZone, amountMol: number): void {
  const gas = takeGas(from, amountMol);
  to.inertMol += gas.inertMol; to.oxygenMol += gas.oxygenMol; to.co2Mol += gas.co2Mol;
}
