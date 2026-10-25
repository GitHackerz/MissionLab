'use client';

import { AtmosphereEquipment } from './AtmosphereEquipment';
import React, { MutableRefObject, useMemo } from 'react';
import { MissionState, ModuleId } from '@/simulation/types';
import type { RecyclerComponentId } from '@/simulation/training/types';
import { actionForHotspot, nextHintKey, ServiceHotspot } from '../utils/serviceInteractions';
import type { MissionAction } from '@/simulation/types';
import { getRenderableModules } from '../utils/visualState';
import { Infrastructure } from './Infrastructure';
import { BatteryBank } from '../modules/BatteryBank';
import { CrewHabitat } from '../modules/CrewHabitat';
import { Greenhouse } from '../modules/Greenhouse';
import { LifeSupport } from '../modules/LifeSupport';
import { ResearchLab } from '../modules/ResearchLab';
import { SolarArray } from '../modules/SolarArray';
import { WaterRecycler } from '../modules/WaterRecycler';
import { HabitatModuleProps } from '../modules/types';

const MODULE_COMPONENTS: Record<ModuleId, React.FC<HabitatModuleProps>> = {
  'solar-array': SolarArray,
  'battery-bank': BatteryBank,
  'life-support': LifeSupport,
  'water-recycler': WaterRecycler,
  greenhouse: Greenhouse,
  'research-lab': ResearchLab,
  'crew-habitat': CrewHabitat,
};

interface ColonyLayoutProps {
  missionState: MissionState;
  selectedModuleId: ModuleId | null;
  reducedMotion: boolean;
  stormRef: MutableRefObject<number>;
  onSelectModule: (id: ModuleId) => void;
  onFocusModule: (id: ModuleId) => void;
  serviceActive: boolean;
  selectedComponentId: RecyclerComponentId | null;
  onTrainingAction?: (action: MissionAction) => void;
  onSelectComponent?: (id: RecyclerComponentId) => void;
}

/** Scene composition: places every module and the infrastructure that joins them. */
export const ColonyLayout: React.FC<ColonyLayoutProps> = ({
  missionState,
  selectedModuleId,
  reducedMotion,
  stormRef,
  onSelectModule,
  onFocusModule,
  serviceActive,
  selectedComponentId,
  onTrainingAction,
  onSelectComponent,
}) => {
  const modules = useMemo(() => getRenderableModules(missionState), [missionState]);
  const hintKey = useMemo(() => nextHintKey(missionState), [missionState]);
  const onHotspot = (hotspot: ServiceHotspot) => {
    const training = missionState.training;
    if (!training) return;
    const action = actionForHotspot(hotspot, training);
    if (action.type === 'INSPECT_COMPONENT') onSelectComponent?.(action.componentId);
    onTrainingAction?.(action);
  };
  const service = {
    active: serviceActive && Boolean(missionState.training),
    mission: missionState,
    selectedComponent: selectedComponentId,
    hintKey,
    onHotspot,
  };
  return (
    <group>
      {modules.map((module) => {
        const Component = MODULE_COMPONENTS[module.id];
        return (
          <Component
            key={module.id}
            module={module}
            resources={missionState.resources}
            selected={selectedModuleId === module.id}
            reducedMotion={reducedMotion}
            interactive={!service.active}
            stormRef={stormRef}
            onSelect={onSelectModule}
            onFocus={onFocusModule}
            service={module.id === 'water-recycler' && missionState.training ? service : undefined}
          />
        );
      })}
      {missionState.emergency && <AtmosphereEquipment state={missionState} position={[0,0,6]} reducedMotion={reducedMotion} onAction={command=>onTrainingAction?.({type:'EMERGENCY_ACTION',command})} />}
      <Infrastructure modules={missionState.modules} reducedMotion={reducedMotion} stormRef={stormRef} />
    </group>
  );
};
