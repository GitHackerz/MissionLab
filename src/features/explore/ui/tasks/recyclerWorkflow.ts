/** Presentation sequence only. Each displayed action is still validated by the engine. */
import type { MissionState, TrainingAction } from '@/simulation/types';
import type { ProcedureStepId, ReplaceableId, TrainingStepAction } from '@/simulation/training/types';
import { FAULT_SLOT, PART_LABEL } from '@/simulation/training/recycler';

export const REPAIR_STEPS: { id: ProcedureStepId; title: string; instruction: string }[] = [
  { id: 'identify-equipment', title: 'Identify the recycler', instruction: 'Confirm the equipment label before servicing a system that supplies drinking water.' },
  { id: 'review-isolation', title: 'Read the safety checklist', instruction: 'Stop the unit, confirm the pump is inactive, then open the hatch. Keep the habitat air system powered.' },
  { id: 'maintenance-mode', title: 'Stop the recycler', instruction: 'Use maintenance mode to isolate this machine. Recovery stops while crew water use continues.' },
  { id: 'confirm-inactive', title: 'Confirm the pump has stopped', instruction: 'Check for 0 rpm before opening the service compartment.' },
  { id: 'select-tool', title: 'Choose the hatch key', instruction: 'The hatch key fits the service latch. It does not release the cartridge clips.' },
  { id: 'open-hatch', title: 'Open the service compartment', instruction: 'Use the selected hatch key on the highlighted latch to expose the cartridge bays.' },
  { id: 'locate-component', title: 'Locate your chosen component', instruction: 'Find the component named in your diagnosis. A pump moves water; a filter traps particles; a sensor measures flow.' },
  { id: 'release-retainers', title: 'Release the retaining clips', instruction: 'Use the retainer driver to unlock the cartridge. Pulling against locked clips is rejected.' },
  { id: 'remove-component', title: 'Remove the old cartridge', instruction: 'Pull its handle out of the bay. The empty bay must be filled before restarting.' },
  { id: 'retrieve-spare', title: 'Take a compatible spare', instruction: 'Take the matching part from the tray. This consumes a real spare from the mission inventory.' },
  { id: 'inspect-orient-spare', title: 'Inspect and align the spare', instruction: 'Check the part label, then turn its keying notch to 0°. A misaligned part will not seat.' },
  { id: 'install-component', title: 'Seat the replacement', instruction: 'Place the inspected, aligned spare into its matching empty bay.' },
  { id: 'secure-component', title: 'Lock the retaining clips', instruction: 'Secure the installed cartridge using the retainer driver.' },
  { id: 'close-hatch', title: 'Close the compartment', instruction: 'All bays must be filled and their clips locked. Leave no loose part in the machine.' },
  { id: 'restore-test-ready', title: 'Restore test-ready mode', instruction: 'Return the closed unit to its test-ready operating mode. Its electrical circuit must also be supplied.' },
  { id: 'startup-test', title: 'Verify with measurements', instruction: 'Run the startup test. Success depends on the measured condition of the machine, including any fault you left unresolved.' },
];
export interface RepairInstruction { id: ProcedureStepId; index: number; title: string; instruction: string; label: string; action: TrainingAction }
export function proposedPart(state: MissionState): ReplaceableId {
  const hypothesis = state.training?.hypotheses.at(-1);
  return hypothesis ? FAULT_SLOT[hypothesis.kind] : 'pump-cartridge';
}
export function nextRepairInstruction(state: MissionState): RepairInstruction | null {
  const p = state.training?.recycler.procedure;
  if (!p) return null;
  const resuming = !p.maintenanceMode && !p.testReady && p.completedSteps.includes('maintenance-mode') && p.phase !== 'completed' && p.phase !== 'failed-verification';
  const item = p.testReady ? REPAIR_STEPS.find(s => s.id === 'startup-test') : resuming ? REPAIR_STEPS.find(s => s.id === 'maintenance-mode') : REPAIR_STEPS.find(s => !p.completedSteps.includes(s.id));
  if (!item) return null;
  const slot = proposedPart(state);
  let step: TrainingStepAction;
  let label: string;
  let title = item.title, instruction = item.instruction;
  switch (item.id) {
    case 'identify-equipment': step = { step: 'IDENTIFY_EQUIPMENT', moduleId: 'water-recycler' }; label = 'Identify recycler'; break;
    case 'review-isolation': step = { step: 'REVIEW_ISOLATION' }; label = 'Read safety checklist'; break;
    case 'maintenance-mode': step = { step: 'ENTER_MAINTENANCE_MODE' }; label = 'Stop recycler'; break;
    case 'confirm-inactive': step = { step: 'CONFIRM_INACTIVE' }; label = 'Confirm pump stopped'; break;
    case 'select-tool': step = { step: 'SELECT_TOOL', tool: 'hatch-key' }; label = 'Select hatch key'; break;
    case 'open-hatch': step = { step: 'OPEN_HATCH' }; label = 'Open service hatch'; break;
    case 'locate-component': step = { step: 'LOCATE_COMPONENT', slot }; label = `Locate ${PART_LABEL[slot].toLowerCase()}`; break;
    case 'release-retainers':
    case 'secure-component':
      if (p.tool !== 'retainer-driver') {
        step = { step: 'SELECT_TOOL', tool: 'retainer-driver' }; label = 'Select retainer driver'; title = 'Change tools for the cartridge clips'; instruction = 'The hatch key opens the door. The retainer driver releases and locks the cartridge clips.';
      } else { step = { step: item.id === 'release-retainers' ? 'RELEASE_RETAINERS' : 'SECURE_COMPONENT', slot }; label = item.id === 'release-retainers' ? 'Release clips' : 'Lock clips'; }
      break;
    case 'remove-component': step = { step: 'REMOVE_COMPONENT', slot }; label = 'Remove cartridge'; break;
    case 'retrieve-spare': step = { step: 'TAKE_SPARE', part: slot }; label = 'Take spare'; break;
    case 'inspect-orient-spare':
      step = { step: p.held?.inspected ? 'ROTATE_PART' : 'INSPECT_SPARE' };
      label = p.held?.inspected ? `Rotate part (${p.held.orientation}° → ${(p.held.orientation + 90) % 360}°)` : 'Inspect spare'; break;
    case 'install-component': step = { step: 'INSTALL_COMPONENT', slot }; label = 'Install cartridge'; break;
    case 'close-hatch': step = { step: 'CLOSE_HATCH' }; label = 'Close service hatch'; break;
    case 'restore-test-ready': step = { step: 'RESTORE_TEST_READY' }; label = 'Restore test-ready mode'; break;
    case 'startup-test': step = { step: 'RUN_STARTUP_TEST' }; label = 'Run startup test'; break;
  }
  return { ...item, title, instruction, index: REPAIR_STEPS.indexOf(item), label, action: { type: 'TRAINING_STEP', step } };
}
