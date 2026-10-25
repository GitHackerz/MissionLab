/** Reference policies execute real actions and retain real minute/decision history; no canned outcomes. */
import { createRegisteredMission } from '../engine';
import { createSnapshot, recordMissionAction } from '../history';
import type { MissionAction } from '../types';
import type { FaultId, MissionId } from './types';
import { FAULT_COMPONENT, emergencyRules } from './emergency';
export function runAtmosphericPath(id: Exclude<MissionId,'mission-01-red-storm'>, policy:'ignored'|'wrong'|'correct', fault?:FaultId) {
  let state=createRegisteredMission(id,fault), history=[createSnapshot(state)];
  const apply=(action:MissionAction)=>{
    const transition=recordMissionAction(state,history,action);
    if(!transition.result.ok)throw new Error(transition.result.reason);
    state=transition.result.state;history=transition.history;
  };
  const action=(command:Extract<MissionAction,{type:'EMERGENCY_ACTION'}>['command'])=>apply({type:'EMERGENCY_ACTION',command});
  if(policy==='ignored')apply({type:'ADVANCE_MINUTES',minutes:emergencyRules(state).durationMinutes});
  else {
    if(state.emergency!.kind==='air')apply({type:'ADVANCE_MINUTES',minutes:emergencyRules(state).faultMinute});
    action({kind:'diagnostic',test:policy!=='correct'?'independent-analyzer':state.emergency!.fault==='seal-leak'?'leak-survey':state.emergency!.fault==='fan-failure'?'fan-test':state.emergency!.fault==='media-exhausted'?'scrubber-test':'independent-analyzer'});
    const hypothesis=policy==='correct'?state.emergency!.fault:state.emergency!.kind==='pressure'?'pressure-sensor-drift':'co2-sensor-drift';
    action({kind:'hypothesis',fault:hypothesis,evidenceIds:[state.emergency!.evidence[0].id]});
    const component=FAULT_COMPONENT[hypothesis];
    if(component.endsWith('sensor'))action({kind:'calibrate',component});
    else {
      if(state.emergency!.kind==='pressure')action({kind:'exchange',enabled:false});
      else {action({kind:'fan',enabled:false});action({kind:'scrubber',enabled:false});}
      action({kind:'begin-repair',component});
      for(let step=0;step<7;step++)action({kind:'procedure',step});
      if(state.emergency!.kind==='air'){action({kind:'fan',enabled:true});action({kind:'scrubber',enabled:true});}
    }
    action({kind:'verify'});
    if(state.status==='running')apply({type:'ADVANCE_MINUTES',minutes:emergencyRules(state).durationMinutes});
  }
  return {state,history,branch:{branchId:state.branchId,forkHour:0,snapshots:history,finalStatus:state.status}};
}
