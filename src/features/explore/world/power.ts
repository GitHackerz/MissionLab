/** Read-only bindings from allocated engine loads to habitat fixtures.
 * Lighting is bundled into existing loads, never charged a second time.
 * The essential crew/habitat circuit feeds navigation lights; there is no
 * independent emergency battery in this scenario.
 */
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
  const main = modulePowerFraction(state.modules[circuit]);
  const safety = main < .999 ? modulePowerFraction(state.modules['crew-habitat']) : 0;
  const mode: LightingMode = main >= .999 ? 'normal' : main > 0 ? 'limited' : safety > 0 ? 'emergency' : 'unpowered';
  const label = { normal: 'Main lighting on', limited: 'Limited main power', emergency: 'Safety lighting only · habitat circuit', unpowered: 'No powered lighting · daylight / passive markings' }[mode];
  return { circuit, main, safety, mode, label };
}
