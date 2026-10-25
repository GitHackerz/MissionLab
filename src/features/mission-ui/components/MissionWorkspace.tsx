'use client';

import React, { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMissionStore } from '@/state/missionStore';
import { MissionHeader } from './MissionHeader';
import { ResourceHud } from './ResourceHud';
import { ModuleInspector } from './ModuleInspector';
import { EventTimeline } from './EventTimeline';
import { MissionTour } from './MissionTour';

// Dynamically import Three.js Scene to ensure SSR safety with WebGL
const HabitatScene = dynamic(
  () => import('@/features/habitat-3d/HabitatScene'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#190b07] text-stone-400 font-mono text-sm">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span>INITIALIZING 3D DIGITAL TWIN...</span>
        </div>
      </div>
    ),
  }
);

export function MissionWorkspace({ account, startTour }: { account: React.ReactNode; startTour: boolean }) {
  const { missionState, selectedModuleId, selectModule } = useMissionStore();
  const [touring, setTouring] = useState(startTour);
  const router = useRouter();

  const endTour = useCallback(() => {
    setTouring(false);
    router.replace('/mission');
  }, [router]);

  return (
    <main className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* 1. Global Mission Header & Clock */}
      <MissionHeader account={account} />

      {/* 2. Systems Resource Telemetry HUD */}
      <ResourceHud />

      {/* 3. Central Interactive Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative">
        {/* 3D Mars Habitat Digital Twin */}
        <section id="tour-scene" className="flex-1 h-full min-h-[360px] relative">
          <HabitatScene
            missionState={missionState}
            selectedModuleId={selectedModuleId}
            onSelectModule={selectModule}
          />
        </section>

        {/* Selected Habitat Subsystem Inspector Panel */}
        <ModuleInspector />
      </div>

      {/* 4. Event Stream & Log */}
      <EventTimeline />

      {touring && <MissionTour onDone={endTour} />}
    </main>
  );
}
