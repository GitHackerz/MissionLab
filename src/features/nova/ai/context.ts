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
import { NOVA_TARGET_IDS, canTarget } from '../targets';
import type { HintLevel, NovaIntent } from '../types';

export interface ContextReading { label: string; value: number; unit: string; min: number; max: number; inRange: boolean }
export interface ContextEvidence { title: string; hour: number; readings: ContextReading[] }

export interface LearnerContext {
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
  return m.status === 'success' || m.status === 'failed' || m.training?.recycler.procedure.verification?.passed === true;
}

export function buildLearnerContext(m: MissionState, view: ViewState): LearnerContext {
  const g = getGuidance(m);
  const t = m.training;
  const revealed = isOutcomeRevealed(m);
  const focusId = view.activeInteractableId ?? view.nearbyId;
  const used = new Set((t?.evidence ?? []).map((e) => e.testId));
  const probe = t && t.recycler.faultOnsetHour !== null && !revealed ? PROBES.find((p) => !used.has(p.test)) : undefined;
  const faultEvent = m.events.some((e) => e.type === 'PUMP_MECHANICAL_FAULT');
  return {
    mission: { hour: round(m.hour), durationHours: m.durationHours, status: m.status, stormActive: m.stormActive, crew: m.crewCount },
    stage: g.stage,
    objective: g.objective,
    learningMode: t?.mode ?? 'commander',
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
    inspected: (t?.inspectedComponents ?? []).map((c) => COMPONENT_NAMES[c] ?? c),
    diagnoses: (t?.hypotheses ?? []).slice(-2).map((h) => FAULT_LABEL[h.kind]),
    repair: {
      phase: t?.recycler.procedure.phase ?? 'available',
      stepsDone: t?.recycler.procedure.completedSteps.length ?? 0,
      verified: t?.recycler.procedure.verification ? t.recycler.procedure.verification.passed : null,
    },
    recentActions: (t?.log ?? []).slice(-5).map((l) => ({ action: l.action.split(':')[0], ok: l.ok })),
    nextProbe: probe ? { targetId: probe.targetId, label: probe.label, test: probe.testLabel } : null,
    revealed,
    debrief: revealed && t
      ? { fault: FAULT_LABEL[t.recycler.faultKind], outcome: m.status === 'success' ? 'Mission accomplished' : m.status === 'failed' ? `Mission stopped${m.failureReason ? `: ${m.failureReason}` : ''}` : 'Repair verified; mission continues' }
      : null,
  };
}

/** Targets offered to the model for this request (the server re-validates against the registry). */
export function allowedTargetsFor(ctx: LearnerContext, intent: NovaIntent, hintLevel: HintLevel): string[] {
  return NOVA_TARGET_IDS.filter((id) => canTarget(id, { hintLevel, intent, revealed: ctx.revealed }));
}
