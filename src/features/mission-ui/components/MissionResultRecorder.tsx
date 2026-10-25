'use client';

import { useEffect, useRef } from 'react';
import { useMissionStore } from '@/state/missionStore';
import { getMissionSummary } from '@/simulation/debrief';
import { assessLearning } from '@/simulation/training/assessment';
import { getAtmosphericSummary } from '@/simulation/missions/debrief';
import { recordMissionRun } from '@/server/classes/actions';

/** Sends the engine's own summary to the server once per finished mission (signed-in students only). */
export function MissionResultRecorder() {
  const missionState = useMissionStore((s) => s.missionState);
  const history = useMissionStore((s) => s.history);
  const recorded = useRef(new Set<string>());

  useEffect(() => {
    if (missionState.status !== 'success' && missionState.status !== 'failed') return;
    const key = `${missionState.branchId}:${missionState.hour}:${history.length}`;
    if (recorded.current.has(key)) return;
    recorded.current.add(key);

    const summary = getMissionSummary(history);
    // Atmospheric missions grade from their own evidence; Red Storm from the recycler training model.
    const skills = missionState.emergency
      ? getAtmosphericSummary(history).assessments.map(({ label, rating }) => ({
          id: label.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '').slice(0, 40),
          label,
          rating: rating.toLowerCase().replace(' ', '-') as 'not-demonstrated' | 'developing' | 'proficient',
        }))
      : assessLearning(missionState)?.dimensions.map(({ id, label, rating }) => ({ id, label, rating })) ?? null;
    recordMissionRun({
      scenarioId: summary.scenarioId,
      status: missionState.status,
      // Atmospheric missions run in minutes, so their hour clock is fractional.
      finalHour: Math.ceil(summary.finalHour),
      durationHours: summary.durationHours,
      minBatteryKwh: summary.minBatteryKwh,
      minWaterLiters: summary.minWaterLiters,
      minOxygenKg: summary.minOxygenKg,
      scienceScore: summary.scienceScore,
      failureKind: summary.rootCause?.kind ?? null,
      failureReason: summary.failureReason ?? null,
      decisions: summary.keyDecisions.length,
      skills,
    }).catch(() => {
      // Saving is best-effort: a database outage must never interrupt the mission.
      recorded.current.delete(key);
    });
  }, [missionState, history]);

  return null;
}
