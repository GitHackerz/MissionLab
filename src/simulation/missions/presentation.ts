import type { MissionState } from '../types';
import { getMission } from './registry';
import { activeFault, emergencyReadings, emergencyRules } from './emergency';
import { co2Ppm, oxygenKpa, pressureKpa } from './gas';

export function getEmergencyObjective(s: MissionState) {
  const e = s.emergency!, def = getMission(s.scenarioId);
  const stage = s.status !== 'running' ? 'concluded' : e.procedure ? 'intervention' : e.verification ? 'verification'
    : e.hypotheses.length ? 'planning' : e.evidence.length ? 'diagnosis' : 'investigation';
  const title = s.status !== 'running' ? (s.status === 'success' ? 'Verified recovery' : 'Review the failed safety condition')
    : stage === 'intervention' ? 'Complete safe equipment service' : stage === 'verification' ? 'Monitor the recovery window'
    : stage === 'planning' ? 'Choose an intervention supported by your evidence' : stage === 'diagnosis' ? 'Explain all measurements with a hypothesis' : def.objective;
  const detail = s.status !== 'running' ? 'Open Mission Autopsy. Rewind a saved point to compare an alternative strategy.'
    : stage === 'verification' ? e.verification!.reason : e.kind === 'pressure'
      ? 'Compare the compartment gauges, independent analyzer, leak survey and valve position. Isolation changes the gas path; calibration only changes an instrument.'
      : 'Compare independent CO₂ with fan speed and scrubber removal. Oxygen inventory alone does not establish safe air.';
  return { stage, title, detail, destination: def.destination, wait: stage === 'verification' };
}
export function getEmergencyMetrics(s: MissionState) {
  const e = s.emergency!, r = emergencyRules(s), zone = e.zones[e.crewZone];
  const independent = e.evidence.some(x=>x.test==='independent-analyzer');
  if (e.kind === 'pressure') return [
    { label: 'Hub panel', value: emergencyReadings(s,'zone-survey')[0].value, unit: 'kPa', limit: `safe > ${r.minimumPressureKpa}`, unsafe: pressureKpa(zone,r.temperatureK)<=r.minimumPressureKpa },
    { label: 'Service zone', value: pressureKpa(e.zones.service,r.temperatureK), unit: 'kPa', limit: e.valveActualOpen && e.exchangeEnabled ? 'connected' : 'isolated', unsafe: false },
    { label: 'Occupied O₂ partial pressure', value: oxygenKpa(zone,r.temperatureK), unit: 'kPa', limit: `safe > ${r.minimumOxygenKpa}`, unsafe: oxygenKpa(zone,r.temperatureK)<=r.minimumOxygenKpa },
    { label: 'Gas lost', value: e.gasLostMol, unit: 'mol', limit: `reserve ${e.atmosphereReserveMol.toFixed(1)} mol`, unsafe: false },
    { label: 'Pressure trend', value: e.pressureTrendKpaPerMin, unit: 'kPa/min', limit: 'occupied zone · actual', unsafe: e.pressureTrendKpaPerMin<-.3 },
    { label: 'Independent pressure', value: independent ? pressureKpa(zone,r.temperatureK) : null, unit: 'kPa', limit: independent?'reference instrument':'Run analyzer', unsafe: false },
  ];
  const panel = emergencyReadings(s,'independent-analyzer')[3].value;
  return [
    { label: 'Panel CO₂', value: panel, unit: 'ppm', limit: `unsafe ≥ ${r.maximumCo2Ppm}`, unsafe: panel>=r.maximumCo2Ppm },
    { label: 'Independent CO₂', value: independent ? co2Ppm(zone) : null, unit: 'ppm', limit: independent?'reference instrument':'Run analyzer', unsafe: co2Ppm(zone)>=r.maximumCo2Ppm },
    { label: 'O₂ partial pressure', value: oxygenKpa(zone,r.temperatureK), unit: 'kPa', limit: `safe > ${r.minimumOxygenKpa}`, unsafe: oxygenKpa(zone,r.temperatureK)<=r.minimumOxygenKpa },
    { label: 'CO₂ removal', value: e.co2RemovalMolPerMin, unit: 'mol/min', limit: `crew adds ${r.crewCo2MolPerMin}`, unsafe: e.co2RemovalMolPerMin<r.crewCo2MolPerMin },
    { label: 'Scrubber capacity', value: activeFault(s)==='media-exhausted'?0:e.scrubberRemainingMol, unit: 'mol CO₂', limit: `backup ${e.backupRemainingMol.toFixed(1)} mol`, unsafe: false },
    { label: 'CO₂ trend', value: e.co2TrendPpmPerMin, unit: 'ppm/min', limit: 'positive = accumulating', unsafe: e.co2TrendPpmPerMin>10 },
  ];
}
export function getFankouchLine(s: MissionState): { id: string; text: string; serious: boolean } {
  const e = s.emergency;
  const key = `${s.scenarioId}:${e?.mode ?? s.training?.mode ?? 'cadet'}`;
  if (s.status === 'failed') return { id:key+':failed', text: 'The safety limit was crossed. Let’s trace the evidence, then rewind one decision and test a better approach.', serious:true };
  if (s.status === 'success') return { id:key+':success', text:'Behi! Verified recovery. Now compare this attempt with your earlier decisions.', serious:false };
  if (e) {
    const r = emergencyRules(s), z=e.zones[e.crewZone];
    if (pressureKpa(z,r.temperatureK)<85 || co2Ppm(z)>3500) return { id:key+':critical', text:'Commander, the occupied atmosphere is approaching its safety limit. Check containment or backup treatment before spending more time.', serious:true };
    if (s.events.at(-1)?.type === 'EMERGENCY_INSPECTION' && !e.hypotheses.length) return {id:key+':inspection',text:'Connect this part’s purpose with a measurement. What observation would distinguish a process fault from a misleading instrument?',serious:false};
    if (e.procedure) return { id:key+':service', text:'A spare is a resource, not a magic reset. Keep the equipment isolated and verify afterward.', serious:false };
    if (e.hypotheses.length) return { id:key+':evidence', text:'Behi! Taw 3anna dalil. We have evidence now—test whether your intervention changes the measurements.', serious:false };
    if (e.evidence.length) return { id:key+':compare', text:'Which explanation fits every reading? An instrument can be wrong even when the physical system is healthy.', serious:false };
    return { id:key+':initial', text:e.kind==='pressure'?'Pressure looks abnormal. Compare compartments and an independent instrument before deciding where the air is going.':'Oxygen looks okay, but CO₂ needs its own measurement. Check airflow and treatment performance.', serious:false };
  }
  return { id:key+':red', text:s.training?.recycler.faultOnsetHour != null?'Low recovery is a symptom. Compare pump, pressure and output readings before using a spare.':'Commander, the habitat is using more power than the panels produce. Check the distribution board.', serious:false };
}
