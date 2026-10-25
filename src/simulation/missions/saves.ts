import { z } from 'zod';
import { ALL_MODULE_IDS, type MissionState } from '../types';
import { validateConfig } from '../config';
import { getMission, isMissionId } from './registry';
import { FAULT_COMPONENT } from './emergency';

function finiteTree(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteTree);
  if (value && typeof value === 'object') return Object.values(value).every(finiteTree);
  return true;
}
export function validMissionState(value: unknown): value is MissionState {
  if (!value || typeof value !== 'object' || !finiteTree(value)) return false;
  const s = value as MissionState;
  try {
    if (!isMissionId(s.scenarioId) || (s.missionVersion ?? 1) !== getMission(s.scenarioId).version || typeof s.branchId !== 'string'
      || !['briefing', 'running', 'success', 'failed'].includes(s.status) || !Number.isFinite(s.hour) || s.hour < 0 || !Number.isFinite(s.scienceScore)
      || typeof s.stormActive !== 'boolean' || !Number.isSafeInteger(s.crewCount) || s.crewCount < 1) return false;
    if (!s.resources || Object.values(s.resources).some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0)
      || !['batteryKwh','batteryCapacityKwh','waterLiters','oxygenKg','foodRations','sparePumps'].every(key => key in s.resources)
      || s.resources.batteryKwh > s.resources.batteryCapacityKwh || !Number.isSafeInteger(s.resources.sparePumps)) return false;
    if (!s.modules || !ALL_MODULE_IDS.every(id => s.modules[id]?.id === id && typeof s.modules[id].enabled === 'boolean'
      && ['operational','warning','degraded','offline','repairing'].includes(s.modules[id].status)
      && Number.isFinite(s.modules[id].health) && s.modules[id].health >= 0 && s.modules[id].health <= 1
      && Number.isFinite(s.modules[id].powerDemandKw) && s.modules[id].powerDemandKw >= 0
      && Number.isFinite(s.modules[id].suppliedPowerKw) && s.modules[id].suppliedPowerKw >= 0)) return false;
    if (!Array.isArray(s.events) || !s.events.every(e => typeof e.id === 'string' && typeof e.type === 'string' && typeof e.message === 'string' && Number.isFinite(e.hour))) return false;
    if (s.config) { validateConfig(s.config); if (s.config.scenarioId !== s.scenarioId) return false; }
    if (s.scenarioId !== 'mission-01-red-storm') {
      const e = s.emergency;
      if (!e || !s.config || !Number.isSafeInteger(e.minute) || e.minute < 0 || s.hour !== e.minute / 60
        || !['pressure','air'].includes(e.kind) || e.kind !== (s.scenarioId === 'mission-02-pressure-drop' ? 'pressure' : 'air')
        || !getMission(s.scenarioId).components.includes(FAULT_COMPONENT[e.fault])
        || !['cadet','engineer','commander'].includes(e.mode) || !['hub','service'].includes(e.crewZone)) return false;
      if (!Number.isSafeInteger(e.sequence) || e.sequence < 0 || !Number.isSafeInteger(e.stableMinutes) || e.stableMinutes < 0) return false;
      for (const key of ['valveCommandOpen','valveActualOpen','exchangeEnabled','regulatorEnabled','fanEnabled','scrubberEnabled','backupEnabled','faultTriggered'] as const) if (typeof e[key] !== 'boolean') return false;
      for (const key of ['atmosphereReserveMol','scrubberRemainingMol','backupRemainingMol','gasLostMol','oxygenLostMol','oxygenFedMol','co2RemovedMol','leakMolPerMin','co2RemovalMolPerMin','equipmentSupplyKw','equipmentDemandKw'] as const) if (!Number.isFinite(e[key]) || e[key] < 0) return false;
      for (const zone of [e.zones?.hub,e.zones?.service]) if (!zone || !['volumeM3','inertMol','oxygenMol','co2Mol'].every(k => typeof zone[k as keyof typeof zone] === 'number' && zone[k as keyof typeof zone] >= 0)) return false;
      if (e.zones.hub.volumeM3 !== getMission(s.scenarioId).emergency!.hubVolumeM3 || e.zones.service.volumeM3 !== getMission(s.scenarioId).emergency!.serviceVolumeM3) return false;
      if (!Array.isArray(e.evidence) || !e.evidence.every(x => typeof x.id === 'string' && Number.isSafeInteger(x.minute) && getMission(s.scenarioId).diagnosticTests.includes(x.test) && Array.isArray(x.readings)
        && x.readings.every(r => typeof r.label === 'string' && typeof r.unit === 'string' && Number.isFinite(r.value)))) return false;
      if (!Array.isArray(e.hypotheses) || !e.hypotheses.every(h => h.fault in FAULT_COMPONENT && Array.isArray(h.evidenceIds) && h.evidenceIds.every(id => e.evidence.some(x => x.id === id)))) return false;
      if (!Array.isArray(e.repairs) || !Array.isArray(e.inspected) || ![...e.repairs,...e.inspected].every(x => getMission(s.scenarioId).components.includes(x))) return false;
      if (!e.spares || !Object.keys(FAULT_COMPONENT).every(f => Number.isSafeInteger(e.spares[FAULT_COMPONENT[f as keyof typeof FAULT_COMPONENT]]) && e.spares[FAULT_COMPONENT[f as keyof typeof FAULT_COMPONENT]] >= 0)) return false;
      if (e.procedure && (!getMission(s.scenarioId).components.includes(e.procedure.component) || !Number.isSafeInteger(e.procedure.step) || e.procedure.step < 0 || e.procedure.step > 6 || !['coverOpen','removed','tool'].every(k => typeof e.procedure![k as 'tool'] === 'boolean'))) return false;
      if (e.verification && (!Number.isSafeInteger(e.verification.requestedMinute) || typeof e.verification.passed !== 'boolean' || typeof e.verification.reason !== 'string')) return false;
    } else if (s.emergency) return false;
    if (s.training && (!Array.isArray(s.training.log) || !Array.isArray(s.training.evidence) || !Array.isArray(s.training.hypotheses)
      || !s.training.recycler?.procedure || !Array.isArray(s.training.recycler.procedure.completedSteps))) return false;
    return true;
  } catch { return false; }
}
const snapshot = z.object({ snapshotId:z.string(), branchId:z.string(), hour:z.number().finite().nonnegative(), state:z.custom<MissionState>(validMissionState), actionTaken:z.unknown().optional(), timestamp:z.number().finite().nonnegative() });
export const savedSessionSchema = z.object({ missionState:z.custom<MissionState>(validMissionState), history:z.array(snapshot).min(1),
  branches:z.array(z.object({ branchId:z.string(), parentBranchId:z.string().optional(), forkHour:z.number().finite().nonnegative(), snapshots:z.array(snapshot).min(1), finalStatus:z.enum(['briefing','running','success','failed']) })), trainingMode:z.boolean() });
export function compatibleSession(value: unknown): boolean {
  const parsed = savedSessionSchema.safeParse(value);
  if (!parsed.success) return false;
  const s = parsed.data, id = s.missionState.scenarioId;
  return [...s.history,...s.branches.flatMap(b=>b.snapshots)].every(x=>x.state.scenarioId === id && x.hour === x.state.hour && x.branchId === x.state.branchId)
    && new Set(s.history.map(x=>x.snapshotId)).size === s.history.length
    && JSON.stringify(s.history.at(-1)!.state) === JSON.stringify(s.missionState);
}
