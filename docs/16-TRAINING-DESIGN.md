# 16 — Hands-On Training Design (Authoritative)

**Status:** Implemented (P0 vertical slice). Items marked *Not implemented* are future work.
**Direction:** MissionLab teaches how a Mars habitat works by letting juniors investigate, repair and verify real (simplified) equipment inside the 3D colony, and then see what their decisions did to the whole mission.
Inspired by the NASA Space Apps 2026 challenge *Build a Junior Astronaut Mission Trainer*. No NASA affiliation. All procedures are fictional classroom simplifications, not real spacecraft maintenance instructions, and the numbers are teaching approximations, not NASA hardware data.

## 1. Learning workflow

Discover → Investigate → Understand → Plan → Execute → Verify → Reflect. It is not a wizard: the learner can move freely, and the engine enforces only real prerequisites.

| Stage | What the learner does | Where it lives |
|---|---|---|
| Discover | Storm warning, then "water recovery below expected range" (symptom only) | Event log, guidance card |
| Investigate | Click recycler parts, run tests (time-costed), read instruments | 3D service view, Evidence notebook |
| Understand | Compare readings, record a diagnosis with supporting evidence | Evidence notebook |
| Plan | Check spares, time and water cost | Repair plan card, Power tab |
| Execute | 16-step maintenance procedure with tools, hatch, cartridges | 3D service view or checklist buttons |
| Verify | Startup test whose readings come from engine state | Verification card |
| Reflect | Evidence-based debrief, rewind, comparison | Debrief tab |

## 2. Architecture and ownership

```text
3D scene / UI  --(typed request)-->  applyMissionAction  --(validated state)-->  Store  -->  3D scene / UI
```
- **Engine (Kammoun, `src/simulation/training/**`)** decides legality, time cost, inventory, faults, readings, verification, assessment. Pure TypeScript, deterministic, no React/Three.
- **3D (Habib, `src/features/habitat-3d/**`)** renders the recycler model from `training.recycler.procedure` and emits `TrainingAction` requests through `onTrainingAction`. It animates toward authoritative state and never changes it.
- **UI (Amina, `src/features/mission-ui/**`, `src/state/missionStore.ts`)** hosts guidance, notebook, procedure checklist, power planner, debrief, feedback toast.
- Contracts: `src/simulation/training/types.ts`; `MissionState.training?`, `MissionAction` (union extended), `ActionResult.feedback?` and the optional `HabitatSceneProps` additions in `types.ts`. Everything is additive and optional; fixtures without `training` keep the legacy behaviour.
- Cross-team edits made for integration (smallest change, please review): `missionStore.ts` (training mode flag, feedback, view mode, `demo-fault` loader; rewind and branches are Kammoun's), `history.ts` (training actions bypass the generic validator and snapshot ids include the training log), `page.tsx` (props, `SidePanel`, `FeedbackToast`, enables training on load), `ResourceHud.tsx` (rations floor), `MissionHeader.tsx` (demo option), `events.ts`/`engine.ts`/`actions.ts` (small additive hooks, see doc 04).

## 3. Water recycler model (educational)

Path: wastewater tank → pump cartridge → filter cartridge → treatment stage → clean tank, with a flow-sensor module. Replaceable parts: `pump-cartridge`, `filter-cartridge`, `flow-sensor`. All measurements come from one state: which slots still hold their original part, whether the unit is running, and the configured fault (`recycler.faultKind`, default `pump-seized`).

| Reading | Normal | Pump seized | Filter clogged | Sensor drift |
|---|---|---|---|---|
| Pump speed (rpm) | 3000 | **0** | 3000 | 3000 |
| Pump power (kW) | 0.55 | **0.9** (locked rotor) | 0.62 | 0.55 |
| Circulation flow (L/h) | 12 | **0** | **3** | 12 |
| Pressure before / after filter (kPa) | 180 / 150 | **101 / 101** | **320 / 105** | 180 / 150 |
| Sensor-reported recovery (L/h) | 0.42 | 0 | 0.105 | **0.10** |
| Clean-tank inflow, independent (L/h) | 0.42 | 0 | 0.105 | **0.42** |
| True water recovery (L/h) | 0.42 | 0 | 0.105 | **0.42** |

Tests (`read-flow-sensor`, `check-pump`, `read-pressure`, `compare-output`, `run-diagnostic-cycle`) cost 5–30 simulated minutes. A hypothesis records the evidence chosen; the engine reports how well that evidence fits (strong / partial / none) without revealing the real cause. The real cause is revealed in the debrief only after the mission ends or the repair is proven.

## 4. Procedure state machine

Phases: `available → investigating → diagnosis-recorded → preparing → intervention → verifying → completed`, plus `failed-verification` (retry allowed).

Rules enforced by `validateTrainingAction` (each rejection explains why):
- Maintenance mode needs a recorded diagnosis and a reviewed isolation checklist.
- Hatch needs maintenance mode, confirmed-inactive pump and the **hatch key**; retainers need the **retainer driver** and an open hatch; removal needs released retainers.
- Taking a spare needs stock (`resources.sparePumps` for pump cartridges, `training.inventory` for filters/sensors) and free hands. Stock is consumed only when a part is actually installed.
- Install needs a compatible part, inspected, with the keying notch at 0° (parts start at 180°, rotate in 90° steps), into an empty bay.
- Hatch closes only when every bay is filled and every installed spare is locked. Abort needs all bays filled.
- Restore needs a closed hatch. Startup test needs test-ready. It **passes only if the original fault is gone** (engine state), so a wrong replacement fails verification and the fault remains.

Simulated time per action is in `MINUTES` (`training/recycler.ts`); fractions carry in `training.minuteOfHour` and whole hours run through `advanceMission`, so reserves keep changing while the unit is down. A full pump swap costs about 2 simulated hours. Maintenance mode pauses recovery.

## 5. Power-management activity

Power tab: switches for life support (critical), water recycler (essential), greenhouse and research (optional). The forecast **runs the real engine on a copy of the state** (`forecastPlan`), so forecast and outcome cannot disagree. It assumes no unforeseen equipment faults. Turning life support off produces a critical warning and a failed forecast from the engine's own oxygen model. The learner is judged on surviving with safe reserves, not on maximising battery.

## 6. Food and radiation

- **Food (implemented, simple):** crew eat 0.25 rations/h; a lit, powered greenhouse adds 1/6 ration/h and counts `cropGrowthHours`. Switching it off saves 2.5 kW but stops growth. The debrief reports lit hours. *Not implemented:* irrigation allocation, light-level experiments, accelerated growth view.
- **Radiation (not implemented):** reserved for a separate solar-particle-event scenario (monitoring, shelter, shielding trade-offs). A dust storm does not cause radiation events and the product must not imply it does.

## 7. Learning modes

Same physics in all modes. Cadet: objective + hint + science note + outline highlighting of the next control **for the part the learner diagnosed** (never the real fault). Engineer: objective + science note, no hints. Commander: objective only, checklist details hidden. Switch in the Training tab (`SET_LEARNING_MODE`).

## 8. Assessment and autopsy

`assessLearning(state)` is rule-based and deterministic. Seven dimensions (system understanding, scientific reasoning, fault diagnosis, engineering planning, procedure execution, result verification, mission trade-offs) are rated from recorded evidence, the action log (including rejected actions), spares used and verification results, with a causal chain and consequences (recovery hours lost, spares consumed). Rewind restores a snapshot from before a chosen decision; the abandoned timeline is kept for comparison.

## 9. Demonstration path (real engine, no canned values)

Header fixture **Demo: Recycler Fault (engine, 30h)** applies a load-shedding plan and advances the real engine to the fault. Or play from Hour 0: Power tab → apply plan → +6h until the warning at Hour 30.

Fallback if WebGL fails: the scene shows a module list; the Training tab contains every action as buttons, so the whole mission is playable without 3D.

## 10. Playable habitat

The same training mechanics are reachable by walking to the equipment: see [17-PLAYABLE-HABITAT.md](17-PLAYABLE-HABITAT.md).

## 11. Acceptance status

| Criterion | Status |
|---|---|
| Colony → service-view inspection | Done |
| Interactive recycler with named parts, hatch, tools, spares, console | Done |
| Three distinguishable faults with consistent evidence | Done (engine + tests). 3D swaps all three parts |
| Validated replacement procedure, wrong-part and missing-step handling | Done |
| Verification from engine state; wrong repair fails | Done |
| Time, spares and water consequences; deterministic replay and rewind | Done |
| Power planner with engine forecast | Done |
| Greenhouse trade-off | Basic model |
| Mission Autopsy with evidence | Done |
| Radiation scenario, irrigation experiments, extra procedures per module | Not implemented |

## Progressive workbench update

The default recycler interface now shows a purpose/flow introduction, an evidence workspace, a diagnosis-backed plan, one validated repair action at a time, startup readings and reflection. The full checklist is optional. The previous all-controls UI remains under Advanced training controls for development. All stages derive from current engine records and survive task exit. See [19-LIVING-HABITAT-UX.md](19-LIVING-HABITAT-UX.md) for the circuit bindings and power-aware diagnostic correction.
