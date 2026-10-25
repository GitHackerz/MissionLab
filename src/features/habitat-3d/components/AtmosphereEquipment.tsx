'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { MissionState } from '@/simulation/types';
import type { EmergencyCommand } from '@/simulation/missions/types';
import { activeFault, emergencyRules } from '@/simulation/missions/emergency';
import { co2Ppm, pressureKpa } from '@/simulation/missions/gas';
import { Hotspot } from './Hotspot';
import { SpriteLabel } from './SpriteLabel';

/** Schematic maintenance rig; all clicks are validated engine requests. No gas is rendered as a visible cloud. */
export function AtmosphereEquipment({ state, onAction, reducedMotion, position = [0,0,0] }: {
  state: MissionState; onAction?: (command:EmergencyCommand)=>void; reducedMotion:boolean; position?:[number,number,number];
}) {
  const valve=useRef<Group>(null), fan=useRef<Group>(null);
  const e=state.emergency;
  const running=Boolean(e?.fanEnabled && activeFault(state)!=='fan-failure' && e.equipmentSupplyKw>=e.equipmentDemandKw && e.procedure?.component!=='fan');
  useFrame((_,dt)=>{
    if (fan.current && running && !reducedMotion) fan.current.rotation.z+=Math.min(dt,.05)*5;
    if (valve.current && e) valve.current.rotation.z=e.valveActualOpen?0:Math.PI/2;
  });
  if (!e) return null;
  const r=emergencyRules(state), press=pressureKpa(e.zones[e.crewZone],r.temperatureK), co2=co2Ppm(e.zones[e.crewZone]);
  const unsafe=e.kind==='pressure'?press<90:co2>3000;
  const request=(c:EmergencyCommand)=>onAction?.(c);
  return <group position={position} userData={{noBatch:true, atmosphericRig:true}}>
    <mesh position={[0,.65,0]}><boxGeometry args={[2.3,1.3,.65]}/><meshStandardMaterial color="#263b48" metalness={.45} roughness={.6}/></mesh>
    <mesh position={[0,1.15,.34]}><boxGeometry args={[1.9,.25,.03]}/><meshStandardMaterial color="#0f172a" emissive={unsafe?'#ef4444':'#22d3ee'} emissiveIntensity={.7}/></mesh>
    <SpriteLabel position={[0,1.7,0]} text={`${e.kind==='pressure'?'PRESSURE / ISOLATION':'AIRFLOW / SCRUBBER'} · SCHEMATIC`} heightPx={25}/>
    <SpriteLabel position={[0,1.42,.4]} text={e.kind==='pressure'?`${press.toFixed(1)} kPa · valve ${e.valveActualOpen?'OPEN':'CLOSED'}`:`${co2.toFixed(0)} ppm CO₂ · fan ${running?'ON':'STOPPED'}`} heightPx={22}/>
    {e.kind==='pressure'?<>
      <Hotspot position={[-.65,.65,.5]} size={[.6,.6,.5]} label="Isolation valve · command open/close" enabled={state.status==='running'} onActivate={()=>request({kind:'valve',open:!e.valveCommandOpen})}>
        <group ref={valve}><mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[.22,.045,8,16]}/><meshStandardMaterial color={e.valveActualOpen?'#fb923c':'#22d3ee'}/></mesh><mesh><boxGeometry args={[.48,.05,.05]}/><meshStandardMaterial color="#d4d4d8"/></mesh></group>
      </Hotspot>
      <Hotspot position={[.55,.6,.4]} size={[.65,.65,.2]} label="Hatch seal · inspect and survey" enabled={state.status==='running'} onActivate={()=>request({kind:'diagnostic',test:'leak-survey'})}>
        <mesh><boxGeometry args={[.55,.55,.08]}/><meshStandardMaterial color={e.procedure?.coverOpen?'#0f172a':'#94a3b8'}/></mesh>
      </Hotspot>
      <SpriteLabel position={[0,.1,.4]} text={e.exchangeEnabled?'Secondary exchange CONNECTED':'Secondary exchange ISOLATED'} heightPx={20}/>
    </>:<>
      <Hotspot position={[-.65,.65,.45]} size={[.65,.65,.3]} label="Fan instrument · run speed test" enabled={state.status==='running'} onActivate={()=>request({kind:'diagnostic',test:'fan-test'})}>
        <group ref={fan}>{[0,Math.PI/2].map(angle=><mesh key={angle} rotation={[0,0,angle]}><boxGeometry args={[.55,.08,.05]}/><meshStandardMaterial color={running?'#67e8f9':'#a8a29e'}/></mesh>)}</group>
      </Hotspot>
      <Hotspot position={[.55,.6,.45]} size={[.6,.7,.3]} label="Scrubber instrument · read treatment performance" enabled={state.status==='running'} onActivate={()=>request({kind:'diagnostic',test:'scrubber-test'})}>
        <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.19,.19,.6,12]}/><meshStandardMaterial color={e.scrubberEnabled?'#34d399':'#78716c'}/></mesh>
      </Hotspot>
      <SpriteLabel position={[0,.1,.4]} text={`Actual removal ${e.co2RemovalMolPerMin.toFixed(3)} mol/min`} heightPx={20}/>
    </>}
    {e.procedure&&<Hotspot position={[0,.45,.8]} size={[.5,.3,.2]} label="Service component · current step is in the workbench" active enabled={state.status==='running'} onActivate={()=>request({kind:'procedure',step:e.procedure!.step})}>
      <mesh><boxGeometry args={[.35,.18,.12]}/><meshStandardMaterial color={e.procedure.removed?'#171717':'#fbbf24'}/></mesh>
    </Hotspot>}
  </group>;
}
