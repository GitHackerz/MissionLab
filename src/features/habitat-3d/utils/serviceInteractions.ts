/**
 * Maps a 3D click on the water recycler to the engine action it REQUESTS.
 * The scene never decides whether the request is legal: the engine validates it
 * and explains rejections. These mappings only depend on authoritative state.
 */
import type { MissionState } from '@/simulation/types';
import type {
  RecyclerComponentId,
  ReplaceableId,
  ToolId,
  TrainingAction,
  TrainingState,
} from '@/simulation/training/types';
import { FAULT_SLOT } from '@/simulation/training/recycler';

export type ServiceHotspot =
  | { kind: 'component'; id: RecyclerComponentId }
  | { kind: 'hatch' }
  | { kind: 'control-panel' }
  | { kind: 'retainer'; slot: ReplaceableId }
  | { kind: 'pull-handle'; slot: ReplaceableId }
  | { kind: 'bay'; slot: ReplaceableId }
  | { kind: 'spare'; part: ReplaceableId }
  | { kind: 'tool'; tool: ToolId }
  | { kind: 'held-part' };

export function hotspotKey(h: ServiceHotspot): string {
  switch (h.kind) {
    case 'component': return `component:${h.id}`;
    case 'retainer':
    case 'pull-handle':
    case 'bay': return `${h.kind}:${h.slot}`;
    case 'spare': return `spare:${h.part}`;
    case 'tool': return `tool:${h.tool}`;
    default: return h.kind;
  }
}

export function actionForHotspot(h: ServiceHotspot, training: TrainingState): TrainingAction {
  const p = training.recycler.procedure;
  switch (h.kind) {
    case 'component':
      return { type: 'INSPECT_COMPONENT', componentId: h.id };
    case 'hatch':
      return { type: 'TRAINING_STEP', step: { step: p.hatchOpen ? 'CLOSE_HATCH' : 'OPEN_HATCH' } };
    case 'control-panel':
      if (p.testReady) return { type: 'TRAINING_STEP', step: { step: 'RUN_STARTUP_TEST' } };
      if (!p.maintenanceMode) return { type: 'TRAINING_STEP', step: { step: 'ENTER_MAINTENANCE_MODE' } };
      if (!p.inactiveConfirmed) return { type: 'TRAINING_STEP', step: { step: 'CONFIRM_INACTIVE' } };
      return { type: 'TRAINING_STEP', step: { step: 'RESTORE_TEST_READY' } };
    case 'retainer':
      return { type: 'TRAINING_STEP', step: { step: p.slots[h.slot].retainers === 'locked' ? 'RELEASE_RETAINERS' : 'SECURE_COMPONENT', slot: h.slot } };
    case 'pull-handle':
      return { type: 'TRAINING_STEP', step: { step: 'REMOVE_COMPONENT', slot: h.slot } };
    case 'bay':
      return p.held
        ? { type: 'TRAINING_STEP', step: { step: 'INSTALL_COMPONENT', slot: h.slot } }
        : { type: 'INSPECT_COMPONENT', componentId: h.slot };
    case 'spare':
      return { type: 'TRAINING_STEP', step: { step: 'TAKE_SPARE', part: h.part } };
    case 'tool':
      return { type: 'TRAINING_STEP', step: { step: 'SELECT_TOOL', tool: h.tool } };
    case 'held-part':
      return { type: 'TRAINING_STEP', step: { step: p.held?.inspected ? 'ROTATE_PART' : 'INSPECT_SPARE' } };
  }
}

/**
 * Cadet-mode highlight: the next sensible control for the repair the learner
 * has chosen. Derived from THEIR diagnosis, so it never reveals the real fault.
 */
export function nextHintKey(state: MissionState): string | null {
  const t = state.training;
  if (!t || t.mode !== 'cadet') return null;
  const p = t.recycler.procedure;
  const chosen = t.hypotheses.length ? FAULT_SLOT[t.hypotheses[t.hypotheses.length - 1].kind] : null;
  if (!chosen) return null;
  if (p.testReady) return 'control-panel';
  if (!p.maintenanceMode) return p.isolationReviewed ? 'control-panel' : null;
  if (!p.inactiveConfirmed) return 'control-panel';
  if (!p.hatchOpen) {
    const allDone = Object.values(p.slots).every((s) => s.occupant !== 'empty' && s.retainers === 'locked') && p.completedSteps.includes('install-component');
    if (allDone) return 'control-panel';
    return p.tool === 'hatch-key' ? 'hatch' : 'tool:hatch-key';
  }
  const s = p.slots[chosen];
  if (p.held) {
    if (!p.held.inspected || p.held.orientation !== 0) return 'held-part';
    return `bay:${chosen}`;
  }
  if (s.occupant === 'original') {
    if (p.tool !== 'retainer-driver') return 'tool:retainer-driver';
    return s.retainers === 'locked' ? `retainer:${chosen}` : `pull-handle:${chosen}`;
  }
  if (s.occupant === 'empty') return `spare:${chosen}`;
  if (s.retainers === 'released') return p.tool === 'retainer-driver' ? `retainer:${chosen}` : 'tool:retainer-driver';
  return 'hatch';
}
