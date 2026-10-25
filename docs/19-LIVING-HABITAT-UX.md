# Living habitat and guided training

Implemented on top of `04fe4a3` (the merged landing/account/guest work). The account, verification, guest trial and existing exterior tour remain in place. This work changes the training experience under `/mission`.

## Audit and direction

The previous experience had an astronaut-first briefing, but no training catalog; the header exposed clock and review controls throughout exploration. The new account layer had also moved the entry route, while older gameplay documentation still called the colony the default screen.

Inside the habitat, the five room point lights and most console screens stayed illuminated regardless of supplied power. Plant colour was tied to current module glow, so opening a breaker could immediately make healthy plants look dry. The recycler could report a running pump without allocated electrical power. Repair progress was engine-backed, but a learner still had to scan components, diagnostic controls, modes, tools and a 16-step list together. The 3D Locate action also only inspected a part, leaving that procedure step incomplete.

The implementation retains the existing state, history, collision layout, character, training procedure, engine forecasts and task lifecycle. It uses progressive disclosure and visible operating consequences rather than adding mission scenarios.

## Training entry and navigation

`Start Training` on the existing landing page leads to the training menu. The menu explains the activity and controls; the catalog presents the sole available mission, The Red Storm, with narrative, objectives, introductory difficulty, estimated play time and guidance selection. A separate briefing gives the engineer's role, the first destination and a clear Begin Mission action.

Cadet, Engineer and Commander use the same physics; the selected guidance mode is applied through `SET_LEARNING_MODE`. Starting a new attempt resets through the existing store action. Returning to the training menu offers Continue current mission for an active attempt, with state and pose retained. The existing store now also restores a structurally validated browser-local flight record after reload; cloud synchronization is not implemented. Starting another attempt explicitly warns that it replaces the current one.

Radiation shelter training is labelled future/not playable. A dust storm is never presented as a radiation event.

Normal exploration shows mission/time, three reserves, the relevant objective and destination, the room's lighting condition, an equipment prompt and Objectives/Menu controls. Wait controls appear with the monitoring objective; the menu retains deliberate time advancement and Autopsy. Development fixtures remain under their dedicated disclosure. Objectives expose available, active, completed, retry and failed states from engine records. Arriving in the target room changes the instruction to approaching the actual console. Choosing a hypothesis completes a recorded-diagnosis objective, not the verified-repair objective.

## Room-level electrical behaviour

`world/power.ts` is a read-only binding from existing allocated loads to scene fixtures. Lighting is bundled into those existing loads; it is not charged again, and there are no independent frontend breakers or emergency batteries.

| Room | Main fixture / display circuit |
| --- | --- |
| Central Hub | essential crew/habitat load |
| Power Room | essential crew/habitat load (distribution control) |
| Mission Control | noncritical research/operations load |
| Life Support | air revitalization load; recycler has its own independent circuit |
| Greenhouse | greenhouse/grow-light load |

When a main load is shed, main lights and its console emissive surfaces go out. Dim amber safety fixtures draw their availability from the already-allocated essential habitat circuit. They are a shared safety circuit, not a separate reserve battery. With no supply to that circuit, safety lights are off too. Partial allocations produce limited lighting. Main restoration follows allocation immediately, with short visual easing and no flicker. A small natural fill and passive printed/wayfinding surfaces preserve navigation during a blackout; darkness does not prevent leaving or inspecting a task.

Room point lights, their physical fixture strips, screens and equipment indicators use the same allocation. Changing a power plan does not change Life Support merely because the greenhouse or research room was shed. A battery at zero does not imply a blackout while solar still meets essential demand.

`RoomLighting` exposes named fixtures and circuit metadata in the scene graph for rendered QA. These are diagnostic render bindings; the simulation never reads them.

## Other environmental reactions

- Grow-light emission follows allocated greenhouse power. Plant size follows recorded `cropGrowthHours`; switching a light off does not instantly change foliage colour or kill plants. Food production and consumption remain the existing hourly engine model.
- Irrigation allocation and individual plant water/health models are not implemented. The workstation explains this boundary; static irrigation pipes are not presented as simulated flow.
- The air-unit fan follows fully supplied Life Support activity and stops when supply is lost. Its display emission follows power. The oxygen inspection explains the reserve buffer, actual allocated/requested kW, and why solar can still support a station with a depleted battery.
- Recycler water-flow particles use the authoritative operation/recovery value. Pressure needles use the same engine pressure readings as diagnostics. Physical panel and clip indicators dim when their circuit is unsupplied. Exiting maintenance leaves the equipment exactly as the engine records it.
- Interior ambient/daylight and the outside haze respond to `stormActive`. The exterior retains its existing dust, solar and visibility adapters. No dust is generated inside a sealed room.

## Recycler: one meaningful action at a time

The default focused workbench now presents:

1. **Discover:** a short purpose and used-water → pump/filter → clean-tank flow path.
2. **Investigate:** an instrument scan, optional individual tests/part inspection and readings with actual/expected ranges.
3. **Understand:** three plausible hypotheses, explicit evidence selection and engine feedback about evidential support. No answer is preselected or revealed from the hidden fault.
4. **Plan:** the diagnosed component, actual compatible spare count, tools, approximate simulated duration and the consequences of isolation.
5. **Execute:** one next instruction and action derived from completed engine steps. Tool changes and spare inspection/alignment appear when relevant. The full checklist is optional, without another set of default action buttons.
6. **Verify:** the existing engine startup test compares readings and unresolved faults. Animations cannot mark success.
7. **Reflect:** outcome, actual readings, diagnosed/replaced part, original fault only after verification, elapsed simulated time, parts taken from the log and the colony consequence. A successful pre-fault baseline check does not invent a root cause.

Both the action button and 3D hotspots request validated training actions. Clicking an exposed component can now perform the engine's Locate step. Cadet highlights identify that component before its retaining clips. Wrong diagnoses and wrong replacements remain possible, consume the relevant resources and fail verification. A failed attempt can return to evidence, record a new diagnosis and begin another validated intervention. Aborting and reopening do not reset inventory or silently complete missing work.

The same workbench is used from the exterior Training panel, with a service-view launcher. The old all-controls surface is retained in an explicitly labelled advanced/development disclosure rather than being the default learner view.

## Engine and contract changes

No resource equations or persistent mission schema were added. Existing `ModuleState.enabled`, `powerDemandKw` and `suppliedPowerKw` are sufficient for room lighting.

A demonstrated integration bug was fixed in the authoritative recycler operation adapter: insufficient allocated power now yields `running: false`, `reason: blackout`, zero recovery and zero pump draw/speed. Module synchronization retains a power shortage rather than marking the unsupplied unit operational; power-plan application resynchronizes it after allocation. These changes make diagnostics, startup verification, module state and 3D flow agree. Existing production equations already required full power, so this aligns observations with those equations rather than introducing another power calculation.

The added objectives, circuit bindings and repair instructions are pure presentation adapters. Proposed repair parts are derived from the learner's latest recorded hypothesis, never the hidden fault. History and rewind remain owned by the existing engine/store.

## Validation and remaining scope

Final commands, browser observations and limitations are recorded below. Irrigation experiments and a radiation scenario remain future work. Concurrent optional audio and PWA work is preserved; ambient machinery sound is gated by actual operating equipment, including cancellation of a pending sound stop when power quickly returns. The existing account/guest policy is unchanged. Software-rendered Chrome is useful for correctness and screenshots but cannot establish a school-device frame-rate guarantee.

### Input and review refinements

Returning to exploration explicitly restores focus to the world. Esc also closes a task when an input or select has focus. Task, menu and Autopsy dialogs contain keyboard focus among visible controls (collapsed help controls are skipped), and Tab remains the documented objectives shortcut from the world. The guest indicator uses a full-width flex position without transforming the guest expiry dialog; mobile reserves a separate top row for account controls and keeps the main objective compact.

Autopsy now puts recorded resource changes and the outcome before optional learning detail. It compares the branch's first recorded reserves with current reserves, shows the lowest water margin, and suggests a next experiment using the engine's failure category. Detailed assessment remains available in a disclosure, and actual decision rewind/branch comparison is retained.

### Continuation and verification recovery

Concurrent startup work introduced a browser-local saved flight record and optional starting-view selection. It is integrated here with the habitat as the default/recommended view, a hidden optional overview choice, and reader-facing copy that does not reveal the recycler's hidden fault. Begin Mission explicitly enables the training model before resetting; Continue resumes the actual stored mission rather than starting a second state.

Local restore structurally checks mission resources, modules, training records and history before replacing the live store. Corrupt/stale data is ignored. Rejected-action learning logs are saved along with accepted decisions and rewind branches. This is browser-local, best-effort storage; it does not add cloud synchronization. Reloaded attempts spawn safely in the hub, while task/mission progress is restored; an in-memory return to the menu also retains the current pose.

A failed startup can request a **verification-only retest** through the existing `RESTORE_TEST_READY` action. The engine permits that request only after a failed test with a closed, fully assembled unit. It does not replace any part or remove an unresolved fault. A repaired unit that failed because its circuit was off can therefore be powered and measured again without consuming another spare. Pending verification is shown as repairing; a closed unit with a failed verification remains warning until a successful test. Retest actions retain their simulation-time costs.

For rendered QA, `NEXT_PUBLIC_MISSIONLAB_SCENE_DEBUG=1` can explicitly expose the same scene/pose diagnostic references available in development. It adds no action API or simulation values. The default production build leaves those references out. A separate frozen QA build avoids live development refreshes while another workstream edits this shared checkout.


### Physical interaction recovery

The next repair instruction checks the selected bay's physical state as well as completed procedure steps. Opening a different cartridge's clips cannot skip the intended release, and every loose retainer must be secured before closing the cover. If an original component has already been removed without a compatible spare, the workbench explains the existing engine limitation and offers the actual Autopsy rewind rather than inventing a replacement or inventory refund.

### Executed verification (25 October 2026)

- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: 14 files, **135 tests passed**. Coverage includes canonical mission outcomes, deterministic replay, pump/filter/sensor procedures, failed verification, power allocation, shared safety circuit availability, ambient operating-state gating, wrong-bay interaction recovery, keyboard focus and browser-local restore/corrupt-save rejection. Vitest prints the existing multiple-Three.js-import warning in scene tests.
- Frozen production QA build: passed. Browser QA used a separate output directory with the explicitly enabled scene diagnostic flag, so live edits in this shared checkout could not reset the test session.
- Desktop Chromium: menu → Red Storm catalog → briefing → habitat; keyboard movement to Power; shedding greenhouse and research loads; actual scene main-light intensity 34 → 0 and safety intensity 0 → 7.5; restoration → 34; unaffected Life Support circuit; progression to recycler fault; instrument evidence and learner diagnosis; all 16 validated procedure steps, including a real projected 3D cartridge click; successful startup verification; return to exploration; engine mission success; Autopsy and actual decision rewind/branch comparison. No simulation state was injected to complete this journey. The first script's extra overview check hit an ambiguous duplicate button locator after the completed core journey; a separately scoped browser check passed overview/return and continuation at actual mission hour 6.
- Mobile Chromium at 390 × 844: startup, on-screen movement controls, contextual equipment entry, focused task and diagnostic/evidence controls passed, with no horizontal overflow and no captured browser errors. The focused scene sampled 60 render calls and 12,164 triangles; this is a render-complexity observation, not a frame-rate guarantee.
- Saved-session browser check: advancing through the actual Wait action, reload, Continue, and restored hour 6 passed with no captured browser errors.

Screenshots were inspected for the menu, briefing, load-shedding, greenhouse safety lighting, recycler investigation/intervention/verification, mobile layout and Autopsy. Test scripts and screenshots are local QA artifacts under `/tmp/missionlab-realism-*`.

The default release build and final browser smoke are recorded below after completion. School-device performance, full account/email flows, audio quality across devices, installation and complete offline play have not been certified by this gameplay walkthrough. Radiation and individual irrigation/plant-health simulation remain explicitly unavailable. Browser-local saves can be lost if site storage is cleared. The required `graphify update .` was attempted but the installed launcher fails with `ModuleNotFoundError: No module named 'graphify'`; no graph output was generated.
