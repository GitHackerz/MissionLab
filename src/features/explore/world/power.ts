/** Read-only bindings from allocated engine loads to habitat fixtures.
 * Lighting is bundled into existing loads, never charged a second time.
 * The essential crew/habitat circuit feeds safety guidance lights; there is no
 * independent emergency battery in this scenario.
 */
import { getRecyclerOperation } from '@/simulation/training/recycler';
import type { MissionState, ModuleId } from '@/simulation/types';
import { modulePowerFraction } from '@/features/habitat-3d/utils/visualState';
import type { RoomId } from './layout';

export const ROOM_CIRCUITS: Record<RoomId, ModuleId> = {
  hub: 'crew-habitat',
  'mission-control': 'research-lab',
  power: 'crew-habitat',
  'life-support': 'life-support',
  greenhouse: 'greenhouse',
};

export type LightingMode = 'normal' | 'limited' | 'emergency' | 'unpowered';

export interface RoomPower {
  circuit: ModuleId;
  main: number;
  safety: number;
  mode: LightingMode;
  label: string;
}

export function getRoomPower(state: MissionState, room: RoomId): RoomPower {
  const circuit = ROOM_CIRCUITS[room];
  const mod = state.modules[circuit];
  const main = modulePowerFraction(mod);

  // Emergency safety lighting draws from the essential habitat bus backed by the battery
  const batteryHasCharge = state.resources.batteryKwh > 0.1 && state.modules['battery-bank'].status !== 'offline';
  const habitatCircuitPowered = modulePowerFraction(state.modules['crew-habitat']) > 0;

  // Emergency lighting only activates if the backup power source is actually powered
  const safety = main < 0.999 && batteryHasCharge && habitatCircuitPowered ? 1 : 0;
  const mode: LightingMode = main >= 0.999 ? 'normal' : main > 0 ? 'limited' : safety > 0 ? 'emergency' : 'unpowered';
  const label = {
    normal: 'Main lighting on',
    limited: 'Limited main power',
    emergency: 'Safety lighting only · backup bus',
    unpowered: 'Blackout · no powered lighting · passive markings',
  }[mode];

  return { circuit, main, safety, mode, label };
}

/** Availability of the machinery represented by the room's ambient equipment sound. */
export function roomEquipmentActive(state: MissionState, room: RoomId | null): boolean {
  if (room === 'life-support') return modulePowerFraction(state.modules['life-support']) >= .999 || getRecyclerOperation(state).recoveryLph > 0;
  return room ? getRoomPower(state, room).main >= .999 : modulePowerFraction(state.modules['crew-habitat']) >= .999;
}
