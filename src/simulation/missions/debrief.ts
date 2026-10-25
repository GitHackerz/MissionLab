import type { MissionSnapshot } from '../types';
import { getMission } from './registry';
import { co2Ppm, oxygenKpa, pressureKpa } from './gas';
import { FAULT_COMPONENT, atmosphericEvidenceSupport } from './emergency';

export function getAtmosphericSummary(history: MissionSnapshot[]) {
  const state=history.at(-1)!.state, e=state.emergency!, def=getMission(state.scenarioId), r=def.emergency!;
  const timeline=history.filter(x=>x.state.emergency).map(x=>{
    const a=x.state.emergency!, z=a.zones[a.crewZone];
    return {minute:a.minute,pressureKpa:pressureKpa(z,r.temperatureK),oxygenKpa:oxygenKpa(z,r.temperatureK),co2Ppm:co2Ppm(z),gasLostMol:a.gasLostMol};
  });
  const failedParts=e.repairs.filter(part=>part!==FAULT_COMPONENT[e.fault]);
  const latest=e.hypotheses.at(-1);
  const support=latest?atmosphericEvidenceSupport(latest.fault,e.evidence.filter(record=>latest.evidenceIds.includes(record.id))):'none';
  const revealed=state.status!=='running'||e.verification?.passed;
  return { title:def.title, result:state.status, terminationMinute:e.minute, rootCause:revealed?e.fault:null,
    minimumPressureKpa:Math.min(...timeline.map(x=>x.pressureKpa)), maximumCo2Ppm:Math.max(...timeline.map(x=>x.co2Ppm)),
    minimumOxygenKpa:Math.min(...timeline.map(x=>x.oxygenKpa)), gasLostMol:e.gasLostMol, oxygenLostMol:e.oxygenLostMol,
    co2RemovedMol:e.co2RemovedMol, evidence:structuredClone(e.evidence), hypotheses:structuredClone(e.hypotheses),
    verified:Boolean(e.verification?.passed), stableMinutes:e.stableMinutes, timeline,
    assessments:[
      {label:'System understanding',rating:e.inspected.length>=2?'Proficient':e.inspected.length?'Developing':'Not demonstrated',evidence:`${e.inspected.length} equipment components inspected.`},
      {label:'Scientific reasoning',rating:new Set(e.evidence.map(x=>x.test)).size>=2?'Proficient':e.evidence.length?'Developing':'Not demonstrated',evidence:`${e.evidence.length} diagnostic records; compare independent instruments.`},
      {label:'Diagnosis',rating:revealed&&e.hypotheses.at(-1)?.fault===e.fault&&support==='strong'?'Proficient':e.hypotheses.length?'Developing':'Not demonstrated',evidence:revealed?`Recorded hypothesis ${e.hypotheses.at(-1)?.fault??'none'}; actual fault ${e.fault}.`:'The root cause remains hidden until verification or mission conclusion.'},
      {label:'Planning and resources',rating:e.hypotheses.length&&failedParts.length===0?'Proficient':'Developing',evidence:revealed?`${failedParts.length} replacement(s) did not address the original fault. ${e.gasLostMol.toFixed(2)} mol gas lost; ${e.co2RemovedMol.toFixed(2)} mol CO₂ removed.`:'Interventions and resource costs are recorded independently of survival.'},
      {label:'Result verification',rating:e.verification?.passed?'Proficient':e.verification?'Developing':'Not demonstrated',evidence:e.verification?.reason??'No monitored recovery test requested.'},
    ],
  };
}
