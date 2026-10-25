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
import { FankouchCompanion } from './atmosphere/FankouchCompanion';
import { MissionTour } from './MissionTour';
import { useExploreStore } from '@/features/explore/store';
import { MissionReview } from '@/features/debrief/components/MissionReview';
import { MissionIntro } from './MissionIntro';
import { RED_STORM_ID } from '@/simulation/missions/registry';
import type { MissionId } from '@/simulation/missions/types';

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

export function MissionWorkspace({ account, startTour, missionId = RED_STORM_ID }: { account: React.ReactNode; startTour: boolean; missionId?: MissionId }) {
  const { missionState, selectedModuleId, selectModule, viewMode, setViewMode, applyAction, selectedComponentId, selectComponent } = useMissionStore();
  const enableTraining = useMissionStore((s) => s.enableTraining);
  const worldMode = useExploreStore((s) => s.worldMode);
  const enterHabitat = useExploreStore((s) => s.enterHabitat);
  // The guided tour targets the colony view, so it skips the briefing.
  const [started, setStarted] = useState(startTour);
  const [touring, setTouring] = useState(startTour);
  const router = useRouter();

  // The app teaches with the component-level training model. Saved attempts are resumed explicitly from the briefing.
  useEffect(() => {
    enableTraining();
  }, [enableTraining]);

  useEffect(() => {
    const timer = setInterval(() => {
      const st = useMissionStore.getState();
      if (!st.autoRunning) return;
      if (st.missionState.status !== 'running' || st.missionState.emergency?.procedure || useExploreStore.getState().mode !== 'exploration') { st.setAutoRunning(false); return; }
      const oldEvents = st.missionState.events.length;
      st.applyAction(st.missionState.emergency ? { type:'ADVANCE_MINUTES', minutes:1 } : { type:'ADVANCE_TIME', hours:1 });
      if (useMissionStore.getState().missionState.events.slice(oldEvents).some(e=>e.severity !== 'info')) st.setAutoRunning(false);
    }, 1200);
    return ()=>clearInterval(timer);
  }, []);

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
        missionId={missionId}
        onResume={() => {
          if (!useMissionStore.getState().restoreSession(missionId)) return;
          enterHabitat();
          setStarted(true);
        }}
        onStart={(fault) => {
          useMissionStore.getState().startMission(missionId, fault);
          useMissionStore.getState().clearFeedback();
          enterHabitat();
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
    <main className="flex min-h-screen flex-col overflow-y-auto lg:h-screen lg:min-h-0 lg:overflow-hidden">
      {/* 1. Global Mission Header & Clock */}
      <MissionHeader account={account} onTrainingMenu={()=>{useMissionStore.getState().setAutoRunning(false);setStarted(false);}} />

      {/* 2. Systems Resource Telemetry HUD */}
      <ResourceHud />
      {!missionState.emergency && <FankouchCompanion />}

      {/* 3. Central Interactive Workspace */}
      <div className="relative flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row">
        {/* 3D Mars Habitat Digital Twin */}
        <section id="tour-scene" className="relative h-[360px] flex-none overflow-hidden lg:h-full lg:min-h-[360px] lg:flex-1">
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
