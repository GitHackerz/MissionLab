'use client';

import { useEffect, useRef } from 'react';
import { useMissionStore } from '@/state/missionStore';
import { getMissionSummary } from '@/simulation/debrief';
import { assessLearning } from '@/simulation/training/assessment';
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
    const assessment = assessLearning(missionState);
    recordMissionRun({
      scenarioId: summary.scenarioId,
      status: missionState.status,
      finalHour: summary.finalHour,
      durationHours: summary.durationHours,
      minBatteryKwh: summary.minBatteryKwh,
      minWaterLiters: summary.minWaterLiters,
      minOxygenKg: summary.minOxygenKg,
      scienceScore: summary.scienceScore,
      failureKind: summary.rootCause?.kind ?? null,
      failureReason: summary.failureReason ?? null,
      decisions: summary.keyDecisions.length,
      skills: assessment ? assessment.dimensions.map(({ id, label, rating }) => ({ id, label, rating })) : null,
    }).catch(() => {
      // Saving is best-effort: a database outage must never interrupt the mission.
      recorded.current.delete(key);
    });
  }, [missionState, history]);

  return null;
}
