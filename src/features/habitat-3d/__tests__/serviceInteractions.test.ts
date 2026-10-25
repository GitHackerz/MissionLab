import { describe, expect, it } from 'vitest';
import { advanceMission, applyMissionAction, createTrainingMission, type MissionState } from '@/simulation';
import { actionForHotspot, hotspotKey, nextHintKey } from '../utils/serviceInteractions';

const faultState = (): MissionState => {
  const planned = applyMissionAction(createTrainingMission(), { type: 'APPLY_POWER_PLAN', loads: { greenhouse: false, 'research-lab': false } });
  return advanceMission(planned.state, 30);
};

describe('3D hotspot to engine-action mapping', () => {
  it('requests inspection for components and never decides outcomes itself', () => {
    const t = faultState().training!;
    expect(actionForHotspot({ kind: 'component', id: 'pump-cartridge' }, t)).toEqual({ type: 'INSPECT_COMPONENT', componentId: 'pump-cartridge' });
    expect(actionForHotspot({ kind: 'tool', tool: 'hatch-key' }, t)).toEqual({ type: 'TRAINING_STEP', step: { step: 'SELECT_TOOL', tool: 'hatch-key' } });
    expect(actionForHotspot({ kind: 'spare', part: 'filter-cartridge' }, t)).toEqual({ type: 'TRAINING_STEP', step: { step: 'TAKE_SPARE', part: 'filter-cartridge' } });
  });

  it('chooses the control-panel request from authoritative procedure state', () => {
    const t = faultState().training!;
    const step = (s: ReturnType<typeof actionForHotspot>) => (s.type === 'TRAINING_STEP' ? s.step.step : s.type);
    expect(step(actionForHotspot({ kind: 'control-panel' }, t))).toBe('ENTER_MAINTENANCE_MODE');
    t.recycler.procedure.maintenanceMode = true;
    expect(step(actionForHotspot({ kind: 'control-panel' }, t))).toBe('CONFIRM_INACTIVE');
    t.recycler.procedure.inactiveConfirmed = true;
    expect(step(actionForHotspot({ kind: 'control-panel' }, t))).toBe('RESTORE_TEST_READY');
    t.recycler.procedure.testReady = true;
    expect(step(actionForHotspot({ kind: 'control-panel' }, t))).toBe('RUN_STARTUP_TEST');
  });

  it('toggles hatch and retainers by current state, and installs only when a part is held', () => {
    const t = faultState().training!;
    const p = t.recycler.procedure;
    expect(actionForHotspot({ kind: 'hatch' }, t)).toMatchObject({ step: { step: 'OPEN_HATCH' } });
    p.hatchOpen = true;
    expect(actionForHotspot({ kind: 'hatch' }, t)).toMatchObject({ step: { step: 'CLOSE_HATCH' } });
    expect(actionForHotspot({ kind: 'retainer', slot: 'pump-cartridge' }, t)).toMatchObject({ step: { step: 'RELEASE_RETAINERS' } });
    p.slots['pump-cartridge'].retainers = 'released';
    expect(actionForHotspot({ kind: 'retainer', slot: 'pump-cartridge' }, t)).toMatchObject({ step: { step: 'SECURE_COMPONENT' } });
    expect(actionForHotspot({ kind: 'bay', slot: 'pump-cartridge' }, t).type).toBe('INSPECT_COMPONENT');
    p.held = { part: 'pump-cartridge', orientation: 180, inspected: false };
    expect(actionForHotspot({ kind: 'bay', slot: 'pump-cartridge' }, t)).toMatchObject({ step: { step: 'INSTALL_COMPONENT' } });
    expect(actionForHotspot({ kind: 'held-part' }, t)).toMatchObject({ step: { step: 'INSPECT_SPARE' } });
    p.held.inspected = true;
    expect(actionForHotspot({ kind: 'held-part' }, t)).toMatchObject({ step: { step: 'ROTATE_PART' } });
  });

  it('gives stable unique keys per hotspot', () => {
    const keys = [
      hotspotKey({ kind: 'hatch' }),
      hotspotKey({ kind: 'retainer', slot: 'pump-cartridge' }),
      hotspotKey({ kind: 'retainer', slot: 'flow-sensor' }),
      hotspotKey({ kind: 'tool', tool: 'hatch-key' }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('cadet hints follow the learner’s own diagnosis, never the real fault', () => {
    const s = faultState();
    expect(nextHintKey(s)).toBeNull(); // no diagnosis yet: nothing to point at
    s.training!.hypotheses.push({ id: 'h', hour: 30, kind: 'filter-clogged', evidenceIds: [], support: 'none' });
    s.training!.recycler.procedure.isolationReviewed = true;
    expect(nextHintKey(s)).toBe('control-panel');
    const p = s.training!.recycler.procedure;
    p.maintenanceMode = true;
    p.inactiveConfirmed = true;
    p.hatchOpen = true;
    p.tool = 'retainer-driver';
    expect(nextHintKey(s)).toBe('retainer:filter-cartridge'); // their chosen part, though the real fault is the pump
    s.training!.mode = 'commander';
    expect(nextHintKey(s)).toBeNull();
  });
});
