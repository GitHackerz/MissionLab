# Multi-mission expansion: implementation and verification

## A. Implementation summary

Three missions share the existing Next.js, React, Zustand and React Three Fiber application:

- **01 — The Red Storm**, `mission-01-red-storm`, version 1: existing hourly engine and detailed recycler training retained.
- **02 — Pressure Drop**, `mission-02-pressure-drop`, version 1: two-compartment gas balance, instrument comparison, leak/valve/sensor variants, isolation, regulation, safe crew transfer, seven-step equipment maintenance and pressure-hold verification.
- **03 — Silent Air**, `mission-03-silent-air`, version 1: separate oxygen/CO₂ inventories, fan and scrubber dependence, consumable-limited backup treatment, media/fan/sensor variants, service/calibration and monitored atmospheric recovery.

All three are playable. Exercise A/B/C selects reproducible hidden-fault configurations for the two new missions without displaying the answer. No radiation, Shelter Window or unrelated scenario was implemented. Previously speculative mission numbers in document 03 are superseded by this registry; remaining future concepts are unnumbered.

## B. Architecture and integration contracts

`src/simulation/missions/registry.ts` supplies stable identity/version, display number, briefing, objectives, systems, supported actions, diagnostic equipment, selectable fault variants, guidance levels, scientific assumptions, sources, grading dimensions and numerical configurations. Catalog, startup, mission headings and atmospheric controls consume this registry.

`gas.ts` owns species-conserving transfer and ideal-gas selectors. `emergency.ts` owns fixed-minute transitions, input/action validation, faults, diagnostics, maintenance, safety and success. `presentation.ts` derives objectives, metric values and deterministic non-spoiling Fankouch messages. `debrief.ts` computes actual atmospheric histories and learning evidence. Hypothesis support is inferred from the selected measurements, not hidden fault truth; a lucky correct guess without supporting observations does not earn a proficient diagnosis rating. `fixtures.ts` exports real reference-policy runs through the public engine/history APIs.

The established engine adds `createRegisteredMission(id, fault?)`, `ADVANCE_MINUTES` and `EMERGENCY_ACTION` dispatch. `advanceMission(state, integerHours)` remains supported and uses a minute adapter for atmospheric scenarios. Red Storm's one-hour resource model remains intact. The existing seven module IDs remain stable. Extra atmospheric loads are part of life-support demand; actual allocated supply gates treatment, feed and regulation. Optional systems remain controllable.

New optional state fields are `missionVersion` and typed `emergency`. Successful atmospheric actions expose their decision state and intermediate transitions to history, so procedure costs also retain every simulated minute. Domain actions are recorded before elapsed work; minute records follow them. Deterministic snapshot IDs include branch, logical time and event/log sequence. Events and snapshots use no wall-clock/random authority.

All physical changes occur in pure simulation code. UI/3D clicks request validated actions; animation completion never changes mission state. Legacy Red Storm action IDs from power plans now use deterministic event sequence IDs, avoiding same-hour command collisions. Generic debrief decision comparisons include training and atmospheric decisions instead of only the original toggle/repair pair.

### Saves and reset

`missionlab_sessions_v2` stores `formatVersion: 2`, the active mission ID, and separately versioned sessions indexed by mission ID. Each entry includes current state, complete active history, independent original branches and training mode. Restoration validates state identity/version, resources, gas inventories, equipment, diagnostic records, clock consistency and branch/snapshot identities. Invalid or incompatible records are not resumed; the entry screen offers an explicit fresh attempt.

Structurally valid `missionlab_active_session_v1` Red Storm sessions can migrate. They cannot become Pressure Drop or Silent Air. Resume updates the active-mission pointer as well as the in-memory state, so a second refresh resumes the selected mission. Reset uses the selected scenario/fault and saves its fresh state without deleting the other missions. Auto-run is never restored as active.

Persistence is local to the browser, not cloud account storage. Finite browser storage limits still apply; large archives may exceed quota. Reset intentionally clears the selected attempt's branch history.

## C. Mission status

| Mission | Simulation | UI / 3D | Tests | E2E |
|---|---|---|---|---|
| Red Storm | PASS | PASS | PASS | PASS — power failure and complete recycler-repair survival |
| Pressure Drop | PASS | PASS | PASS | PASS — repair, failure, terminal rewind, sensor variant/mobile, fallback |
| Silent Air | PASS | PASS | PASS | PASS — fan repair, ignored warning, wrong replacement, terminal rewind |

These statuses cover the executed paths, not every browser/device/fault combination. All six atmospheric fault variants pass engine recovery tests. The stuck-valve and exhausted-media variants have not each received a separate browser playthrough. The original Red Storm contract, engine, training, workbench, input, state and scene tests remain passing.

## D. Physical models, calibration and verified paths

### Scientific provenance

The pressure model uses `P = nRT/V` and species partial pressure `p_i = n_i RT/V`, with explicit mole inventories. The ideal-gas relationship is supported by [NASA Glenn's Equation of State](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/equation-of-state-ideal-gas-2/). Separate atmospheric pressure control, ventilation, CO₂ removal and oxygen supply follow the functional separation described in [NASA's ECLSS overview](https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/).

Those references support governing principles and system roles. They do **not** supply this game's compartment sizes, failure thresholds, conductances, emergency timing, spare counts, treatment capacities or procedure durations. All such values below are explicit fictional educational calibration. They are not NASA operating limits, human exposure advice or certified hardware data.

### Pressure Drop

Two rigid, well-mixed compartments: hub 120 m³, service zone 30 m³; initial pressure 101.3 kPa; temperature fixed at 293.15 K; oxygen fraction 0.21 and CO₂ 800 ppm. `R = 0.008314462618 kPa·m³/(mol·K)`.

Each zone separately tracks inert gas, oxygen and CO₂ in moles. Displayed pressure is derived, never decremented independently. Transfers remove donor-proportional species and add exactly the same quantities to the receiving zone. A transfer is bounded by the equalization quantity, preventing one-minute numerical overshoot. Leaks remove species proportionally, with cumulative total-gas and oxygen-loss records.

The simplified leak/vent conductance is 0.35 mol/(min·kPa), against a modeled exterior pressure of 0.6 kPa. Inter-zone conductance is 4 mol/(min·kPa). These are linear educational approximations, not compressible/choked-flow CFD. A damaged seal opens the loss path; a stuck valve leaves the hub connected to a service-zone vent during isolation. A drifted sensor changes only its reported reading, not physical gas loss.

The main valve has separate commanded/actual state. Secondary exchange isolation provides an independent containment option. Closed isolation protects the occupied hub while the unoccupied service zone can continue losing gas. Crew transfer requires connected, pressure-matched safe zones. Reopening with a pressure difference above 5 kPa is rejected; controlled equalization is outside the exercise. Repair uses a fictional sealed remote maintenance port; the player is not instructed to enter a depressurized room.

A powered backup regulator draws up to 12 mol/min of mixed air from a separate 700 mol atmosphere tank toward nominal pressure. Its oxygen fraction is accounted for as part of that gas source. This mixed-air reserve is distinct from stored pure oxygen in kilograms. Normal oxygen feed draws 0.073 mol/min from the pure-O₂ reserve, while crew consumes the same molar rate. Crew separately adds 0.06 mol/min CO₂.

Occupied pressure at/below 75 kPa or oxygen partial pressure at/below 16 kPa terminates the mission. Stored oxygen/water limits also remain enforced. The 180-minute deadline requires verified recovery, not merely elapsed survival. Success requires a contained/repaired fault, safe occupied atmosphere, adequate reserves, no open maintenance procedure and five consecutive minutes above 90 kPa with pressure change below 0.03 kPa/min. Sensor drift must be corrected rather than treated as a real leak.

Reference policies, executed against the real engine:

| Policy | Outcome | Minute | Minimum occupied pressure | Gas lost | Cabin oxygen lost | Stored O₂ |
|---|---|---:|---:|---:|---:|---:|
| Ignore warning | Oxygen partial-pressure failure from gas loss | 55 | 75.884 kPa | 1623.563 mol | 340.984 mol | 4.87152 kg |
| Calibrate the sensor while the seal still leaks | Same genuine failure | 55 | 75.884 kPa | 1623.563 mol | 340.984 mol | 4.87152 kg |
| Diagnose, isolate, replace seal, verify | Success | 20 | 100.677 kPa | 316.938 mol | 66.557 mol | 4.95328 kg |

The oxygen partial-pressure threshold happens to be crossed before the total-pressure threshold with these parameters. The failure is not mislabeled as an arbitrary empty tank: the separate pure-O₂ reserve remains available while cabin gas escapes.

The successful reference policy collects a hatch leak-survey record, records a supported diagnosis, isolates the secondary exchange path, performs the seven-step seal service and requests the five-minute hold. A validated alternative contains the leaking zone with the main valve and verifies the safe hub without forcing a spare replacement.

### Silent Air

One well-mixed 60 m³ cabin at the same initial pressure/composition and temperature. The service-zone volume is zero and no inter-compartment transfer runs. At minute 15, one configured fault occurs: fan failure, exhausted media, or sensor drift. Before onset, players can collect baseline readings; they cannot complete a recovery verification before the emergency occurs.

Crew adds 0.06 mol CO₂/min. Powered circulation allows the main scrubber to remove up to 0.12 mol/min, bounded by actual cabin CO₂ and remaining media capacity (40 mol CO₂). A failed fan eliminates contact flow; exhausted media eliminates removal despite normal fan speed. A powered independent backup removes up to 0.09 mol/min from an 8 mol consumable supply, even when the main fan is unavailable. Only actual removal consumes media capacity. A wrong spare consumes time/inventory without clearing an unrelated fault.

Cabin oxygen consumption/feed use separate molar flows and the stored-O₂ reservoir. Rising CO₂ does not directly subtract arbitrary oxygen. Gas composition is derived from each species inventory. The sensor-drift variant adds a reporting bias only; the independent analyzer continues to measure physical composition. Calibration changes the bias rather than deleting cabin CO₂.

Safety fails at 6000 ppm CO₂ (or other occupied-air/essential-resource limits). Verification requires observed fault onset, evidence and a hypothesis, actual supplied treatment, safe atmosphere, CO₂ at/below 1600 ppm, non-rising CO₂ and removal at least matching crew production for ten consecutive minutes. Either repaired main treatment or sufficient effective backup treatment can meet the requirement. The stabilization deadline is 720 minutes.

| Policy | Outcome | Minute | Maximum actual CO₂ | CO₂ removed | Stored O₂ |
|---|---|---:|---:|---:|---:|
| Ignore fan failure | CO₂ safety failure | 248 | 6013.766 ppm | 1.80 mol | 4.420672 kg |
| Calibrate a sensor while the fan remains failed | Same genuine failure | 248 | 6013.766 ppm | 1.80 mol | 4.420672 kg |
| Diagnose, isolate, replace fan, restart, verify | Success | 43 | 848.081 ppm | 3.12 mol | 4.899552 kg |

Oxygen partial pressure remains safe in the ignored-CO₂ path. This is the central lesson: adequate stored oxygen does not prove safe cabin air. Unit tests additionally cover an incorrect physical cartridge replacement and a consumable-limited backup-only recovery strategy.

### Time and outcomes

Atmospheric systems use integer one-minute steps. Training action durations are integer minutes and flow continues during the work. Hour display is a compatible derived adapter (`minute / 60`). Red Storm retains its established hourly model and minute-costed training adapter. Mission clocks never depend on render frame rate. UI waits stop at a newly recorded atmospheric warning; pure batched progression remains equivalent to single-minute stepping. Auto-run pauses at warnings, terminal outcomes and exclusive tasks.

## E. Game experience changes

- **Catalogue/briefing:** the existing catalogue (`src/config/missions.ts`) lists the three playable missions and links each to `/mission?mission=<id>`. The in-app `MissionIntro` briefing is driven by the mission registry (title, hazard, objectives, science concept, first destination), offers Exercise A/B/C for the atmospheric missions and separates **Resume attempt** from **Start fresh**. The earlier standalone three-mission picker and the unused legacy briefing screens were removed.
- **Exploration/navigation:** existing astronaut, WASD/Shift/E, room collision, touch controls and camera transitions retained. Contextual labels identify the pressure console in the Central Hub and air-treatment console in Life Support. Objectives and destinations derive from mission progress. Atmospheric metrics remain available in focused work; the workbench keeps its instrument strip visible while scrolling.
- **Equipment:** a procedural low-poly atmospheric rig exists in both colony and habitat views. The valve wheel reflects actual position, the fan reflects running/power state, and service cover/part indicators follow procedure state. Instrument hotspots request the same validated diagnostics/actions as keyboard-accessible controls. The rig is explicitly labeled schematic; no invisible CO₂ cloud is invented.
- **Diagnostics/maintenance:** time costs displayed before action; independent records, selectable evidence and unselected hypotheses; useful rejection feedback; seven pressure/air service stages instead of copying the recycler's 16 steps. Red Storm's progressive workbench remains the default for recycler training.
- **Fankouch:** existing mascot assets used for brief, deterministic mission/stage/risk messages. Critical advice is clear English; optional Tunisian flavor is noncritical. Commander suppresses routine hints. Dismissed messages do not repeatedly pop up; root causes are not revealed through the companion.
- **HUD:** selected title, duration, minute controls, occupied gas composition, pressure/CO₂ trends, treatment performance, reserves and units. The new atmospheric loads appear in actual power accounting. Guest time remains real-world access time, separate from the mission clock.
- **Debrief:** actual pressure/CO₂ timeline, minimum occupied conditions, gas/oxygen loss, evidence, interventions, measured verification, learning assessment and original-versus-new branch comparisons. Rewind is available even if the player never made a decision before ignoring the warning.
- **Mobile/fallback:** small-screen colony layout separates the canvas from scrollable controls; no pointer interception by the canvas. Non-WebGL users retain controls and can execute the full mission. Existing reduced-motion behavior is respected by the new fan visualization.

## F. Quality gates

Run after integrating with the NOVA/teacher-dashboard `main`: `pnpm typecheck`, `pnpm lint`, `pnpm test` (atmospheric engine, saves, UI integration, session, catalogue consistency) and `pnpm build`. Earlier standalone browser runs of the mission branch exercised both new missions end to end in Chromium (desktop and mobile, with and without WebGL); the throwaway runner and its JSON output were not kept in the repository.

Executed-policy outcomes in section D come from `src/simulation/missions/fixtures.ts`, which drives the real engine and history APIs and is covered by the test suite.

## G. Limitations

- Fixed temperature and well-mixed zones; no heat, humidity, acoustic propagation, human physiology or compressible-fluid CFD.
- Linear conductance and binary fully-powered equipment are explicit educational simplifications. The single fan effectiveness factor models scrubber contact, not oxygen creation or outside fresh air.
- Pressure regulation supplies mixed air only to the occupied zone. Repressurization/equalization of an isolated service compartment is outside the exercise; leaving an unoccupied leaking zone isolated can be a valid containment strategy.
- Procedural equipment is a schematic rig, not a photorealistic pressure vessel. An exhaustive GPU/frame-rate/device guarantee is not established by software-rendered Chromium.
- Accessibility checks cover operable labels, focus behavior, reduced-motion mode, instrument tables, selected mobile journeys and fallback. No screen-reader-user study or exhaustive contrast audit is claimed.
- Saves remain browser-local. Very large histories can exceed storage quota; no cloud syncing, compression, cross-device restoration or storage encryption was introduced. Legacy malformed/unsupported saves require a fresh attempt.
- Companion seen/dismissed state is presentation-local, not an authoritative physics/save field. No voice/LLM backend was added.
- Account/guest code is retained; browser runs do not establish a fresh end-to-end signup/email/password-reset regression against a production mail provider.

## H. Integration notes

- Entry: dashboard/catalogue → `/mission?mission=<id>` → `MissionIntro` → habitat. The page validates the id against the registry and falls back to The Red Storm.
- Saves: `missionlab_sessions_v2` (per mission). Red Storm saves are validated with the stricter component-level checks before they can resume.
- Results: `MissionResultRecorder` stores atmospheric runs with their own skill ratings; minute-based missions record `finalHour` rounded up.
- Adding a mission: add its definition to `src/simulation/missions/registry.ts`, then its catalogue entry in `src/config/missions.ts` (see `docs/19-MISSION-CATALOG.md`).
