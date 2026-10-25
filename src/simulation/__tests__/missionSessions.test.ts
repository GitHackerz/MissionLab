import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useMissionStore, loadSessionFromStorage, saveSessionToStorage } from '@/state/missionStore';
import { createRegisteredMission, createTrainingMission } from '../engine';
import { createSnapshot } from '../history';
import { compatibleSession } from '../missions/saves';
import { getFankouchLine } from '../missions/presentation';
const get=()=>useMissionStore.getState();
beforeEach(()=>{localStorage.clear();get().startMission('mission-01-red-storm');});
afterEach(()=>{get().startMission('mission-01-red-storm');localStorage.clear();});
describe('versioned independent local mission sessions',()=>{
  it('switches and restores each mission and its evidence independently',()=>{
    get().startMission('mission-02-pressure-drop');
    get().applyAction({type:'EMERGENCY_ACTION',command:{kind:'diagnostic',test:'zone-survey'}});
    expect(get().missionState.emergency!.evidence).toHaveLength(1);
    get().startMission('mission-03-silent-air');
    get().applyAction({type:'ADVANCE_MINUTES',minutes:15});
    expect(loadSessionFromStorage('mission-02-pressure-drop')!.missionState.emergency!.evidence).toHaveLength(1);
    expect(get().restoreSession('mission-02-pressure-drop')).toBe(true);
    expect(get().missionState.scenarioId).toBe('mission-02-pressure-drop');
    expect(get().missionState.emergency!.minute).toBe(2);
    expect(loadSessionFromStorage()!.missionState.scenarioId).toBe('mission-02-pressure-drop');
    expect(get().history.map(s=>s.state.emergency!.minute)).toEqual([0,0,1,2]);
    expect(get().restoreSession('mission-03-silent-air')).toBe(true);
    expect(get().missionState.emergency!.minute).toBe(15);
    expect(get().missionState.emergency!.evidence).toHaveLength(0);
    get().resetMission();
    expect(get().missionState.scenarioId).toBe('mission-03-silent-air');
    expect(get().missionState.emergency!.minute).toBe(0);
  });
  it('rewinds fractional-hour decisions from terminal failure without changing original history',()=>{
    get().startMission('mission-02-pressure-drop');
    get().applyAction({type:'ADVANCE_MINUTES',minutes:2});
    const target=get().history.at(-1)!;
    get().applyAction({type:'ADVANCE_MINUTES',minutes:180});
    const original=structuredClone(get().history);
    expect(get().missionState.status).toBe('failed');
    expect(get().applyAction({type:'REWIND_TO',hour:target.hour,snapshotId:target.snapshotId,branchFrom:get().missionState.branchId}).ok).toBe(true);
    expect(get().missionState.emergency!.minute).toBe(2);
    expect(loadSessionFromStorage()!.missionState.scenarioId).toBe('mission-02-pressure-drop');
    expect(get().branches[0].snapshots).toEqual(original);
    expect(get().applyAction({type:'EMERGENCY_ACTION',command:{kind:'exchange',enabled:false}}).ok).toBe(true);
    expect(get().branches[0].snapshots).toEqual(original);
  });
  it('migrates a valid legacy Red Storm save and never restores it as Pressure Drop',()=>{
    localStorage.clear();
    const missionState=createTrainingMission();
    localStorage.setItem('missionlab_active_session_v1',JSON.stringify({missionState,history:[createSnapshot(missionState)],branches:[],trainingMode:true}));
    expect(loadSessionFromStorage()!.missionState.scenarioId).toBe('mission-01-red-storm');
    expect(loadSessionFromStorage('mission-02-pressure-drop')).toBeNull();
  });
  it('rejects mismatched mission, version, clock, invalid inventories and corrupted history',()=>{
    get().startMission('mission-02-pressure-drop');
    const valid=loadSessionFromStorage()!;
    expect(compatibleSession(valid)).toBe(true);
    for(const mutate of [
      (s:typeof valid)=>{s.missionState.missionVersion=99;},
      (s:typeof valid)=>{s.missionState.emergency!.zones.hub.oxygenMol=-1;},
      (s:typeof valid)=>{s.missionState.hour=NaN;},
      (s:typeof valid)=>{s.missionState.emergency!.minute=8;},
      (s:typeof valid)=>{s.history[0].state.scenarioId='mission-03-silent-air';},
    ]) {const copy=structuredClone(valid);mutate(copy);expect(compatibleSession(copy)).toBe(false);}
    localStorage.setItem('missionlab_sessions_v2','{"formatVersion":2,"activeMissionId":"mission-02-pressure-drop","sessions":{"mission-02-pressure-drop":{"missionVersion":99,"session":{}}}}');
    expect(get().restoreSession('mission-02-pressure-drop')).toBe(false);
    expect(get().saveRecoveryMessage).toContain('fresh attempt');
  });
  it('preserves local branches across save/restore and never auto-runs after refresh',()=>{
    get().startMission('mission-02-pressure-drop');get().applyAction({type:'ADVANCE_MINUTES',minutes:3});get().rewindTo(0);
    const before=structuredClone(get().branches);get().setAutoRunning(true);
    saveSessionToStorage(get());
    expect(get().restoreSession('mission-02-pressure-drop')).toBe(true);
    expect(get().branches).toEqual(before);expect(get().autoRunning).toBe(false);
  });
  it('Fankouch never names hidden faults and responds to actual stage and risk',()=>{
    for(const id of ['mission-02-pressure-drop','mission-03-silent-air'] as const){
      const s=createRegisteredMission(id), initial=getFankouchLine(s);
      expect(initial.text).not.toContain(s.emergency!.fault);
      s.emergency!.evidence.push({id:'measurement',minute:0,test:'independent-analyzer',readings:[]});
      expect(getFankouchLine(s).id).not.toBe(initial.id);
      s.status='failed';expect(getFankouchLine(s).serious).toBe(true);
    }
  });
});
it('UI waits stop at the first new warning without changing pure engine batched APIs',()=>{
  get().startMission('mission-03-silent-air');get().applyAction({type:'ADVANCE_MINUTES',minutes:60});
  expect(get().missionState.emergency!.minute).toBe(15);
  expect(get().missionState.events.filter(e=>e.type==='ATMOSPHERE_WARNING')).toHaveLength(1);
  get().startMission('mission-01-red-storm');localStorage.clear();
});
