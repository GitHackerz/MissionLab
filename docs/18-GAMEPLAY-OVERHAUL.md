# Gameplay experience overhaul

Implemented against integration commit `709fc27`. The existing simulation, history and training contracts remain authoritative. No new mission state, repair rules, resource calculations, backend or asset dependencies were introduced.

## Audit findings

- The entry page opened directly on the exterior's telemetry dashboard, with astronaut exploration behind a secondary action.
- Exploration already had movement, collision, room detection, interaction hysteresis, six tasks, a reusable recycler model and validated maintenance. These were retained.
- The default exploration HUD mixed resource readouts, time controls, demonstration-state replacement and navigation.
- The cutaway rooms had no physical setting or readable room signage. Equipment, character and floor surfaces needed additional identity and detail.
- The focused recycler camera could put a wall between the viewer and its controls; the drawer also occupied part of the machine's framing.
- Mission Control opened debrief through a 900ms timer even though camera transitions can take 2.2 seconds. That could drop the request.
- Validation scanned a nested historical checkout under `.claude/worktrees`, duplicating tests and mixing React instances. Another server was using the default Next output directory.

## Implemented experience

### Entry and HUD

A concise Red Storm briefing introduces the colony, four-person crew, 72-hour objective, storm threat and controls. Start Mission enters the existing playable habitat directly. Mission time remains deliberate: exploration costs no simulated time; advancing the clock and engine training actions do.

Normal play prioritizes the world, one objective with room direction, three critical resource values, a storm warning and nearby E interaction. Menu / Esc freezes movement and exposes Resume, Colony Overview and a separate Development & demonstration disclosure. The fault demonstration still uses the existing store fixture and clearly states that it replaces the current mission.

The exterior, its original development fixtures, telemetry, service tools and review remain available through Colony Overview. Leaving and re-entering preserves the astronaut's pose and current mission.

### Habitat, character and camera

The existing collision footprints and connected room layout remain intact. New batched dressing adds insulated foundations, a Martian ground plane and rocks, floor seams, navigation dashes, doorway jambs, structural ribs, service rails, life-support manifolds and rack vents. Local canvas textures provide room names and concise engineering signage without downloaded fonts. Room-specific floors and directional lighting improve depth and orientation. Existing battery charge and greenhouse state animations continue to read engine state.

The procedural astronaut gains shoulder armour, pressure collar, chest controls, helmet lamps, backpack cylinders, suit cuffs and knee detail. Feet meet the floor and a small contact shadow anchors the character. Existing gait, turn smoothing, run and interaction poses remain driven by refs, with reduced-motion support.

The elevated follow camera remains fixed in yaw. Focused drawers shift the camera projection into the uncovered viewport; on narrow screens, the task occupies the lower portion. Recycler servicing fades cutaway walls. Exploration markers disappear in focused tasks so large nearby beacons do not obstruct equipment.

### Tasks and learning

The recycler reuses its existing selectable parts, instruments, tools, spares and engine-validated 16-step procedure. The embedded workbench adds persistent progress, next unfinished step, selected tool, held part and operating-mode feedback. The next step is highlighted; completed actions collapse into review disclosures. Diagnostics, evidence selection, hypotheses, rejected actions and startup readings still come from the training engine. Completed tool selection stays accessible because the hatch key and retainer driver are needed at different times.

The existing Power Distribution Board retains its electrical schematic, supply/demand/battery measurements, essential/optional load explanations, engine forecast, risks and Apply action. Guidance now names the actual Power Room and Life Support destinations instead of referring to dashboard tabs.

Mission Autopsy adds mission evidence summaries, a disclosure for the engine's causal chain and a reflection prompt. Existing assessment, decision-specific rewind and earlier-attempt comparisons remain intact. Opening review from Mission Control is now an atomic navigation transition, without a timer.

### Accessibility and responsiveness

Focused tasks have keyboard focus containment and restore prior focus on exit. Shared visible focus styling, larger task controls and readable task text improve keyboard use. Objectives have a visible Close action. Coarse-pointer devices receive directional touch controls, while the nearby prompt also works as a button. Mobile task drawers leave a visible section of the 3D world.

## Architecture and local validation

Ownership stays in the established layers: presentation in `explore`, `mission-ui` and `app`; only location wording changes in simulation guidance. Navigation state adds a paused mode; mission state remains exclusively in `missionStore` and the pure engine.

Vitest explicitly includes `src/**/*.test.{ts,tsx}`; TypeScript and ESLint exclude nested tooling checkouts. `MISSIONLAB_DIST_DIR` optionally isolates Next output when another server is running:

```sh
MISSIONLAB_DIST_DIR=.next-validation pnpm build
MISSIONLAB_DIST_DIR=.next-validation pnpm start --port 3001
```

Two focused regression tests cover pause/resume task locking and direct task-to-autopsy navigation. Existing tests cover pump/filter/sensor evidence, correct and incorrect repairs, startup rejection, resource synchronization, mission outcomes and deterministic rewind.

## Verification

Results and browser observations are recorded below after the final walkthrough.

## Remaining scope

This is a stylized procedural habitat and astronaut, with no licensed external rig or cinematic effects added. The original room footprints are retained to preserve tested collision and interaction contracts. Audio and advanced environmental effects remain optional future work. Automated software-rendered browser runs do not establish a hardware FPS guarantee; representative school hardware still needs performance testing. The test harness emits existing multiple-Three.js-instance warnings; these are not failing assertions.

### Actual results — 25 October 2026

- `pnpm typecheck`: passed.
- `pnpm lint`: passed, no lint warnings.
- `pnpm test`: 118 tests passed across 11 files (116 existing tests plus two lifecycle regressions). The existing training suite exercises pump, filter and sensor fault/repair paths and wrong-part verification failure.
- Production build: passed; route `/` is statically generated, 41.8 kB page / 145 kB first load before the dynamically loaded 3D experience. An initial repeated build collided with a running server's output; the isolated build directory resolved this.
- Browser: Playwright driving locally installed Chrome, production server at `http://localhost:3001`, desktop 1440×900 and touch/mobile 390×844. The separate in-app Browser runtime skill was unavailable, so the repository-compatible Playwright workflow was used.
- Desktop interaction loop passed: briefing; keyboard navigation to Power; E interaction; optional load shedding applied through the engine; clock advanced to hour 30; navigation to Life Support; E opened recycler; an intervention without a diagnosis was rejected; full diagnostic cycle; evidence-backed pump diagnosis; all 16 maintenance steps including tool changes, part inspection and orientation; successful startup verification; exit and resumed keyboard movement; engine-computed successful mission outcome; Autopsy; decision rewind and earlier-branch comparison; Colony Overview and return to the habitat.
- The successful browser run reported **zero console errors and zero console warnings**, meaningful page content, no framework error overlay, and the expected page title and URL.
- Mobile briefing and gameplay rendered without horizontal overflow; directional touch controls were visible. Mobile screenshots were inspected for layout. This is not a complete touch-only mission certification.
- One initial Chrome automation target crashed; the clean software-rendered browser run completed successfully. Another preliminary route opened the adjacent air unit after movement coast changed the nearest target; the final route approached the recycler further and completed the intended E interaction.
- Screenshots and temporary browser scripts were kept outside the repository under `/tmp/missionlab-*`.

Browser repair verification covers the pump path. Filter and sensor paths passed engine/integration tests but were not repeated through the complete rendered browser mission. Collision and smoothness have automated unit coverage and actual keyboard navigation evidence, not exhaustive camera/obstacle testing or a representative-hardware FPS benchmark. New geometry remains low-poly and static dressing is merged by material; an early developer readout showed approximately 76 draw calls / 15,812 triangles for the exploration scene, which is a complexity sample rather than a performance guarantee.

Final focused browser follow-up also passed: clicking a 3D pump status port selected the Pump cartridge component (`aria-pressed=true`); the 390×844 recycler drawer retained the visible machine above it; a rejected intervention's feedback rendered above the task (z-index 50). Mobile interaction prompts and directional controls were spaced apart after visual review.

The inherited repository tooling instruction requested `graphify update .`. That command was attempted but the local executable fails with `ModuleNotFoundError: No module named 'graphify'`. No `graphify-out` graph exists in this checkout, and this tooling failure does not affect the application or its validation.
