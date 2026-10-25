/**
 * Learner-visible context projection. This is an explicit WHITELIST built field by field:
 * the store is never serialised. Private scenario data (configured fault kind, whether a fault
 * is active, live recycler readings the learner has not measured, future events) is not read here.
 */
import type { MissionState } from '@/simulation/types';
import { getGuidance, type GuidanceStage } from '@/simulation/training/guidance';
import { FAULT_LABEL } from '@/simulation/training/recycler';
import type { DiagnosticTestId } from '@/simulation/training/types';
import { INTERACTABLES, ROOMS, type RoomId } from '@/features/explore/world/layout';
import { getMission } from '@/simulation/missions/registry';
import { TEST_LABELS, COMPONENT_LABELS } from '@/simulation/missions/emergency';
import { getEmergencyMetrics } from '@/simulation/missions/presentation';
import { NOVA_TARGET_IDS, canTarget } from '../targets';
import type { HintLevel, NovaIntent } from '../types';

export interface ContextReading { label: string; value: number; unit: string; min: number; max: number; inRange: boolean }
export interface ContextEvidence { title: string; hour: number; readings: ContextReading[] }

export interface AtmosphereContext {
  /** Values exactly as the learner's own telemetry strip shows them. */
  metrics: { label: string; value: number | null; unit: string; limit: string }[];
  tests: string[];
  /** Readings the learner collected, latest first-class evidence for explanations. */
  evidence: { test: string; minute: number; readings: { label: string; value: number; unit: string }[] }[];
  inspected: string[];
  procedureActive: boolean;
  verification: 'none' | 'running' | 'passed' | 'failed';
}

export interface LearnerContext {
  missionId: string;
  missionTitle: string;
  concept: string;
  /** Present for the atmospheric missions only. */
  atmosphere: AtmosphereContext | null;
  mission: { hour: number; durationHours: number; status: string; stormActive: boolean; crew: number };
  stage: GuidanceStage;
  objective: string;
  learningMode: 'cadet' | 'engineer' | 'commander';
  location: string | null;
  focus: string | null;
  resources: { batteryKwh: number; batteryCapacityKwh: number; waterLiters: number; oxygenKg: number; foodRations: number };
  power: { solarKw: number; requestedKw: number; suppliedKw: number; unservedKw: number } | null;
  modules: { name: string; status: string; enabled: boolean }[];
  recentEvents: { hour: number; severity: string; message: string }[];
  evidence: ContextEvidence[];
  inspected: string[];
  /** The learner's own recorded diagnoses (their choice, not the engine's answer). */
  diagnoses: string[];
  repair: { phase: string; stepsDone: number; verified: boolean | null };
  recentActions: { action: string; ok: boolean }[];
  /** Next diagnostic instrument the learner has not used yet. Derived from their own evidence gaps, not from the fault. */
  nextProbe: { targetId: string; label: string; test: string } | null;
  /** True only once the outcome is legitimately known (mission over or repair verified). */
  revealed: boolean;
  /** Present only when `revealed`. */
  debrief: { fault: string; outcome: string } | null;
}

export interface NovaRequestBody {
  intent: NovaIntent;
  message?: string;
  hintLevel: HintLevel;
  context: LearnerContext;
  /** Ids NOVA may name in `visualAction` for this request. */
  allowedTargets: string[];
}

const PROBES: { test: DiagnosticTestId; targetId: string; label: string; testLabel: string }[] = [
  { test: 'read-pressure', targetId: 'part:pressure-gauges', label: 'Pressure gauges', testLabel: 'Read pressure gauges' },
  { test: 'check-pump', targetId: 'part:pump-cartridge', label: 'Pump cartridge', testLabel: 'Check pump operation' },
  { test: 'compare-output', targetId: 'part:clean-tank', label: 'Clean-water output tank', testLabel: 'Compare sensor with clean-tank inflow' },
];

const COMPONENT_NAMES: Record<string, string> = {
  'wastewater-tank': 'Wastewater input tank', 'pump-cartridge': 'Pump cartridge', 'filter-cartridge': 'Filter cartridge', 'treatment-stage': 'Treatment stage',
  'flow-sensor': 'Flow sensor module', 'clean-tank': 'Clean-water output tank', 'service-hatch': 'Service hatch', 'control-panel': 'Control panel',
};

const round = (n: number, d = 1) => Number(n.toFixed(d));

export interface ViewState {
  room: RoomId | null;
  activeInteractableId: string | null;
  nearbyId: string | null;
}

export function isOutcomeRevealed(m: MissionState): boolean {
  if (m.emergency) return m.status === 'success' || m.status === 'failed' || m.emergency.verification?.passed === true;
  return m.status === 'success' || m.status === 'failed' || m.training?.recycler.procedure.verification?.passed === true;
}

const atmosphereStation = (m: MissionState) => (m.emergency?.kind === 'pressure' ? { id: 'station:crew-terminal', label: 'Atmospheric Control Console' } : { id: 'station:air-unit', label: 'Air Treatment Console' });

/** Learner-visible atmospheric view: their own evidence and the telemetry strip, never the configured fault. */
function atmosphereOf(m: MissionState): AtmosphereContext | null {
  const e = m.emergency;
  if (!e) return null;
  const v = e.verification;
  return {
    metrics: getEmergencyMetrics(m).map(({ label, value, unit, limit }) => ({ label, value: value === null ? null : Number(value.toFixed(3)), unit, limit })),
    tests: [...new Set(e.evidence.map((x) => TEST_LABELS[x.test]))],
    evidence: e.evidence.slice(-3).map((x) => ({ test: TEST_LABELS[x.test], minute: x.minute, readings: x.readings.map((r) => ({ label: r.label, value: Number(r.value.toFixed(3)), unit: r.unit })) })),
    inspected: e.inspected.map((c) => COMPONENT_LABELS[c]),
    procedureActive: e.procedure !== null,
    verification: !v ? 'none' : v.passed ? 'passed' : v.completedMinute === undefined ? 'running' : 'failed',
  };
}

export function buildLearnerContext(m: MissionState, view: ViewState): LearnerContext {
  const g = getGuidance(m);
  const t = m.training;
  const revealed = isOutcomeRevealed(m);
  const focusId = view.activeInteractableId ?? view.nearbyId;
  const used = new Set((t?.evidence ?? []).map((e) => e.testId));
  const probe = t && !m.emergency && t.recycler.faultOnsetHour !== null && !revealed ? PROBES.find((p) => !used.has(p.test)) : undefined;
  const e = m.emergency;
  const nextTest = e && !revealed ? getMission(m.scenarioId).diagnosticTests.find((x) => !e.evidence.some((r) => r.test === x)) : undefined;
  const faultEvent = m.events.some((e) => e.type === 'PUMP_MECHANICAL_FAULT');
  return {
    missionId: m.scenarioId,
    missionTitle: getMission(m.scenarioId).title,
    concept: getMission(m.scenarioId).concept,
    atmosphere: atmosphereOf(m),
    mission: { hour: round(m.hour), durationHours: m.durationHours, status: m.status, stormActive: m.stormActive, crew: m.crewCount },
    stage: g.stage,
    objective: g.objective,
    learningMode: e?.mode ?? t?.mode ?? 'commander',
    location: view.room ? ROOMS[view.room].label : null,
    focus: INTERACTABLES.find((i) => i.id === focusId)?.label ?? null,
    resources: {
      batteryKwh: round(m.resources.batteryKwh), batteryCapacityKwh: round(m.resources.batteryCapacityKwh), waterLiters: round(m.resources.waterLiters),
      oxygenKg: round(m.resources.oxygenKg, 2), foodRations: round(m.resources.foodRations),
    },
    power: m.power
      ? { solarKw: round(m.power.solarGenerationKw), requestedKw: round(m.power.requestedPowerKw), suppliedKw: round(m.power.suppliedPowerKw), unservedKw: round(m.power.unservedPowerKw) }
      : null,
    modules: Object.values(m.modules).map((x) => ({ name: x.name, status: x.status, enabled: x.enabled })),
    recentEvents: m.events
      .filter((e) => e.severity !== 'info')
      .slice(-4)
      // Legacy (non-training) missions name the root cause in the event text; hide it until the outcome is known.
      .map((e) => ({ hour: e.hour, severity: e.severity, message: faultEvent && !revealed && e.type === 'PUMP_MECHANICAL_FAULT' ? 'Water recovery has stopped. Inspect the water recycler.' : e.message })),
    evidence: (t?.evidence ?? []).slice(-4).map((e) => ({
      title: e.title,
      hour: e.hour,
      readings: e.readings.map((r) => ({ label: r.label, value: r.value, unit: r.unit, min: r.expectedMin, max: r.expectedMax, inRange: r.inRange })),
    })),
    inspected: e ? e.inspected.map((c) => COMPONENT_LABELS[c]) : (t?.inspectedComponents ?? []).map((c) => COMPONENT_NAMES[c] ?? c),
    diagnoses: e ? e.hypotheses.slice(-2).map((h) => h.fault.replace(/-/g, ' ')) : (t?.hypotheses ?? []).slice(-2).map((h) => FAULT_LABEL[h.kind]),
    repair: {
      phase: t?.recycler.procedure.phase ?? 'available',
      stepsDone: t?.recycler.procedure.completedSteps.length ?? 0,
      verified: t?.recycler.procedure.verification ? t.recycler.procedure.verification.passed : null,
    },
    recentActions: (t?.log ?? []).slice(-5).map((l) => ({ action: l.action.split(':')[0], ok: l.ok })),
    nextProbe: probe ? { targetId: probe.targetId, label: probe.label, test: probe.testLabel } : nextTest ? { targetId: atmosphereStation(m).id, label: atmosphereStation(m).label, test: TEST_LABELS[nextTest] } : null,
    revealed,
    debrief: revealed && e ? { fault: e.fault.replace(/-/g, ' '), outcome: m.status === 'success' ? 'Mission accomplished' : m.status === 'failed' ? `Mission stopped${m.failureReason ? `: ${m.failureReason}` : ''}` : 'Recovery verified; mission continues' } : revealed && t
      ? { fault: FAULT_LABEL[t.recycler.faultKind], outcome: m.status === 'success' ? 'Mission accomplished' : m.status === 'failed' ? `Mission stopped${m.failureReason ? `: ${m.failureReason}` : ''}` : 'Repair verified; mission continues' }
      : null,
  };
}

/** Targets offered to the model for this request (the server re-validates against the registry). */
export function allowedTargetsFor(ctx: LearnerContext, intent: NovaIntent, hintLevel: HintLevel): string[] {
  return NOVA_TARGET_IDS.filter((id) => canTarget(id, { hintLevel, intent, revealed: ctx.revealed }));
}
