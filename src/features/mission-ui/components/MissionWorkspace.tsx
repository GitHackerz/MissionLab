'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMissionStore } from '@/state/missionStore';
import { MissionHeader } from './MissionHeader';
import { ResourceHud } from './ResourceHud';
import { SidePanel } from './SidePanel';
import { FeedbackToast } from './FeedbackToast';
import { EventTimeline } from './EventTimeline';
import { MissionTour } from './MissionTour';
import { useExploreStore } from '@/features/explore/store';
import { MissionReview } from '@/features/debrief/components/MissionReview';
import { MissionIntro } from './MissionIntro';

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

export function MissionWorkspace({ account, startTour }: { account: React.ReactNode; startTour: boolean }) {
  const { missionState, selectedModuleId, selectModule, viewMode, setViewMode, applyAction, selectedComponentId, selectComponent } = useMissionStore();
  const enableTraining = useMissionStore((s) => s.enableTraining);
  const worldMode = useExploreStore((s) => s.worldMode);
  const enterHabitat = useExploreStore((s) => s.enterHabitat);
  // The guided tour targets the colony view, so it skips the briefing.
  const [started, setStarted] = useState(startTour);
  const [entered, setEntered] = useState(false);
  const [touring, setTouring] = useState(startTour);
  const router = useRouter();

  // The app teaches with the component-level training model; attempt to restore active session from storage if starting fresh.
  useEffect(() => {
    enableTraining();
    const store = useMissionStore.getState();
    if (store.missionState.hour === 0) {
      store.restoreSession();
    }
  }, [enableTraining]);

  const endTour = useCallback(() => {
    setTouring(false);
    router.replace('/mission');
  }, [router]);

  // The header (and its guest-trial lock) is hidden in the briefing and explore views, so keep the account area mounted.
  const guestGate = <div className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex justify-center px-3"><div className="pointer-events-auto">{account}</div></div>;

  if (!started) {
    return (
      <MissionIntro
        account={account}
        onStart={() => {
          enableTraining();
          enterHabitat();
          setEntered(true);
          setStarted(true);
        }}
      />
    );
  }
  if (worldMode === 'habitat') {
    return (
      <>
        <HabitatExplorer onTrainingMenu={() => setStarted(false)} />
        {guestGate}
      </>
    );
  }

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

      {touring && <MissionTour onDone={endTour} />}
    </main>
  );
}
