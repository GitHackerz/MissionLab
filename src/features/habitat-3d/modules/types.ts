import { MutableRefObject } from 'react';
import { MissionState, ModuleId, ModuleState, Resources } from '@/simulation/types';
import type { RecyclerComponentId } from '@/simulation/training/types';
import type { ServiceHotspot } from '../utils/serviceInteractions';

/** Props shared by every physical module component. */
export interface HabitatModuleProps {
  module: ModuleState;
  resources: Resources;
  selected: boolean;
  reducedMotion: boolean;
  /** False while an equipment service view is open: other modules ignore pointer input. */
  interactive?: boolean;
  /** Eased 0..1 storm intensity (render-only). */
  stormRef: MutableRefObject<number>;
  onSelect: (id: ModuleId) => void;
  onFocus: (id: ModuleId) => void;
  /** Present for the module that has an interactive service view (the water recycler). */
  service?: {
    active: boolean;
    mission: MissionState;
    selectedComponent: RecyclerComponentId | null;
    hintKey: string | null;
    onHotspot: (hotspot: ServiceHotspot) => void;
  };
}
