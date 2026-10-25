'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useMissionStore } from '@/state/missionStore';
import { MissionHeader } from '@/features/mission-ui/components/MissionHeader';
import { ResourceHud } from '@/features/mission-ui/components/ResourceHud';
import { SidePanel } from '@/features/mission-ui/components/SidePanel';
import { FeedbackToast } from '@/features/mission-ui/components/FeedbackToast';
import { EventTimeline } from '@/features/mission-ui/components/EventTimeline';

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

export default function MissionControlPage() {
  const { missionState, selectedModuleId, selectModule, viewMode, setViewMode, applyAction, selectedComponentId, selectComponent } = useMissionStore();

  return (
    <main className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* 1. Global Mission Header & Clock */}
      <MissionHeader />

      {/* 2. Systems Resource Telemetry HUD */}
      <ResourceHud />

      {/* 3. Central Interactive Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative">
        {/* 3D Mars Habitat Digital Twin */}
        <section className="flex-1 h-full min-h-[360px] relative">
          <HabitatScene
            missionState={missionState}
            selectedModuleId={selectedModuleId}
            onSelectModule={selectModule}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onTrainingAction={applyAction}
            selectedComponentId={selectedComponentId}
            onSelectComponent={selectComponent}
          />
          <FeedbackToast />
        </section>

        {/* Selected Habitat Subsystem Inspector Panel */}
        <SidePanel />
      </div>

      {/* 4. Event Stream & Log */}
      <EventTimeline />
    </main>
  );
}
