import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMissionStore } from '@/state/missionStore';
import { MissionBriefing } from '@/features/explore/ui/MissionBriefing';
import { TrainingPanel } from '../components/TrainingPanel';
import { AtmosphereWorkbench } from '../components/atmosphere/AtmosphereWorkbench';
import { MissionDebrief } from '../components/MissionDebrief';
import { MissionHeader } from '../components/MissionHeader';
const get=()=>useMissionStore.getState();
afterEach(()=>{cleanup();get().startMission('mission-01-red-storm');localStorage.clear();});
describe('mission-aware gameplay surfaces',()=>{
  it('catalog launches Pressure Drop with selected guidance and destination',()=>{
    const start=vi.fn();render(<MissionBriefing onStart={start}/>);
    fireEvent.click(screen.getByRole('button',{name:'Start Training'}));
    fireEvent.click(screen.getByRole('button',{name:'Select Pressure Drop'}));
    fireEvent.click(screen.getByRole('radio',{name:'commander'}));
    fireEvent.click(screen.getByRole('button',{name:'View briefing'}));
    expect(screen.getByText(/A pressure instrument reports/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Enter habitat'}));
    fireEvent.click(screen.getByRole('button',{name:'Begin Pressure Drop'}));
    expect(start).toHaveBeenCalledWith('commander','habitat','mission-02-pressure-drop');
  });
  it('pressure console collects evidence, validates isolation and verifies containment through UI',()=>{
    act(()=>get().startMission('mission-02-pressure-drop'));render(<TrainingPanel/>);
    fireEvent.click(screen.getByRole('button',{name:'Independent gas analyzer (2 min)'}));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('radio',{name:'Damaged hatch seal'}));
    fireEvent.click(screen.getByRole('button',{name:'Record supported hypothesis (1 min)'}));
    fireEvent.click(screen.getByRole('button',{name:'Close isolation valve (1 min)'}));
    fireEvent.click(screen.getByRole('button',{name:'Run monitored pressure-hold test (5 min)'}));
    expect(get().missionState.status).toBe('success');
    expect(screen.getByText('Verified recovery',{exact:true})).toBeTruthy();
  });
  it('Silent Air workbench validates and completes an actual fan intervention',()=>{
    act(()=>{get().startMission('mission-03-silent-air');get().applyAction({type:'ADVANCE_MINUTES',minutes:15});});render(<AtmosphereWorkbench/>);
    fireEvent.click(screen.getByRole('button',{name:'Fan speed and power test (2 min)'}));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('radio',{name:'Circulation fan failure'}));
    fireEvent.click(screen.getByRole('button',{name:'Record supported hypothesis (1 min)'}));
    fireEvent.click(screen.getByRole('button',{name:'Stop circulation fan (1 min)'}));
    fireEvent.click(screen.getByRole('button',{name:'Stop scrubber (1 min)'}));
    fireEvent.click(screen.getByRole('button',{name:'Begin Circulation fan service (1 min)'}));
    for(let i=0;i<7;i++)fireEvent.click(screen.getByTestId('atmospheric-procedure-action'));
    fireEvent.click(screen.getByRole('button',{name:'Start circulation fan (1 min)'}));
    fireEvent.click(screen.getByRole('button',{name:'Start scrubber (1 min)'}));
    fireEvent.click(screen.getByRole('button',{name:'Run monitored air-recovery test (10 min)'}));
    expect(get().missionState.status).toBe('success');
    expect(get().missionState.emergency!.spares.fan).toBe(0);
  });
  it('header shows selected mission, minute controls and correct duration',()=>{
    act(()=>get().startMission('mission-02-pressure-drop'));render(<MissionHeader/>);
    expect(screen.getByText(/Mission 02: Pressure Drop/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'+1m'}));expect(get().missionState.emergency!.minute).toBe(1);
  });
  it('debrief permits rewind even when the player ignored every warning',()=>{
    act(()=>{get().startMission('mission-02-pressure-drop');get().applyAction({type:'ADVANCE_MINUTES',minutes:180});});render(<MissionDebrief/>);
    expect(screen.getByText(/Root cause: seal-leak/)).toBeTruthy();
    const first=get().history[0].snapshotId;
    fireEvent.change(screen.getByLabelText('Atmospheric rewind point'),{target:{value:first}});
    expect(get().missionState.status).toBe('running');expect(get().branches).toHaveLength(1);
    expect(screen.getByRole('region',{name:'Atmospheric branch comparison'})).toBeTruthy();
  });
});
