'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useMissionStore } from '@/state/missionStore';
import { MissionHeader } from '@/features/mission-ui/components/MissionHeader';
import { ResourceHud } from '@/features/mission-ui/components/ResourceHud';
import { SidePanel } from '@/features/mission-ui/components/SidePanel';
import { FeedbackToast } from '@/features/mission-ui/components/FeedbackToast';
import { useExploreStore } from '@/features/explore/store';
import { MissionReview } from '@/features/debrief/components/MissionReview';
import { EventTimeline } from '@/features/mission-ui/components/EventTimeline';

const HabitatExplorer = dynamic(() => import('@/features/explore/ui/HabitatExplorer'), { ssr: false });

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
  const worldMode = useExploreStore((s) => s.worldMode);
  const enterHabitat = useExploreStore((s) => s.enterHabitat);
  const enableTraining = useMissionStore((s) => s.enableTraining);
  // The app teaches with the component-level training model; the store keeps the pure engine as its default.
  useEffect(() => enableTraining(), [enableTraining]);
  const { missionState, selectedModuleId, selectModule, viewMode, setViewMode, applyAction, selectedComponentId, selectComponent } = useMissionStore();

  if (worldMode === 'habitat') return <HabitatExplorer />;

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
          <button
            type="button"
            onClick={enterHabitat}
            className="absolute bottom-14 left-1/2 z-10 -translate-x-1/2 rounded-full border border-sky-400/60 bg-black/75 px-4 py-2 text-xs font-semibold text-sky-100 shadow-lg backdrop-blur hover:bg-sky-950"
          >
            Explore the habitat as an astronaut
          </button>
        </section>

        {/* Selected Habitat Subsystem Inspector Panel */}
        <SidePanel />
      </div>

      {/* 4. Event Stream & Log */}
      <EventTimeline />
      <MissionReview />
    </main>
  );
}
